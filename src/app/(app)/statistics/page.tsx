import { requireAuth } from '@/lib/auth/require-auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import { fetchStatisticsData } from '@/features/reports/actions/fetch-statistics';
import { StatisticsView } from '@/features/reports/components/StatisticsView';

interface PageProps {
  searchParams: Promise<{ period?: string; user?: string; threshold?: string }>;
}

export default async function StatisticsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const period = params.period ?? '30d';
  const userFilter = params.user;
  const threshold = params.threshold ? parseInt(params.threshold, 10) : 60;

  const userIds = userFilter ? [userFilter] : undefined;

  const [result, members] = await Promise.all([
    fetchStatisticsData(period, userIds, threshold),
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
      <StatisticsView data={result.data} members={members} />
    </div>
  );
}

async function fetchOrgMembers(): Promise<{ userId: string; email: string }[]> {
  const user = await requireAuth();
  const supabase = await createServerSupabaseClient();

  const { data: member } = (await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()) as { data: { org_id: string } | null };

  if (!member) return [];

  const { data: members } = (await supabase
    .from('organization_members')
    .select('user_id, user_email')
    .eq('org_id', member.org_id)
    .eq('status', 'active')) as { data: { user_id: string; user_email: string }[] | null };

  return (members ?? []).map((m) => ({ userId: m.user_id, email: m.user_email }));
}
