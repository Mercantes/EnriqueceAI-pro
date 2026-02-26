'use client';

import { BarChart3, CalendarDays, TrendingDown, TrendingUp } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { cn } from '@/lib/utils';

import type { DailyDataPoint, OpportunityKpiData } from '../types';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function getMonthName(month: string): string {
  const [, mon] = month.split('-').map(Number) as [number, number];
  return MONTH_NAMES[mon - 1] ?? month;
}

function formatXAxis(day: number, daysInMonth: number): string {
  if (day === 1) return '1';
  if (day === Math.round(daysInMonth / 2)) return `${day}`;
  if (day === daysInMonth) return `${day}`;
  return '';
}

interface OpportunityKpiCardProps {
  kpi: OpportunityKpiData;
  month: string;
}

export function OpportunityKpiCard({ kpi, month }: OpportunityKpiCardProps) {
  const monthName = getMonthName(month);
  const monthNameLower = monthName.toLowerCase();
  const isAbove = kpi.percentOfTarget >= 0;
  const absPercent = Math.abs(kpi.percentOfTarget);
  const expectedByNow = kpi.monthTarget > 0
    ? Math.round((kpi.monthTarget / kpi.daysInMonth) * kpi.currentDay)
    : 0;

  // Chart data — only show "actual" up to current day
  const chartData = kpi.dailyData.map((point: DailyDataPoint) => ({
    ...point,
    actual: point.day <= kpi.currentDay ? point.actual : null,
  }));

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Left side — KPI info */}
        <div className="flex shrink-0 flex-col justify-center lg:w-[280px]">
          {/* Big number */}
          <p className="text-5xl font-bold">{kpi.totalOpportunities}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Oportunidades em {monthName}
          </p>

          {/* Meta row */}
          {kpi.monthTarget > 0 && (
            <div className="mt-5 flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <CalendarDays className="h-4 w-4 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                Meta de oportunidades para {monthNameLower}:{' '}
                <span className="font-semibold text-foreground">{kpi.monthTarget}</span>
              </p>
            </div>
          )}

          {/* % indicator row */}
          {kpi.monthTarget > 0 && (
            <div className="mt-3 flex items-start gap-3">
              <div className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                isAbove ? 'bg-emerald-500/10' : 'bg-red-500/10',
              )}>
                <BarChart3 className={cn('h-4 w-4', isAbove ? 'text-emerald-500' : 'text-red-500')} />
              </div>
              <div className="flex items-center gap-1.5">
                {isAbove ? (
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                <p className={cn('text-sm font-medium', isAbove ? 'text-emerald-500' : 'text-red-500')}>
                  {absPercent}% {isAbove ? 'acima' : 'abaixo'} do previsto até hoje ({expectedByNow})
                </p>
              </div>
            </div>
          )}

          {kpi.monthTarget === 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              Nenhuma meta definida para {monthNameLower}
            </p>
          )}
        </div>

        {/* Right side — Chart */}
        <div className="min-h-[240px] flex-1">
          {kpi.dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                <defs>
                  <linearGradient id="gradientOpp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground"
                  tickFormatter={(day: number) => formatXAxis(day, kpi.daysInMonth)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground"
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  labelFormatter={(day) => `Dia ${day}`}
                />
                <Legend
                  iconType="plainline"
                  wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                />
                <Area
                  type="monotone"
                  dataKey="actual"
                  name="Oportunidades"
                  stroke="#22c55e"
                  strokeWidth={2}
                  fill="url(#gradientOpp)"
                  dot={false}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="target"
                  name="Meta"
                  stroke="var(--muted-foreground)"
                  strokeWidth={1.5}
                  strokeDasharray="5 5"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">Sem dados para exibir</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
