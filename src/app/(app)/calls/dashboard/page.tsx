import { requireAuth } from '@/lib/auth/require-auth';

import { fetchCallDashboard } from '@/features/statistics/actions/fetch-call-dashboard';
import { fetchOrgMembers } from '@/features/statistics/actions/shared';
import { CallDashboardView } from '@/features/statistics/components/CallDashboardView';

interface PageProps {
  searchParams: Promise<{ period?: string; user?: string }>;
}

export default async function CallDashboardPage({ searchParams }: PageProps) {
  await requireAuth();
  const params = await searchParams;
  const period = params.period ?? '30d';
  const userIds = params.user ? [params.user] : undefined;

  const [result, members] = await Promise.all([
    fetchCallDashboard(period, userIds),
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
      <CallDashboardView data={result.data} members={members} />
    </div>
  );
}
