import { describe, expect, it, vi, beforeEach } from 'vitest';

import { EmailService } from './email.service';

// Mock supabase
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}));

import { createServerSupabaseClient } from '@/lib/supabase/server';

function mockSupabase(gmailData: Record<string, unknown> | null) {
  const supabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: gmailData }),
            }),
          }),
        }),
      }),
    }),
  };
  vi.mocked(createServerSupabaseClient).mockResolvedValue(supabase as never);
}

describe('EmailService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  it('should return error when no Gmail connection found', async () => {
    mockSupabase(null);

    const result = await EmailService.sendEmail('user-1', 'org-1', {
      to: 'lead@example.com',
      subject: 'Test',
      htmlBody: '<p>Hello</p>',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Nenhuma conexão Gmail ativa encontrada');
  });

  it('should return error when token is expired', async () => {
    mockSupabase({
      id: 'conn-1',
      access_token_encrypted: 'token',
      refresh_token_encrypted: 'refresh',
      token_expires_at: '2020-01-01T00:00:00Z',
      email_address: 'user@gmail.com',
      status: 'connected',
    });

    const result = await EmailService.sendEmail('user-1', 'org-1', {
      to: 'lead@example.com',
      subject: 'Test',
      htmlBody: '<p>Hello</p>',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Token Gmail expirado');
  });

  it('should send email successfully via Gmail API', async () => {
    const futureDate = new Date(Date.now() + 3600 * 1000).toISOString();
    mockSupabase({
      id: 'conn-1',
      access_token_encrypted: 'valid-token',
      refresh_token_encrypted: 'refresh',
      token_expires_at: futureDate,
      email_address: 'user@gmail.com',
      status: 'connected',
    });

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'msg-123' }),
    } as Response);

    const result = await EmailService.sendEmail('user-1', 'org-1', {
      to: 'lead@example.com',
      subject: 'Test Email',
      htmlBody: '<p>Hello World</p>',
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('msg-123');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer valid-token',
        }),
      }),
    );
  });

  it('should handle Gmail API errors', async () => {
    const futureDate = new Date(Date.now() + 3600 * 1000).toISOString();
    mockSupabase({
      id: 'conn-1',
      access_token_encrypted: 'valid-token',
      refresh_token_encrypted: 'refresh',
      token_expires_at: futureDate,
      email_address: 'user@gmail.com',
      status: 'connected',
    });

    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: { message: 'Rate limit exceeded' } }),
    } as Response);

    const result = await EmailService.sendEmail('user-1', 'org-1', {
      to: 'lead@example.com',
      subject: 'Test',
      htmlBody: '<p>Hello</p>',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Rate limit exceeded');
  });

  it('should inject open tracking pixel when interactionId provided', async () => {
    const futureDate = new Date(Date.now() + 3600 * 1000).toISOString();
    mockSupabase({
      id: 'conn-1',
      access_token_encrypted: 'valid-token',
      refresh_token_encrypted: 'refresh',
      token_expires_at: futureDate,
      email_address: 'user@gmail.com',
      status: 'connected',
    });

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'msg-456' }),
    } as Response);

    await EmailService.sendEmail(
      'user-1',
      'org-1',
      {
        to: 'lead@example.com',
        subject: 'Tracked Email',
        htmlBody: '<html><body><p>Hello</p></body></html>',
        trackOpens: true,
      },
      'interaction-123',
    );

    expect(global.fetch).toHaveBeenCalled();
    const calls = vi.mocked(global.fetch).mock.calls;
    const fetchCall = calls[0]!;
    const body = JSON.parse(fetchCall[1]?.body as string) as { raw: string };
    // Decode the outer base64url to get the MIME message
    const mimeMessage = Buffer.from(body.raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
    // The MIME message contains a base64-encoded HTML body — extract and decode it
    const base64Match = mimeMessage.match(/\r\n\r\n([A-Za-z0-9+/=]+)\r\n--/);
    expect(base64Match).toBeTruthy();
    const htmlBody = Buffer.from(base64Match![1]!, 'base64').toString();
    expect(htmlBody).toContain('/api/track/open/interaction-123');
  });
});
