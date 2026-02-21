import { Suspense } from 'react';
import { AlertTriangle } from 'lucide-react';

import { requireAuth } from '@/lib/auth/require-auth';

import { EmptyState } from '@/shared/components/EmptyState';
import { Skeleton } from '@/shared/components/ui/skeleton';

import { fetchCadences, fetchCadenceTabCounts } from '@/features/cadences/actions/fetch-cadences';
import { CadenceListView } from '@/features/cadences/components/CadenceListView';

interface CadencesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CadencesPage({ searchParams }: CadencesPageProps) {
  await requireAuth();
  const params = await searchParams;

  const status = typeof params.status === 'string' ? params.status : undefined;
  const search = typeof params.search === 'string' ? params.search : undefined;
  const type = typeof params.type === 'string' ? params.type : undefined;
  const priority = typeof params.priority === 'string' ? params.priority : undefined;
  const origin = typeof params.origin === 'string' ? params.origin : undefined;
  const page = typeof params.page === 'string' ? parseInt(params.page, 10) : 1;

  const [result, countsResult] = await Promise.all([
    fetchCadences({ status, search, type: type || 'standard', priority, origin, page }),
    fetchCadenceTabCounts(),
  ]);

  if (!result.success) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Erro ao carregar cadências"
        description={result.error}
      />
    );
  }

  const tabCounts = countsResult.success
    ? countsResult.data
    : { standard: 0, auto_email: 0 };

  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <CadenceListView
        cadences={result.data.data}
        total={result.data.total}
        page={result.data.page}
        perPage={result.data.per_page}
        tabCounts={tabCounts}
      />
    </Suspense>
  );
}
