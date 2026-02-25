import { requireAuth } from '@/lib/auth/require-auth';

import { fetchExtrato } from '@/features/calls/actions/fetch-extrato';
import { ExtratoView } from '@/features/calls/components/ExtratoView';
import { fetchOrgMembers } from '@/features/statistics/actions/shared';

interface PageProps {
  searchParams: Promise<{ period?: string; user?: string }>;
}

export default async function ExtratoPage({ searchParams }: PageProps) {
  await requireAuth();
  const params = await searchParams;
  const period = params.period ?? '30d';
  const userIds = params.user ? [params.user] : undefined;

  const [result, members] = await Promise.all([
    fetchExtrato(period, userIds),
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
      <ExtratoView
        data={result.data}
        members={members}
        period={period}
        userId={params.user}
      />
    </div>
  );
}
