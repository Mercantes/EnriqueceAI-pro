'use client';

import { Suspense, useState } from 'react';

import { Activity, Settings, TrendingUp, Users } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';

import type { DashboardData, DashboardFilters, InsightsData, RankingData } from '../types';
import { ConversionByOriginChart } from './ConversionByOriginChart';
import { DashboardFilters as DashboardFiltersComponent } from './DashboardFilters';
import { GoalsModal } from './GoalsModal';
import { LossReasonsChart } from './LossReasonsChart';
import { OpportunityKpiCard } from './OpportunityKpiCard';
import { RankingCard } from './RankingCard';

interface DashboardViewProps {
  data: DashboardData;
  filters: DashboardFilters;
  ranking?: RankingData;
  insights?: InsightsData;
}

export function DashboardView({ data, filters, ranking, insights }: DashboardViewProps) {
  const [goalsOpen, setGoalsOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header: Filters + Edit goals button */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Suspense fallback={<Skeleton className="h-8 w-64" />}>
          <DashboardFiltersComponent
            currentFilters={filters}
            availableCadences={data.availableCadences}
          />
        </Suspense>

        <Button variant="outline" size="sm" className="gap-2" onClick={() => setGoalsOpen(true)}>
          <Settings className="h-3.5 w-3.5" />
          Editar metas
        </Button>
      </div>

      <GoalsModal open={goalsOpen} onOpenChange={setGoalsOpen} month={filters.month} />

      {/* KPI + Chart (unified card) */}
      <OpportunityKpiCard kpi={data.kpi} month={filters.month} />

      {/* Ranking Cards (Story 3.3) */}
      {ranking && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3" data-slot="ranking-cards">
          <RankingCard
            title="Leads Finalizados"
            icon={Users}
            data={ranking.leadsFinished}
            secondaryLabel="prospectando"
          />
          <RankingCard
            title="Atividades Realizadas"
            icon={Activity}
            data={ranking.activitiesDone}
          />
          <RankingCard
            title="Taxa de Conversão"
            icon={TrendingUp}
            unit="%"
            data={ranking.conversionRate}
          />
        </div>
      )}

      {/* Insights Charts (Story 3.4) */}
      {insights && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2" data-slot="insights-charts">
          <LossReasonsChart data={insights.lossReasons} />
          <ConversionByOriginChart data={insights.conversionByOrigin} />
        </div>
      )}
    </div>
  );
}
