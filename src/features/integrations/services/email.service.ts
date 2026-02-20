import type { SupabaseClient } from '@supabase/supabase-js';

import { createServerSupabaseClient } from '@/lib/supabase/server';

interface SendEmailParams {
  to: string;
  subject: string;
  htmlBody: string;
  trackOpens?: boolean;
  trackClicks?: boolean;
}

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface GmailConnection {
  id: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_expires_at: string;
  email_address: string;
  status: string;
}

/**
 * Adds tracking pixel for open tracking.
 */
function injectOpenTracking(html: string, interactionId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const pixel = `<img src="${baseUrl}/api/track/open/${interactionId}" width="1" height="1" style="display:none" alt="" />`;
  return html.replace('</body>', `${pixel}</body>`);
}

/**
 * Wraps links for click tracking.
 */
function injectClickTracking(html: string, interactionId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return html.replace(
    /href="(https?:\/\/[^"]+)"/g,
    (_match, url: string) => {
      const trackUrl = `${baseUrl}/api/track/click/${interactionId}?url=${encodeURIComponent(url)}`;
      return `href="${trackUrl}"`;
    },
  );
}

/**
 * Builds a raw RFC 2822 email message for Gmail API.
 */
function buildRawEmail(from: string, to: string, subject: string, htmlBody: string): string {
  const boundary = `boundary_${Date.now()}`;
  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(htmlBody).toString('base64'),
    `--${boundary}--`,
  ].join('\r\n');

  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Refreshes an expired Gmail token using the refresh_token grant.
 * Updates the connection in the database and returns the new access token.
 */
async function refreshAccessToken(
  connection: GmailConnection,
  supabase: SupabaseClient,
): Promise<{ accessToken: string } | { error: string }> {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? '';

  if (!clientId || !clientSecret) {
    return { error: 'Google OAuth não configurado — impossível renovar token' };
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: connection.refresh_token_encrypted,
      grant_type: 'refresh_token',
    }),
  });

  if (!tokenResponse.ok) {
    await (supabase.from('gmail_connections') as ReturnType<typeof supabase.from>)
      .update({ status: 'error' } as Record<string, unknown>)
      .eq('id', connection.id);
    return { error: 'Falha ao renovar token Gmail — reconexão necessária' };
  }

  const tokens = (await tokenResponse.json()) as {
    access_token: string;
    expires_in: number;
  };

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  await (supabase.from('gmail_connections') as ReturnType<typeof supabase.from>)
    .update({
      access_token_encrypted: tokens.access_token,
      token_expires_at: expiresAt,
      status: 'connected',
    } as Record<string, unknown>)
    .eq('id', connection.id);

  return { accessToken: tokens.access_token };
}

export class EmailService {
  /**
   * Sends an email via Gmail API using the user's connected account.
   *
   * @param supabaseClient - Optional Supabase client to use (for cron/service role contexts).
   *                         If not provided, uses cookie-based `createServerSupabaseClient()`.
   */
  static async sendEmail(
    userId: string,
    orgId: string,
    params: SendEmailParams,
    interactionId?: string,
    supabaseClient?: SupabaseClient,
  ): Promise<SendEmailResult> {
    const supabase = supabaseClient ?? (await createServerSupabaseClient());

    // Fetch Gmail connection
    const { data: connection } = (await (supabase
      .from('gmail_connections') as ReturnType<typeof supabase.from>)
      .select('*')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .eq('status', 'connected')
      .single()) as { data: GmailConnection | null };

    if (!connection) {
      return { success: false, error: 'Nenhuma conexão Gmail ativa encontrada' };
    }

    // Auto-refresh if token is expired
    let accessToken = connection.access_token_encrypted;
    if (new Date(connection.token_expires_at) < new Date()) {
      const refreshResult = await refreshAccessToken(connection, supabase);
      if ('error' in refreshResult) {
        return { success: false, error: refreshResult.error };
      }
      accessToken = refreshResult.accessToken;
    }

    // Apply tracking
    let html = params.htmlBody;
    if (interactionId) {
      if (params.trackOpens !== false) {
        html = injectOpenTracking(html, interactionId);
      }
      if (params.trackClicks !== false) {
        html = injectClickTracking(html, interactionId);
      }
    }

    // Build raw email
    const raw = buildRawEmail(connection.email_address, params.to, params.subject, html);

    // Send via Gmail API
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      return {
        success: false,
        error: errorBody?.error?.message ?? `Gmail API error: ${response.status}`,
      };
    }

    const result = (await response.json()) as { id: string };
    return { success: true, messageId: result.id };
  }
}
