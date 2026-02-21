'use client';

import { TrendingDown, TrendingUp } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { OpportunityKpiData } from '../types';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function getMonthName(month: string): string {
  const [, mon] = month.split('-').map(Number) as [number, number];
  return MONTH_NAMES[mon - 1] ?? month;
}

interface OpportunityKpiCardProps {
  kpi: OpportunityKpiData;
  month: string;
}

export function OpportunityKpiCard({ kpi, month }: OpportunityKpiCardProps) {
  const monthName = getMonthName(month);
  const isAbove = kpi.percentOfTarget >= 0;
  const absPercent = Math.abs(kpi.percentOfTarget);

  return (
    <div className="rounded-lg border bg-card p-6">
      {/* Main KPI */}
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">
          Oportunidades em {monthName}
        </p>
        <p className="mt-1 text-4xl font-bold">{kpi.totalOpportunities}</p>
      </div>

      {/* Target */}
      {kpi.monthTarget > 0 && (
        <div className="mb-3">
          <p className="text-sm text-muted-foreground">
            Meta de oportunidades para {monthName}:{' '}
            <span className="font-semibold text-foreground">
              {kpi.monthTarget}
            </span>
          </p>
        </div>
      )}

      {/* % indicator */}
      {kpi.monthTarget > 0 && (
        <div
          className={cn(
            'flex items-center gap-1.5 text-sm font-medium',
            isAbove ? 'text-emerald-600' : 'text-red-500',
          )}
        >
          {isAbove ? (
            <TrendingUp className="h-4 w-4" />
          ) : (
            <TrendingDown className="h-4 w-4" />
          )}
          <span>
            {absPercent}% {isAbove ? 'acima' : 'abaixo'} do previsto até hoje
            (dia {kpi.currentDay})
          </span>
        </div>
      )}

      {/* No target message */}
      {kpi.monthTarget === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhuma meta definida para {monthName}
        </p>
      )}
    </div>
  );
}
