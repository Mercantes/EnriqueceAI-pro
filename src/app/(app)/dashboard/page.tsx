import { AlertTriangle } from 'lucide-react';

import { requireAuth } from '@/lib/auth/require-auth';

import { EmptyState } from '@/shared/components/EmptyState';

import { fetchDashboardMetrics } from '@/features/dashboard/actions/fetch-dashboard';
import { DashboardView } from '@/features/dashboard';

interface DashboardPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  await requireAuth();

  const params = await searchParams;
  const period = (params.period as '7d' | '30d' | '90d') ?? '30d';

  const result = await fetchDashboardMetrics(period);

  if (!result.success) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>
        <EmptyState
          icon={AlertTriangle}
          title="Erro ao carregar métricas"
          description={result.error}
        />
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>
      <DashboardView metrics={result.data} />
    </div>
  );
}
