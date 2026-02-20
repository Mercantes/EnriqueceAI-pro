import type {
  EnrichmentAttemptRow,
  LeadImportErrorRow,
  LeadImportRow,
  LeadRow,
} from './types';

export type { LeadRow, LeadImportRow, LeadImportErrorRow, EnrichmentAttemptRow };

export interface LeadListResult {
  data: LeadRow[];
  total: number;
  page: number;
  per_page: number;
}

export interface ImportResult {
  import_id: string;
  total_rows: number;
  success_count: number;
  error_count: number;
  errors: LeadImportErrorRow[];
}
