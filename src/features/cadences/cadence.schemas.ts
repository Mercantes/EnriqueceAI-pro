import { z } from 'zod';

// Enums
export const cadenceStatusSchema = z.enum(['draft', 'active', 'paused', 'archived']);
export const enrollmentStatusSchema = z.enum(['active', 'paused', 'completed', 'replied', 'bounced', 'unsubscribed']);
export const channelTypeSchema = z.enum(['email', 'whatsapp']);
export const interactionTypeSchema = z.enum([
  'sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'failed', 'meeting_scheduled',
]);

// Cadence creation schema
export const createCadenceSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  description: z.string().max(1000).nullable().optional(),
});

// Cadence update schema
export const updateCadenceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  status: cadenceStatusSchema.optional(),
});

// Cadence step creation schema
export const createCadenceStepSchema = z.object({
  step_order: z.number().int().positive('Ordem do passo deve ser positiva'),
  channel: channelTypeSchema,
  template_id: z.string().uuid().nullable().optional(),
  delay_days: z.number().int().min(0, 'Dias de delay não podem ser negativos').default(0),
  delay_hours: z.number().int().min(0, 'Horas de delay não podem ser negativas').default(0),
  ai_personalization: z.boolean().default(false),
});

// Cadence step update schema
export const updateCadenceStepSchema = z.object({
  step_order: z.number().int().positive().optional(),
  channel: channelTypeSchema.optional(),
  template_id: z.string().uuid().nullable().optional(),
  delay_days: z.number().int().min(0).optional(),
  delay_hours: z.number().int().min(0).optional(),
  ai_personalization: z.boolean().optional(),
});

// Enrollment creation schema
export const createEnrollmentSchema = z.object({
  cadence_id: z.string().uuid('ID da cadência inválido'),
  lead_id: z.string().uuid('ID do lead inválido'),
});

// Batch enrollment schema
export const batchEnrollmentSchema = z.object({
  cadence_id: z.string().uuid('ID da cadência inválido'),
  lead_ids: z.array(z.string().uuid()).min(1, 'Selecione pelo menos um lead').max(500, 'Máximo de 500 leads por vez'),
});

// Template variable extraction regex
export const TEMPLATE_VARIABLE_REGEX = /\{\{(\w+)\}\}/g;

// Available template variables
export const AVAILABLE_TEMPLATE_VARIABLES = [
  'nome_fantasia',
  'razao_social',
  'cnpj',
  'email',
  'telefone',
  'porte',
  'cidade',
  'uf',
  'cnae',
] as const;

export type TemplateVariable = (typeof AVAILABLE_TEMPLATE_VARIABLES)[number];

// Message template creation schema
export const createTemplateSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  channel: channelTypeSchema,
  subject: z.string().max(500).nullable().optional(),
  body: z.string().min(1, 'Corpo da mensagem é obrigatório').max(10000),
}).refine(
  (data) => {
    if (data.channel === 'email' && (!data.subject || data.subject.trim() === '')) {
      return false;
    }
    return true;
  },
  { message: 'Assunto é obrigatório para templates de email', path: ['subject'] },
).refine(
  (data) => {
    if (data.channel === 'whatsapp' && data.body.length > 4096) {
      return false;
    }
    return true;
  },
  { message: 'Mensagens WhatsApp devem ter no máximo 4096 caracteres', path: ['body'] },
);

// Message template update schema
export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  channel: channelTypeSchema.optional(),
  subject: z.string().max(500).nullable().optional(),
  body: z.string().min(1).max(10000).optional(),
});

// Cadence list filters schema
export const cadenceFiltersSchema = z.object({
  status: cadenceStatusSchema.optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
});

// Template list filters schema
export const templateFiltersSchema = z.object({
  channel: channelTypeSchema.optional(),
  search: z.string().optional(),
  is_system: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
});

// Inferred types
export type CreateCadence = z.infer<typeof createCadenceSchema>;
export type UpdateCadence = z.infer<typeof updateCadenceSchema>;
export type CreateCadenceStep = z.infer<typeof createCadenceStepSchema>;
export type UpdateCadenceStep = z.infer<typeof updateCadenceStepSchema>;
export type CreateEnrollment = z.infer<typeof createEnrollmentSchema>;
export type BatchEnrollment = z.infer<typeof batchEnrollmentSchema>;
export type CreateTemplate = z.input<typeof createTemplateSchema>;
export type UpdateTemplate = z.infer<typeof updateTemplateSchema>;
export type CadenceFilters = z.infer<typeof cadenceFiltersSchema>;
export type TemplateFilters = z.infer<typeof templateFiltersSchema>;
