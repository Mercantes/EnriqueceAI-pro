import { z } from 'zod';

export const LEAD_FIELDS = [
  { value: 'email', label: 'Email' },
  { value: 'telefone', label: 'Telefone' },
  { value: 'razao_social', label: 'Razão Social' },
  { value: 'nome_fantasia', label: 'Nome Fantasia' },
  { value: 'porte', label: 'Porte' },
  { value: 'cnae', label: 'CNAE' },
  { value: 'situacao_cadastral', label: 'Situação Cadastral' },
  { value: 'faturamento_estimado', label: 'Faturamento Estimado' },
  { value: 'uf', label: 'UF' },
  { value: 'notes', label: 'Notas' },
] as const;

export const OPERATORS = [
  { value: 'contains', label: 'Contém' },
  { value: 'equals', label: 'É igual a' },
  { value: 'not_empty', label: 'Não é vazio' },
  { value: 'starts_with', label: 'Começa com' },
] as const;

export const fitScoreRuleSchema = z.object({
  id: z.string().uuid().optional(),
  points: z.number().int().refine((v) => v !== 0, 'Pontos não pode ser zero'),
  field: z.string().min(1, 'Campo é obrigatório'),
  operator: z.enum(['contains', 'equals', 'not_empty', 'starts_with']),
  value: z.string().nullable(),
});

export const fitScoreRulesArraySchema = z.array(fitScoreRuleSchema).max(50);

export type FitScoreRuleInput = z.infer<typeof fitScoreRuleSchema>;
