import { describe, expect, it, vi, beforeEach } from 'vitest';

import { WhatsAppService, validateBrazilianPhone } from './whatsapp.service';

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}));

import { createServerSupabaseClient } from '@/lib/supabase/server';

function mockSupabase(waData: Record<string, unknown> | null) {
  const supabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: waData }),
          }),
        }),
      }),
    }),
  };
  vi.mocked(createServerSupabaseClient).mockResolvedValue(supabase as never);
}

describe('validateBrazilianPhone', () => {
  it('should accept full format with country code', () => {
    expect(validateBrazilianPhone('+5511999887766')).toBe('5511999887766');
  });

  it('should accept format without plus', () => {
    expect(validateBrazilianPhone('5511999887766')).toBe('5511999887766');
  });

  it('should add country code for 11-digit number', () => {
    expect(validateBrazilianPhone('11999887766')).toBe('5511999887766');
  });

  it('should add country code for 10-digit number', () => {
    expect(validateBrazilianPhone('1199988776')).toBe('551199988776');
  });

  it('should accept formatted number', () => {
    expect(validateBrazilianPhone('(11) 99988-7766')).toBe('5511999887766');
  });

  it('should reject too short number', () => {
    expect(validateBrazilianPhone('123456')).toBeNull();
  });

  it('should reject too long number', () => {
    expect(validateBrazilianPhone('551199988776611')).toBeNull();
  });
});

describe('WhatsAppService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  it('should return error when no WhatsApp connection found', async () => {
    mockSupabase(null);

    const result = await WhatsAppService.sendMessage('org-1', {
      to: '5511999887766',
      body: 'Olá!',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Nenhuma conexão WhatsApp ativa encontrada');
  });

  it('should return error for invalid phone number', async () => {
    mockSupabase({
      id: 'wa-1',
      phone_number_id: '123456',
      business_account_id: 'BA-123',
      access_token_encrypted: 'token',
      status: 'connected',
    });

    const result = await WhatsAppService.sendMessage('org-1', {
      to: '123',
      body: 'Olá!',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Número de telefone inválido');
  });

  it('should send text message successfully', async () => {
    mockSupabase({
      id: 'wa-1',
      phone_number_id: '123456',
      business_account_id: 'BA-123',
      access_token_encrypted: 'token',
      status: 'connected',
    });

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ messages: [{ id: 'wamid.123' }] }),
    } as Response);

    const result = await WhatsAppService.sendMessage('org-1', {
      to: '5511999887766',
      body: 'Olá!',
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('wamid.123');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://graph.facebook.com/v21.0/123456/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token',
        }),
      }),
    );
  });

  it('should send template message when templateName provided', async () => {
    mockSupabase({
      id: 'wa-1',
      phone_number_id: '123456',
      business_account_id: 'BA-123',
      access_token_encrypted: 'token',
      status: 'connected',
    });

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ messages: [{ id: 'wamid.456' }] }),
    } as Response);

    const result = await WhatsAppService.sendMessage('org-1', {
      to: '5511999887766',
      body: '',
      templateName: 'hello_world',
      templateParams: ['João'],
    });

    expect(result.success).toBe(true);
    const fetchCall = vi.mocked(global.fetch).mock.calls[0]!;
    const body = JSON.parse(fetchCall[1]?.body as string) as Record<string, unknown>;
    expect(body.type).toBe('template');
  });

  it('should handle Meta API errors', async () => {
    mockSupabase({
      id: 'wa-1',
      phone_number_id: '123456',
      business_account_id: 'BA-123',
      access_token_encrypted: 'token',
      status: 'connected',
    });

    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: { message: 'Invalid phone number', code: 100 } }),
    } as Response);

    const result = await WhatsAppService.sendMessage('org-1', {
      to: '5511999887766',
      body: 'Olá!',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid phone number');
  });
});
