import { z } from 'zod';

export const fetchNotificationsSchema = z.object({
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0),
  unread_only: z.boolean().default(false),
});

export const markNotificationReadSchema = z.object({
  notification_id: z.string().uuid('ID de notificação inválido'),
});

export type FetchNotificationsInput = z.infer<typeof fetchNotificationsSchema>;
export type MarkNotificationReadInput = z.infer<typeof markNotificationReadSchema>;
