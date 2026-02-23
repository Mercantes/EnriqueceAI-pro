import { AlertTriangle } from 'lucide-react';

import { requireAuth } from '@/lib/auth/require-auth';

import { EmptyState } from '@/shared/components/EmptyState';

import { fetchDailyProgress } from '@/features/activities/actions/fetch-daily-progress';
import { fetchDialerQueue } from '@/features/activities/actions/fetch-dialer-queue';
import { fetchPendingActivities } from '@/features/activities/actions/fetch-pending-activities';
import { fetchPendingCalls } from '@/features/activities/actions/fetch-pending-calls';
import { ActivityQueueView } from '@/features/activities';

export default async function AtividadesPage() {
  await requireAuth();

  const [activitiesResult, progressResult, callsResult, dialerResult] = await Promise.all([
    fetchPendingActivities(),
    fetchDailyProgress(),
    fetchPendingCalls(),
    fetchDialerQueue(),
  ]);

  if (!activitiesResult.success) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold">Atividades</h1>
        <EmptyState
          icon={AlertTriangle}
          title="Erro ao carregar atividades"
          description={activitiesResult.error}
        />
      </div>
    );
  }

  const progress = progressResult.success
    ? progressResult.data
    : { completed: 0, pending: 0, total: 0, target: 20 };

  const pendingCalls = callsResult.success ? callsResult.data : [];
  const dialerQueue = dialerResult.success ? dialerResult.data : [];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Atividades</h1>
      <ActivityQueueView
        initialActivities={activitiesResult.data}
        progress={progress}
        pendingCalls={pendingCalls}
        dialerQueue={dialerQueue}
      />
    </div>
  );
}
