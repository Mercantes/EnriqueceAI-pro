'use client';

import { Suspense } from 'react';
import { CheckCircle2, Clock, Search, Users } from 'lucide-react';

import { Skeleton } from '@/shared/components/ui/skeleton';

import type { DashboardMetrics } from '../dashboard.contract';
import { DistributionCard } from './DistributionCard';
import { EmptyDashboard } from './EmptyDashboard';
import { EnrichmentCard } from './EnrichmentCard';
import { MetricCard } from './MetricCard';
import { PeriodFilter } from './PeriodFilter';
import { RecentImports } from './RecentImports';

interface DashboardViewProps {
  metrics: DashboardMetrics;
}

const statusLabels: Record<string, string> = {
  new: 'Novos',
  contacted: 'Contatados',
  qualified: 'Qualificados',
  unqualified: 'Não Qualificados',
  archived: 'Arquivados',
};

export function DashboardView({ metrics }: DashboardViewProps) {
  if (metrics.totalLeads === 0 && metrics.recentImports.length === 0) {
    return <EmptyDashboard />;
  }

  const newLeads = metrics.leadsByStatus['new'] ?? 0;
  const qualified = metrics.leadsByStatus['qualified'] ?? 0;

  // Translate status keys for display
  const translatedStatus: Record<string, number> = {};
  for (const [key, value] of Object.entries(metrics.leadsByStatus)) {
    translatedStatus[statusLabels[key] ?? key] = value;
  }

  return (
    <div className="space-y-6">
      {/* Period filter */}
      <div className="flex items-center justify-end">
        <Suspense fallback={<Skeleton className="h-8 w-48" />}>
          <PeriodFilter />
        </Suspense>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total de Leads"
          value={metrics.totalLeads}
          icon={Users}
          description={`${newLeads} novo${newLeads !== 1 ? 's' : ''}`}
        />
        <MetricCard
          title="Qualificados"
          value={qualified}
          icon={CheckCircle2}
          description={`${metrics.totalLeads > 0 ? Math.round((qualified / metrics.totalLeads) * 100) : 0}% do total`}
        />
        <MetricCard
          title="Enriquecidos"
          value={metrics.enrichmentStats.enriched}
          icon={Search}
          description={`${metrics.enrichmentStats.successRate}% taxa de sucesso`}
        />
        <MetricCard
          title="Pendentes"
          value={metrics.enrichmentStats.pending}
          icon={Clock}
          description="aguardando enriquecimento"
        />
      </div>

      {/* Detail cards grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <RecentImports imports={metrics.recentImports} />
        <EnrichmentCard stats={metrics.enrichmentStats} />
        <DistributionCard title="Leads por Porte" data={metrics.leadsByPorte} />
        <DistributionCard title="Leads por Estado" data={metrics.leadsByUf} />
      </div>
    </div>
  );
}
