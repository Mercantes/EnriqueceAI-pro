// Connection status enum matching database
export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'syncing';

// Gmail connection row matching database table
export interface GmailConnectionRow {
  id: string;
  org_id: string;
  user_id: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_expires_at: string;
  email_address: string;
  status: ConnectionStatus;
  created_at: string;
  updated_at: string;
}

// WhatsApp connection row matching database table
export interface WhatsAppConnectionRow {
  id: string;
  org_id: string;
  phone_number_id: string;
  business_account_id: string;
  access_token_encrypted: string;
  status: ConnectionStatus;
  created_at: string;
  updated_at: string;
}

// Calendar connection row matching database table
export interface CalendarConnectionRow {
  id: string;
  org_id: string;
  user_id: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_expires_at: string;
  calendar_email: string;
  status: ConnectionStatus;
  created_at: string;
  updated_at: string;
}

// Safe versions for client (without encrypted tokens)
export interface GmailConnectionSafe {
  id: string;
  email_address: string;
  status: ConnectionStatus;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppConnectionSafe {
  id: string;
  phone_number_id: string;
  business_account_id: string;
  status: ConnectionStatus;
  created_at: string;
  updated_at: string;
}

export interface CalendarConnectionSafe {
  id: string;
  calendar_email: string;
  status: ConnectionStatus;
  created_at: string;
  updated_at: string;
}

// Re-export CRM types
export type {
  CrmProvider,
  SyncDirection,
  CrmConnectionRow,
  CrmConnectionSafe,
  CrmSyncLogRow,
  SyncErrorDetail,
  CrmCredentials,
  FieldMapping,
  SyncResult,
  CrmContact,
  CrmActivity,
  CRMAdapter,
} from './crm';
export { DEFAULT_FIELD_MAPPINGS } from './crm';
