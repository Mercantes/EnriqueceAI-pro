import { BarChart3 } from 'lucide-react';

import { requireAuth } from '@/lib/auth/require-auth';

import { EmptyState } from '@/shared/components/EmptyState';

import { fetchReportData } from '@/features/reports/actions/fetch-reports';
import { ReportsView } from '@/features/reports/components/ReportsView';
import type { ReportPeriod } from '@/features/reports/reports.contract';

interface ReportsPageProps {
  searchParams: Promise<{ period?: string }>;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  await requireAuth();

  const params = await searchParams;
  const period = (['7d', '30d', '90d'].includes(params.period ?? '')
    ? params.period
    : '30d') as ReportPeriod;

  const result = await fetchReportData(period);

  if (!result.success) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Relatórios"
        description={result.error}
      />
    );
  }

  return <ReportsView data={result.data} />;
}
