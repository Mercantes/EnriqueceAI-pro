import { notFound } from 'next/navigation';

import { requireAuth } from '@/lib/auth/require-auth';

import { fetchCadenceDetail } from '@/features/cadences/actions/fetch-cadences';
import { fetchCadenceEnrollments } from '@/features/cadences/actions/manage-enrollments';
import { fetchCadenceMetrics } from '@/features/cadences/actions/fetch-interactions';
import { fetchTemplates } from '@/features/templates/actions/fetch-templates';
import { CadenceBuilder } from '@/features/cadences/components/CadenceBuilder';

interface CadenceDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CadenceDetailPage({ params }: CadenceDetailPageProps) {
  await requireAuth();
  const { id } = await params;

  const [cadenceResult, templatesResult, metricsResult, enrollmentsResult] = await Promise.all([
    fetchCadenceDetail(id),
    fetchTemplates({ per_page: 100 }),
    fetchCadenceMetrics(id),
    fetchCadenceEnrollments(id),
  ]);

  if (!cadenceResult.success) {
    notFound();
  }

  const templates = templatesResult.success ? templatesResult.data.data : [];
  const metrics = metricsResult.success ? metricsResult.data : undefined;
  const enrollments = enrollmentsResult.success ? enrollmentsResult.data.data : [];

  return (
    <CadenceBuilder
      cadence={cadenceResult.data}
      templates={templates}
      metrics={metrics}
      enrollments={enrollments}
    />
  );
}
