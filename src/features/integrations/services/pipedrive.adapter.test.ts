import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PipedriveAdapter } from './pipedrive.adapter';
import type { CrmCredentials } from '../types/crm';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('PipedriveAdapter', () => {
  let adapter: PipedriveAdapter;
  const mockCredentials: CrmCredentials = {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    token_expires_at: new Date(Date.now() + 3600000).toISOString(),
    api_key: 'https://test-company.pipedrive.com',
  };

  beforeEach(() => {
    adapter = new PipedriveAdapter();
    vi.clearAllMocks();
    process.env.PIPEDRIVE_CLIENT_ID = 'test-client-id';
    process.env.PIPEDRIVE_CLIENT_SECRET = 'test-client-secret';
  });

  it('should have provider set to pipedrive', () => {
    expect(adapter.provider).toBe('pipedrive');
  });

  describe('getAuthUrl', () => {
    it('should generate correct OAuth URL', () => {
      const url = adapter.getAuthUrl('http://localhost:3000/callback');
      expect(url).toContain('https://oauth.pipedrive.com/oauth/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('redirect_uri=');
    });
  });

  describe('exchangeCode', () => {
    it('should exchange code for tokens', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-token',
          refresh_token: 'new-refresh',
          expires_in: 3600,
          api_domain: 'https://company.pipedrive.com',
        }),
      });

      const result = await adapter.exchangeCode('code', 'http://localhost:3000/callback');
      expect(result.access_token).toBe('new-token');
      expect(result.api_key).toBe('https://company.pipedrive.com');
    });
  });

  describe('pullContacts', () => {
    it('should pull contacts from Pipedrive', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: 1,
              name: 'Test Contact',
              email: [{ value: 'test@example.com', primary: true }],
              phone: [{ value: '11999990000', primary: true }],
              org_name: 'Test Corp',
              update_time: '2026-02-19 10:00:00',
            },
          ],
          additional_data: { pagination: { more_items_in_collection: false } },
        }),
      });

      const contacts = await adapter.pullContacts(mockCredentials);
      expect(contacts).toHaveLength(1);
      expect(contacts[0]!.email).toBe('test@example.com');
      expect(contacts[0]!.company_name).toBe('Test Corp');
    });
  });

  describe('pushContact', () => {
    it('should create new contact', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { id: 42 } }),
      });

      const result = await adapter.pushContact(
        mockCredentials,
        { nome_fantasia: 'Empresa', email: 'test@test.com' },
        { nome_fantasia: 'name', email: 'email' },
      );
      expect(result.external_id).toBe('42');
    });
  });

  describe('pushActivity', () => {
    it('should push activity', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { id: 100 } }),
      });

      const result = await adapter.pushActivity(mockCredentials, {
        contact_external_id: '42',
        type: 'email',
        subject: 'Follow up',
        body: 'Test body',
        timestamp: '2026-02-19T10:00:00Z',
      });
      expect(result.external_id).toBe('100');
    });
  });

  describe('validateConnection', () => {
    it('should return true for valid connection', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
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
