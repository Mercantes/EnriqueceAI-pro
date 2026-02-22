import { AlertTriangle } from 'lucide-react';

import { requireAuth } from '@/lib/auth/require-auth';

import { EmptyState } from '@/shared/components/EmptyState';

import { fetchLeads } from '@/features/leads/actions/fetch-leads';
import { fetchLeadsCadenceInfo } from '@/features/leads/actions/fetch-leads-cadence-info';
import { LeadListView } from '@/features/leads/components/LeadListView';

interface LeadsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const user = await requireAuth();

  const params = await searchParams;

  // Build filters from URL search params
  const filters: Record<string, unknown> = {};
  if (params.status) filters.status = params.status;
  if (params.enrichment_status) filters.enrichment_status = params.enrichment_status;
  if (params.porte) filters.porte = params.porte;
  if (params.cnae) filters.cnae = params.cnae;
  if (params.uf) filters.uf = params.uf;
  if (params.search) filters.search = params.search;
  if (params.page) filters.page = params.page;
  if (params.per_page) filters.per_page = params.per_page;
  if (params.sort_by) filters.sort_by = params.sort_by;
  if (params.sort_dir) filters.sort_dir = params.sort_dir;

  const hasFilters = !!(params.status || params.enrichment_status || params.porte || params.cnae || params.uf || params.search);

  const result = await fetchLeads(filters);

  if (!result.success) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Erro ao carregar leads"
        description={result.error}
      />
    );
  }

  // Fetch cadence info in parallel for all returned leads
  const leadIds = result.data.data.map((l) => l.id);
  const cadenceResult = await fetchLeadsCadenceInfo(leadIds);
  const cadenceInfo = cadenceResult.success ? cadenceResult.data : {};

  return (
    <LeadListView
      result={result.data}
      hasFilters={hasFilters}
      cadenceInfo={cadenceInfo}
      currentUserId={user.id}
    />
  );
}
