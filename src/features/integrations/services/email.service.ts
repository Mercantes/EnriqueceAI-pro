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

export class EmailService {
  /**
   * Sends an email via Gmail API using the user's connected account.
   */
  static async sendEmail(
    userId: string,
    orgId: string,
    params: SendEmailParams,
    interactionId?: string,
  ): Promise<SendEmailResult> {
    const supabase = await createServerSupabaseClient();

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

    // Check if token is expired
    if (new Date(connection.token_expires_at) < new Date()) {
      return { success: false, error: 'Token Gmail expirado — necessário reconectar' };
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
        Authorization: `Bearer ${connection.access_token_encrypted}`,
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
