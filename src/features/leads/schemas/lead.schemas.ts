import { z } from 'zod';

import { isValidCnpj, stripCnpj } from '../utils/cnpj';

export const leadStatusValues = ['new', 'contacted', 'qualified', 'unqualified', 'archived'] as const;
export const enrichmentStatusValues = ['pending', 'enriching', 'enriched', 'enrichment_failed', 'not_found'] as const;
export const importStatusValues = ['processing', 'completed', 'failed'] as const;

export const cnpjSchema = z
  .string()
  .min(1, 'CNPJ é obrigatório')
  .transform(stripCnpj)
  .refine(isValidCnpj, { message: 'CNPJ inválido' });

export const leadStatusSchema = z.enum(leadStatusValues);
export const enrichmentStatusSchema = z.enum(enrichmentStatusValues);
export const importStatusSchema = z.enum(importStatusValues);

export const leadAddressSchema = z.object({
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().max(2).optional(),
  cep: z.string().optional(),
});

export const createLeadSchema = z.object({
  cnpj: cnpjSchema,
  razao_social: z.string().min(1).optional(),
  nome_fantasia: z.string().min(1).optional(),
});

export const leadFiltersSchema = z.object({
  status: leadStatusSchema.optional(),
  enrichment_status: enrichmentStatusSchema.optional(),
  porte: z.string().optional(),
  cnae: z.string().optional(),
  uf: z.string().max(2).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  per_page: z.coerce.number().int().positive().max(100).default(20),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type LeadFilters = z.infer<typeof leadFiltersSchema>;
