import { Suspense } from 'react';
import { AlertTriangle } from 'lucide-react';

import { requireAuth } from '@/lib/auth/require-auth';

import { EmptyState } from '@/shared/components/EmptyState';
import { Skeleton } from '@/shared/components/ui/skeleton';

import { fetchCadences } from '@/features/cadences/actions/fetch-cadences';
import { CadenceListView } from '@/features/cadences/components/CadenceListView';

interface CadencesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CadencesPage({ searchParams }: CadencesPageProps) {
  await requireAuth();
  const params = await searchParams;

  const status = typeof params.status === 'string' ? params.status : undefined;
  const search = typeof params.search === 'string' ? params.search : undefined;
  const page = typeof params.page === 'string' ? parseInt(params.page, 10) : 1;

  const result = await fetchCadences({ status, search, page });

  if (!result.success) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Erro ao carregar cadências"
        description={result.error}
      />
    );
  }

  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <CadenceListView
        cadences={result.data.data}
        total={result.data.total}
        page={result.data.page}
        perPage={result.data.per_page}
      />
    </Suspense>
  );
}
