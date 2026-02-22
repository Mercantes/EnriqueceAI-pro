import { z } from 'zod';

export const saveCallSettingsSchema = z.object({
  calls_enabled: z.boolean(),
  default_call_type: z.enum(['inbound', 'outbound', 'manual']),
  significant_threshold_seconds: z.number().int().min(1, 'Deve ser pelo menos 1 segundo'),
  daily_call_target: z.number().int().min(0, 'Deve ser maior ou igual a zero'),
});

export type SaveCallSettingsInput = z.infer<typeof saveCallSettingsSchema>;

export const saveCallDailyTargetsSchema = z.object({
  targets: z.array(
    z.object({
      userId: z.string().uuid(),
      dailyTarget: z.number().int().min(0).nullable(),
    }),
  ),
});

export type SaveCallDailyTargetsInput = z.infer<typeof saveCallDailyTargetsSchema>;

export const addPhoneBlacklistSchema = z.object({
  phone_pattern: z
    .string()
    .min(1, 'Padrão de telefone é obrigatório')
    .max(50, 'Máximo de 50 caracteres'),
  reason: z.string().max(200).optional(),
});

export type AddPhoneBlacklistInput = z.infer<typeof addPhoneBlacklistSchema>;
