import { cleanCompanyName } from './clean-company-name';

/**
 * Minimal lead shape accepted by the variable builder.
 * Both EnrollmentWithLead.lead and ActivityLead satisfy this.
 */
export interface LeadForVariables {
  nome_fantasia: string | null;
  razao_social: string | null;
  cnpj: string;
  email: string | null;
  telefone: string | null;
  municipio: string | null;
  uf: string | null;
  porte: string | null;
  primeiro_nome?: string | null;
}

/**
 * Builds the lead-side template variables record.
 *
 * When `primeiro_nome` is not pre-computed on the lead,
 * pass `socioNome` (the primary sócio's full name) so it can be derived.
 */
export function buildLeadTemplateVariables(
  lead: LeadForVariables,
  socioNome?: string | null,
): Record<string, string | null> {
  const primeiroNome =
    lead.primeiro_nome ??
    (socioNome ? socioNome.trim().split(/\s+/)[0] ?? null : null);

  return {
    primeiro_nome: primeiroNome,
    empresa: cleanCompanyName(lead.nome_fantasia ?? lead.razao_social),
    nome_fantasia: lead.nome_fantasia,
    razao_social: lead.razao_social,
    cnpj: lead.cnpj,
    email: lead.email,
    telefone: lead.telefone,
    municipio: lead.municipio,
    uf: lead.uf,
    porte: lead.porte,
  };
}
