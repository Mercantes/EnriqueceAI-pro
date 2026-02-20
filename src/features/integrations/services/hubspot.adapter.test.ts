import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HubSpotAdapter } from './hubspot.adapter';
import type { CrmCredentials } from '../types/crm';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('HubSpotAdapter', () => {
  let adapter: HubSpotAdapter;
  const mockCredentials: CrmCredentials = {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    token_expires_at: new Date(Date.now() + 3600000).toISOString(),
    portal_id: '12345',
  };

  beforeEach(() => {
    adapter = new HubSpotAdapter();
    vi.clearAllMocks();
    process.env.HUBSPOT_CLIENT_ID = 'test-client-id';
    process.env.HUBSPOT_CLIENT_SECRET = 'test-client-secret';
  });

  it('should have provider set to hubspot', () => {
    expect(adapter.provider).toBe('hubspot');
  });

  describe('getAuthUrl', () => {
    it('should generate correct OAuth URL', () => {
      const url = adapter.getAuthUrl('http://localhost:3000/api/auth/callback/hubspot');
      expect(url).toContain('https://app.hubspot.com/oauth/authorize');
      expect(url).toContain('response_type=code');
      expect(url).toContain('redirect_uri=');
      expect(url).toContain('crm.objects.contacts.read');
    });
  });

  describe('exchangeCode', () => {
    it('should exchange authorization code for tokens', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
          token_type: 'bearer',
          hub_id: 12345,
        }),
      });

      const result = await adapter.exchangeCode('auth-code', 'http://localhost:3000/callback');

      expect(result.access_token).toBe('new-access-token');
      expect(result.refresh_token).toBe('new-refresh-token');
      expect(result.portal_id).toBe('12345');
      expect(result.token_expires_at).toBeDefined();
    });

    it('should throw on failed token exchange', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'Invalid code',
      });

      await expect(
        adapter.exchangeCode('bad-code', 'http://localhost:3000/callback'),
      ).rejects.toThrow('HubSpot token exchange failed');
    });
  });

  describe('refreshToken', () => {
    it('should refresh access token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'refreshed-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
        }),
      });

      const result = await adapter.refreshToken(mockCredentials);

      expect(result.access_token).toBe('refreshed-token');
      expect(result.refresh_token).toBe('new-refresh-token');
      expect(result.portal_id).toBe('12345'); // Preserves original
    });

    it('should throw if no refresh token', async () => {
      await expect(
        adapter.refreshToken({ access_token: 'test' }),
      ).rejects.toThrow('No refresh token available');
    });
  });

  describe('pullContacts', () => {
    it('should pull contacts from HubSpot', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              id: 'hs-contact-1',
              properties: {
                email: 'test@example.com',
                company: 'Test Corp',
                phone: '11999990000',
              },
              updatedAt: '2026-02-19T10:00:00Z',
            },
          ],
          paging: null,
        }),
      });

      const contacts = await adapter.pullContacts(mockCredentials);

      expect(contacts).toHaveLength(1);
      expect(contacts[0]!.external_id).toBe('hs-contact-1');
      expect(contacts[0]!.email).toBe('test@example.com');
      expect(contacts[0]!.company_name).toBe('Test Corp');
    });

    it('should filter by date when since is provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [], paging: null }),
      });

      await adapter.pullContacts(mockCredentials, '2026-02-01T00:00:00Z');

      const callBody = JSON.parse(mockFetch.mock.calls[0]![1].body);
      expect(callBody.filterGroups).toHaveLength(1);
      expect(callBody.filterGroups[0].filters[0].operator).toBe('GTE');
    });
  });

  describe('pushContact', () => {
    it('should create new contact in HubSpot', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'new-hs-contact', properties: {} }),
      });

      const result = await adapter.pushContact(
        mockCredentials,
        { nome_fantasia: 'Empresa Teste', email: 'test@test.com' },
        { nome_fantasia: 'company', email: 'email' },
      );

      expect(result.external_id).toBe('new-hs-contact');
      const callBody = JSON.parse(mockFetch.mock.calls[0]![1].body);
      expect(callBody.properties.company).toBe('Empresa Teste');
      expect(callBody.properties.email).toBe('test@test.com');
    });

    it('should update existing contact when externalId provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'existing-id', properties: {} }),
      });

      const result = await adapter.pushContact(
        mockCredentials,
        { email: 'updated@test.com' },
        { email: 'email' },
        'existing-id',
      );

      expect(result.external_id).toBe('existing-id');
      expect(mockFetch.mock.calls[0]![0]).toContain('/existing-id');
      expect(mockFetch.mock.calls[0]![1].method).toBe('PATCH');
    });
  });

  describe('pushActivity', () => {
    it('should push activity as note to HubSpot', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'new-activity-id' }),
      });

      const result = await adapter.pushActivity(mockCredentials, {
        contact_external_id: 'hs-contact-1',
        type: 'whatsapp',
        subject: 'WhatsApp mensagem',
        body: 'Olá, como posso ajudar?',
        timestamp: '2026-02-19T10:00:00Z',
      });

      expect(result.external_id).toBe('new-activity-id');
      // WhatsApp maps to NOTE type
      expect(mockFetch.mock.calls[0]![0]).toContain('/notes');
    });

    it('should push email activity correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'email-activity-id' }),
      });

      const result = await adapter.pushActivity(mockCredentials, {
        contact_external_id: 'hs-contact-1',
        type: 'email',
        subject: 'Follow up',
        body: 'Just checking in...',
        timestamp: '2026-02-19T10:00:00Z',
      });

      expect(result.external_id).toBe('email-activity-id');
      expect(mockFetch.mock.calls[0]![0]).toContain('/emails');
    });
  });

  describe('validateConnection', () => {
    it('should return true for valid connection', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ portalId: 12345 }),
      });

      const valid = await adapter.validateConnection(mockCredentials);
      expect(valid).toBe(true);
    });

    it('should return false for invalid connection', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'Unauthorized',
      });

      const valid = await adapter.validateConnection(mockCredentials);
      expect(valid).toBe(false);
    });
  });
});
