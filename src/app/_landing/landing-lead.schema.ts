import { z } from 'zod';

export const landingLeadSchema = z.object({
  name: z.string().min(2, 'Nome é obrigatório'),
  company: z.string().min(1, 'Empresa é obrigatória'),
  email: z.string().email('Email inválido'),
  phone: z.string().min(8, 'Telefone inválido'),
  website: z.string().url('URL inválida'),
  employees: z.string().min(1, 'Selecione o total de funcionários'),
  role: z.string().min(1, 'Selecione seu cargo'),
  sdr_count: z.string().min(1, 'Selecione o número de SDRs'),
  crm: z.string().min(1, 'Selecione o CRM'),
});

export type LandingLeadInput = z.infer<typeof landingLeadSchema>;
