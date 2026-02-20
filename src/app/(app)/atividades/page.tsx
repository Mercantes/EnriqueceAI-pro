import { AlertTriangle } from 'lucide-react';

import { requireAuth } from '@/lib/auth/require-auth';

import { EmptyState } from '@/shared/components/EmptyState';

import { fetchPendingActivities } from '@/features/activities/actions/fetch-pending-activities';
import { ActivityQueueView } from '@/features/activities';

export default async function AtividadesPage() {
  await requireAuth();

  const result = await fetchPendingActivities();

  if (!result.success) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold">Atividades</h1>
        <EmptyState
          icon={AlertTriangle}
          title="Erro ao carregar atividades"
          description={result.error}
        />
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Atividades</h1>
      <ActivityQueueView initialActivities={result.data} />
    </div>
  );
}
