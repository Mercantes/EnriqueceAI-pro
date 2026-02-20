// Types
export type {
  ConnectionStatus,
  GmailConnectionRow,
  WhatsAppConnectionRow,
  CalendarConnectionRow,
  GmailConnectionSafe,
  WhatsAppConnectionSafe,
  CalendarConnectionSafe,
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
} from './types';
export { DEFAULT_FIELD_MAPPINGS } from './types';

// Components
export { IntegrationsView } from './components/IntegrationsView';
export { ScheduleMeetingModal } from './components/ScheduleMeetingModal';

// Services
export { CrmSyncService } from './services/crm-sync.service';
export { CRMRegistry } from './services/crm-registry';
export { EmailService } from './services/email.service';
export { WhatsAppService, validateBrazilianPhone } from './services/whatsapp.service';
