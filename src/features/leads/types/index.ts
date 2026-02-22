// Lead status enums matching database
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'unqualified' | 'archived';
export type EnrichmentStatus = 'pending' | 'enriching' | 'enriched' | 'enrichment_failed' | 'not_found';
export type ImportStatus = 'processing' | 'completed' | 'failed';
export type EnrichmentProvider = 'cnpj_ws' | 'lemit';

// Lead address (stored as JSONB)
export interface LeadAddress {
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
}

// Lead partner/socio (stored as JSONB array)
export interface LeadSocio {
  nome: string;
  qualificacao?: string;
  cpf_masked?: string;
}

// Lead row matching database table
export interface LeadRow {
  id: string;
  org_id: string;
  cnpj: string;
  status: LeadStatus;
  enrichment_status: EnrichmentStatus;
  razao_social: string | null;
  nome_fantasia: string | null;
  endereco: LeadAddress | null;
  porte: string | null;
  cnae: string | null;
  situacao_cadastral: string | null;
  email: string | null;
  telefone: string | null;
  socios: LeadSocio[] | null;
  faturamento_estimado: number | null;
  notes: string | null;
  fit_score: number | null;
  enriched_at: string | null;
  created_by: string | null;
  import_id: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

// Lead import row matching database table
export interface LeadImportRow {
  id: string;
  org_id: string;
  file_name: string;
  total_rows: number;
  processed_rows: number;
  success_count: number;
  error_count: number;
  status: ImportStatus;
  created_by: string | null;
  created_at: string;
}

// Lead import error row matching database table
export interface LeadImportErrorRow {
  id: string;
  import_id: string;
  row_number: number;
  cnpj: string | null;
  error_message: string;
  created_at: string;
}

// Enrichment attempt row matching database table
export interface EnrichmentAttemptRow {
  id: string;
  lead_id: string;
  provider: EnrichmentProvider;
  status: EnrichmentStatus;
  response_data: Record<string, unknown> | null;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
}

// Insert types (without auto-generated fields)
export interface LeadInsert {
  org_id: string;
  cnpj: string;
  status?: LeadStatus;
  enrichment_status?: EnrichmentStatus;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  endereco?: LeadAddress | null;
  porte?: string | null;
  cnae?: string | null;
  situacao_cadastral?: string | null;
  email?: string | null;
  telefone?: string | null;
  socios?: LeadSocio[] | null;
  faturamento_estimado?: number | null;
  created_by?: string | null;
  import_id?: string | null;
}

export interface LeadImportInsert {
  org_id: string;
  file_name: string;
  total_rows: number;
  created_by?: string | null;
}

export interface LeadImportErrorInsert {
  import_id: string;
  row_number: number;
  cnpj?: string | null;
  error_message: string;
}
