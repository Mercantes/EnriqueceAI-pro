import type {
  CRMAdapter,
  CrmContact,
  CrmCredentials,
  CrmProvider,
} from '../types/crm';

const RD_AUTH_URL = 'https://api.rd.services/auth/dialog';
const RD_TOKEN_URL = 'https://api.rd.services/auth/token';
const RD_API_BASE = 'https://api.rd.services';

function getRdClientId() {
  return process.env.RDSTATION_CLIENT_ID ?? '';
}
function getRdClientSecret() {
  return process.env.RDSTATION_CLIENT_SECRET ?? '';
}

interface RDTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface RDContactsResponse {
  contacts: RDContact[];
  has_more: boolean;
}

interface RDContact {
  uuid: string;
  email: string | null;
  name: string | null;
  company: string | null;
  mobile_phone: string | null;
  custom_fields?: Record<string, string | null>;
  updated_at: string;
}

interface RDCreateResponse {
  uuid: string;
}

interface RDEventResponse {
  event_uuid: string;
}

async function rdFetch<T>(
  path: string,
  accessToken: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${RD_API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`RD Station API error (${response.status}): ${errorText}`);
  }

  return (await response.json()) as T;
}

export class RDStationAdapter implements CRMAdapter {
  readonly provider: CrmProvider = 'rdstation';

  getAuthUrl(redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: getRdClientId(),
      redirect_uri: redirectUri,
      response_type: 'code',
    });
    return `${RD_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<CrmCredentials> {
    const response = await fetch(RD_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: getRdClientId(),
        client_secret: getRdClientSecret(),
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error('RD Station token exchange failed');
    }

    const tokens = (await response.json()) as RDTokenResponse;

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(
        Date.now() + tokens.expires_in * 1000,
      ).toISOString(),
    };
  }

  async refreshToken(credentials: CrmCredentials): Promise<CrmCredentials> {
    if (!credentials.refresh_token) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(RD_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: getRdClientId(),
        client_secret: getRdClientSecret(),
        refresh_token: credentials.refresh_token,
      }),
    });

    if (!response.ok) {
      throw new Error('RD Station token refresh failed');
    }

    const tokens = (await response.json()) as RDTokenResponse;

    return {
      ...credentials,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: new Date(
        Date.now() + tokens.expires_in * 1000,
      ).toISOString(),
    };
  }

  async pullContacts(
    credentials: CrmCredentials,
    since?: string,
  ): Promise<CrmContact[]> {
    const contacts: CrmContact[] = [];
    let page = 1;

    for (let i = 0; i < 10; i++) {
      let path = `/platform/contacts?page=${page}&page_size=100`;
      if (since) {
        path += `&updated_since=${encodeURIComponent(since)}`;
      }

      const result = await rdFetch<RDContactsResponse>(
        path,
        credentials.access_token,
      );

      for (const contact of result.contacts) {
        contacts.push({
          external_id: contact.uuid,
          email: contact.email,
          company_name: contact.company,
          phone: contact.mobile_phone,
          properties: {
            name: contact.name,
            company: contact.company,
            ...(contact.custom_fields ?? {}),
          },
          updated_at: contact.updated_at,
        });
      }

      if (!result.has_more) break;
      page++;
    }

    return contacts;
  }

  async pushContact(
    credentials: CrmCredentials,
    lead: Record<string, string | null>,
    fieldMapping: Record<string, string>,
    externalId?: string,
  ): Promise<{ external_id: string }> {
    const body: Record<string, unknown> = {};
    const customFields: Record<string, string> = {};

    for (const [appField, crmField] of Object.entries(fieldMapping)) {
      const value = lead[appField];
      if (value !== null && value !== undefined) {
        if (crmField.startsWith('cf_')) {
          customFields[crmField] = value;
        } else {
          body[crmField] = value;
        }
      }
    }

    if (Object.keys(customFields).length > 0) {
      body.custom_fields = customFields;
    }

    if (externalId) {
      await rdFetch<RDCreateResponse>(
        `/platform/contacts/${externalId}`,
        credentials.access_token,
        { method: 'PATCH', body: JSON.stringify(body) },
      );
      return { external_id: externalId };
    }

    const result = await rdFetch<RDCreateResponse>(
      '/platform/contacts',
      credentials.access_token,
      { method: 'POST', body: JSON.stringify(body) },
    );

    return { external_id: result.uuid };
  }

  async pushActivity(
    credentials: CrmCredentials,
    activity: {
      contact_external_id: string;
      type: string;
      subject: string;
      body: string;
      timestamp: string;
    },
  ): Promise<{ external_id: string }> {
    // RD Station uses events/conversions API for activities
    const result = await rdFetch<RDEventResponse>(
      '/platform/events',
      credentials.access_token,
      {
        method: 'POST',
        body: JSON.stringify({
          event_type: 'CONVERSION',
          event_family: 'CDP',
          payload: {
            conversion_identifier: `enriqueceai_${activity.type}_${Date.now()}`,
            contact_uuid: activity.contact_external_id,
            cf_activity_type: activity.type,
            cf_activity_subject: activity.subject,
            cf_activity_body: activity.body.substring(0, 500),
          },
        }),
      },
    );

    return { external_id: result.event_uuid };
  }

  async validateConnection(credentials: CrmCredentials): Promise<boolean> {
    try {
      await rdFetch<{ name: string }>(
        '/marketing/account_info',
        credentials.access_token,
      );
      return true;
    } catch {
      return false;
    }
  }
}
