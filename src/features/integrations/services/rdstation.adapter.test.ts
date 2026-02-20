import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RDStationAdapter } from './rdstation.adapter';
import type { CrmCredentials } from '../types/crm';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('RDStationAdapter', () => {
  let adapter: RDStationAdapter;
  const mockCredentials: CrmCredentials = {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    token_expires_at: new Date(Date.now() + 3600000).toISOString(),
  };

  beforeEach(() => {
    adapter = new RDStationAdapter();
    vi.clearAllMocks();
    process.env.RDSTATION_CLIENT_ID = 'test-client-id';
    process.env.RDSTATION_CLIENT_SECRET = 'test-client-secret';
  });

  it('should have provider set to rdstation', () => {
    expect(adapter.provider).toBe('rdstation');
  });

  describe('getAuthUrl', () => {
    it('should generate correct OAuth URL', () => {
      const url = adapter.getAuthUrl('http://localhost:3000/callback');
      expect(url).toContain('https://api.rd.services/auth/dialog');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('response_type=code');
    });
  });

  describe('exchangeCode', () => {
    it('should exchange code for tokens', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'rd-token',
          refresh_token: 'rd-refresh',
          expires_in: 3600,
        }),
      });

      const result = await adapter.exchangeCode('code', 'http://localhost:3000/callback');
      expect(result.access_token).toBe('rd-token');
      expect(result.refresh_token).toBe('rd-refresh');
    });
  });

  describe('pullContacts', () => {
    it('should pull contacts from RD Station', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          contacts: [
            {
              uuid: 'rd-contact-1',
              email: 'test@example.com',
              name: 'Test Contact',
              company: 'Test Corp',
              mobile_phone: '11999990000',
              updated_at: '2026-02-19T10:00:00Z',
            },
          ],
          has_more: false,
        }),
      });

      const contacts = await adapter.pullContacts(mockCredentials);
      expect(contacts).toHaveLength(1);
      expect(contacts[0]!.external_id).toBe('rd-contact-1');
      expect(contacts[0]!.email).toBe('test@example.com');
    });
  });

  describe('pushContact', () => {
    it('should create new contact', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ uuid: 'new-rd-contact' }),
      });

      const result = await adapter.pushContact(
        mockCredentials,
        { nome_fantasia: 'Empresa', email: 'test@test.com', cnpj: '12345678000190' },
        { nome_fantasia: 'name', email: 'email', cnpj: 'cf_cnpj' },
      );
      expect(result.external_id).toBe('new-rd-contact');
    });

    it('should map cf_ fields to custom_fields', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ uuid: 'new-rd-contact' }),
      });

      await adapter.pushContact(
        mockCredentials,
        { cnpj: '12345678000190' },
        { cnpj: 'cf_cnpj' },
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0]![1]!.body as string);
      expect(callBody.custom_fields.cf_cnpj).toBe('12345678000190');
    });
  });

  describe('pushActivity', () => {
    it('should push activity as event', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ event_uuid: 'event-1' }),
      });

      const result = await adapter.pushActivity(mockCredentials, {
        contact_external_id: 'rd-contact-1',
        type: 'email',
        subject: 'Follow up',
        body: 'Test body',
        timestamp: '2026-02-19T10:00:00Z',
      });
      expect(result.external_id).toBe('event-1');
    });
  });

  describe('validateConnection', () => {
    it('should return true for valid connection', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: 'Test Account' }),
      });
      expect(await adapter.validateConnection(mockCredentials)).toBe(true);
    });

    it('should return false for invalid connection', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'Unauthorized',
      });
      expect(await adapter.validateConnection(mockCredentials)).toBe(false);
    });
  });
});
