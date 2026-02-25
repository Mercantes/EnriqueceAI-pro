import { requireAuth } from '@/lib/auth/require-auth';

import { fetchCallStatistics } from '@/features/statistics/actions/fetch-call-statistics';
import { fetchOrgMembers } from '@/features/statistics/actions/shared';
import { CallStatisticsView } from '@/features/statistics/components/CallStatisticsView';

interface PageProps {
  searchParams: Promise<{ period?: string; user?: string }>;
}

export default async function CallStatisticsPage({ searchParams }: PageProps) {
  await requireAuth();
  const params = await searchParams;
  const period = params.period ?? '30d';
  const userIds = params.user ? [params.user] : undefined;

  const [result, members] = await Promise.all([
    fetchCallStatistics(period, userIds),
    fetchOrgMembers(),
  ]);

  if (!result.success) {
    return (
      <div className="p-6">
        <p className="text-[var(--destructive)]">Erro: {result.error}</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <CallStatisticsView data={result.data} members={members} />
    </div>
  );
}
