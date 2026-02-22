import type { ActivityLead } from '@/features/activities/types';

import type { LeadRow, LeadAddress, LeadSocio, LeadStatus, EnrichmentStatus } from '../types';

export interface LeadInfoPanelData {
  id: string;
  cnpj: string;
  nome_fantasia: string | null;
  razao_social: string | null;
  email: string | null;
  telefone: string | null;
  porte: string | null;
  cnae: string | null;
  situacao_cadastral: string | null;
  faturamento_estimado: number | null;
  endereco: LeadAddress | null;
  socios: LeadSocio[] | null;
  fit_score: number | null;
  status: LeadStatus | null;
  enrichment_status: EnrichmentStatus | null;
  notes: string | null;
}

export function leadRowToInfoPanelData(lead: LeadRow): LeadInfoPanelData {
  return {
    id: lead.id,
    cnpj: lead.cnpj,
    nome_fantasia: lead.nome_fantasia,
    razao_social: lead.razao_social,
    email: lead.email,
    telefone: lead.telefone,
    porte: lead.porte,
    cnae: lead.cnae,
    situacao_cadastral: lead.situacao_cadastral,
    faturamento_estimado: lead.faturamento_estimado,
    endereco: lead.endereco,
    socios: lead.socios,
    fit_score: lead.fit_score,
    status: lead.status,
    enrichment_status: lead.enrichment_status,
    notes: lead.notes,
  };
}

export function activityLeadToInfoPanelData(lead: ActivityLead): LeadInfoPanelData {
  return {
    id: lead.id,
    cnpj: lead.cnpj,
    nome_fantasia: lead.nome_fantasia,
    razao_social: lead.razao_social,
    email: lead.email,
    telefone: lead.telefone,
    porte: lead.porte,
    cnae: null,
    situacao_cadastral: null,
    faturamento_estimado: null,
    endereco: lead.municipio || lead.uf ? { cidade: lead.municipio ?? undefined, uf: lead.uf ?? undefined } : null,
    socios: null,
    fit_score: null,
    status: null,
    enrichment_status: null,
    notes: null,
  };
}
