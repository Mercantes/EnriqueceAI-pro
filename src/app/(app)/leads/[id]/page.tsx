import { notFound } from 'next/navigation';

import { requireAuth } from '@/lib/auth/require-auth';

import { fetchLeadTimeline } from '@/features/cadences/actions/fetch-interactions';
import { fetchLead } from '@/features/leads/actions/fetch-lead';
import { LeadProfile } from '@/features/leads/components/LeadProfile';

interface LeadDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  await requireAuth();

  const { id } = await params;
  const [leadResult, timelineResult] = await Promise.all([
    fetchLead(id),
    fetchLeadTimeline(id),
  ]);

  if (!leadResult.success) {
    notFound();
  }

  const timeline = timelineResult.success ? timelineResult.data : [];

  return (
    <div className="space-y-4">
      <LeadProfile lead={leadResult.data} timeline={timeline} />
    </div>
  );
}
