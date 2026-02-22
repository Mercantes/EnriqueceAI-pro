import { AlertTriangle } from 'lucide-react';

import { requireAuth } from '@/lib/auth/require-auth';

import { EmptyState } from '@/shared/components/EmptyState';

import { fetchActivityLog } from '@/features/activities/actions/fetch-activity-log';
import { ActivityLogView } from '@/features/activities/components/ActivityLogView';

interface ActivitiesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ActivitiesPage({ searchParams }: ActivitiesPageProps) {
  await requireAuth();

  const params = await searchParams;

  const filters: Record<string, unknown> = {};
  if (params.status) filters.status = params.status;
  if (params.channel) filters.channel = params.channel;
  if (params.search) filters.search = params.search;

  const result = await fetchActivityLog(filters);

  if (!result.success) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Erro ao carregar atividades"
        description={result.error}
      />
    );
  }

  const hasFilters = !!(params.status || params.channel || params.search);

  return (
    <ActivityLogView
      activities={result.data.activities}
      total={result.data.total}
      hasFilters={hasFilters}
    />
  );
}
