export interface DashboardMetrics {
  leadsByStatus: Record<string, number>;
  totalLeads: number;
  recentImports: ImportSummary[];
  enrichmentStats: EnrichmentStats;
  leadsByPorte: Record<string, number>;
  leadsByUf: Record<string, number>;
}

export interface ImportSummary {
  id: string;
  file_name: string;
  total_rows: number;
  success_count: number;
  error_count: number;
  status: string;
  created_at: string;
}

export interface EnrichmentStats {
  total: number;
  enriched: number;
  pending: number;
  failed: number;
  notFound: number;
  successRate: number;
}
