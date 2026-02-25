import { requireAuth } from '@/lib/auth/require-auth';

import { fetchActivityAnalytics } from '@/features/statistics/actions/fetch-activity-analytics';
import { fetchOrgMembers } from '@/features/statistics/actions/shared';
import { ActivityAnalyticsView } from '@/features/statistics/components/ActivityAnalyticsView';

interface PageProps {
  searchParams: Promise<{ period?: string; user?: string }>;
}

export default async function ActivityAnalyticsPage({ searchParams }: PageProps) {
  await requireAuth();
  const params = await searchParams;
  const period = params.period ?? '30d';
  const userIds = params.user ? [params.user] : undefined;

  const [result, members] = await Promise.all([
    fetchActivityAnalytics(period, userIds),
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
      <ActivityAnalyticsView data={result.data} members={members} />
    </div>
  );
}
