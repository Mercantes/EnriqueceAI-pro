import { requireAuth } from '@/lib/auth/require-auth';

import { fetchConversionAnalytics } from '@/features/statistics/actions/fetch-conversion-analytics';
import { fetchOrgMembers } from '@/features/statistics/actions/shared';
import { ConversionAnalyticsView } from '@/features/statistics/components/ConversionAnalyticsView';

interface PageProps {
  searchParams: Promise<{ period?: string; user?: string; cadence?: string }>;
}

export default async function ConversionAnalyticsPage({ searchParams }: PageProps) {
  await requireAuth();
  const params = await searchParams;
  const period = params.period ?? '30d';
  const userIds = params.user ? [params.user] : undefined;
  const cadenceId = params.cadence || undefined;

  const [result, members] = await Promise.all([
    fetchConversionAnalytics(period, userIds, cadenceId),
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
      <ConversionAnalyticsView data={result.data} members={members} />
    </div>
  );
}
