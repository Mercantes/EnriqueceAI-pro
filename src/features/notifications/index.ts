// Notifications feature barrel export

// Types
export type {
  NotificationType,
  NotificationResourceType,
  NotificationRow,
  NotificationInsert,
} from './types';

// Schemas
export {
  fetchNotificationsSchema,
  markNotificationReadSchema,
} from './schemas/notification.schemas';
export type {
  FetchNotificationsInput,
  MarkNotificationReadInput,
} from './schemas/notification.schemas';

// Actions
export { fetchNotifications } from './actions/fetch-notifications';
export type { FetchNotificationsResult } from './actions/fetch-notifications';
export { markNotificationRead } from './actions/mark-notification-read';
export { markAllNotificationsRead } from './actions/mark-all-notifications-read';

// Services
export {
  createNotification,
  createNotificationsForOrgMembers,
} from './services/notification.service';

// Components
export { NotificationProvider } from './components/NotificationProvider';
export { NotificationBell } from './components/NotificationBell';
export { NotificationDropdown } from './components/NotificationDropdown';
export { NotificationItem } from './components/NotificationItem';

// Hooks
export { useNotifications } from './hooks/useNotifications';
