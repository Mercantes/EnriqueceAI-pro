import { fetchOrgMembers } from '@/features/statistics/actions/shared';
import { fetchTeamAnalytics } from '@/features/statistics/actions/fetch-team-analytics';
import { TeamAnalyticsView } from '@/features/statistics/components/TeamAnalyticsView';

interface PageProps {
  searchParams: Promise<{ period?: string }>;
}

export default async function TeamAnalyticsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const period = params.period ?? '30d';

  const [result, members] = await Promise.all([
    fetchTeamAnalytics(period),
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
      <TeamAnalyticsView data={result.data} members={members} />
    </div>
  );
}
