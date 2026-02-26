'use client';

import type { LucideIcon } from 'lucide-react';
import { TrendingDown, TrendingUp } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/shared/components/ui/avatar';

import type { RankingCardData } from '../types';

const AVATAR_COLORS = [
  'bg-blue-500 text-white',
  'bg-emerald-500 text-white',
  'bg-amber-500 text-white',
  'bg-rose-500 text-white',
  'bg-violet-500 text-white',
];

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

interface RankingCardProps {
  title: string;
  icon: LucideIcon;
  iconColor?: string;
  iconTextColor?: string;
  unit?: string;
  data: RankingCardData;
  primaryColumnLabel?: string;
  secondaryColumnLabel?: string;
  averageLabel?: string;
}

export function RankingCard({
  title,
  icon: Icon,
  iconColor = 'bg-primary/10',
  iconTextColor = 'text-primary',
  unit = '',
  data,
  primaryColumnLabel,
  secondaryColumnLabel,
  averageLabel,
}: RankingCardProps) {
  const isAbove = data.percentOfTarget >= 0;
  const absPercent = Math.abs(data.percentOfTarget);

  return (
    <div className="rounded-lg border bg-card p-5">
      {/* Icon Badge */}
      <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl', iconColor)}>
        <Icon className={cn('h-6 w-6', iconTextColor)} />
      </div>

      {/* Big Number */}
      <p className="mt-3 text-3xl font-bold">
        {data.total}
        {unit}
      </p>
      <p className="text-xs text-muted-foreground">{title}</p>

      {/* % + Meta inline */}
      {data.monthTarget > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <div
            className={cn(
              'flex items-center gap-1 text-xs font-medium',
              isAbove ? 'text-emerald-600' : 'text-red-500',
            )}
          >
            {isAbove ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            <span>
              {absPercent}% {isAbove ? 'acima' : 'abaixo'} do previsto
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            Meta mês: <span className="font-medium text-foreground">{data.monthTarget}{unit}</span>
          </span>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">Sem meta definida</p>
      )}

      {/* SDR Breakdown */}
      {data.sdrBreakdown.length > 0 && (
        <>
          {/* Column Headers */}
          <div className="mt-4 border-t pt-3">
            <div className="mb-2 flex items-center text-[11px] font-medium text-muted-foreground">
              <span className="flex-1" />
              {secondaryColumnLabel && (
                <span className="w-20 text-right">{secondaryColumnLabel}</span>
              )}
              {primaryColumnLabel && (
                <span className="w-20 text-right">{primaryColumnLabel}</span>
              )}
            </div>

            {/* SDR List */}
            <div className="space-y-2.5">
              {data.sdrBreakdown.map((sdr, index) => (
                <div key={sdr.userId} className="flex items-center">
                  <Avatar size="sm" className="mr-2 shrink-0">
                    <AvatarFallback
                      className={cn(
                        'text-[10px] font-medium',
                        AVATAR_COLORS[index % AVATAR_COLORS.length],
                      )}
                    >
                      {getInitials(sdr.userName || '?')}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate text-sm">
                    {sdr.userName || sdr.userId.slice(0, 8)}
                  </span>
                  {secondaryColumnLabel && (
                    <span className="w-20 text-right text-sm text-muted-foreground">
                      {sdr.secondaryValue ?? '—'}
                    </span>
                  )}
                  {primaryColumnLabel && (
                    <span className="w-20 text-right text-sm font-medium">
                      {sdr.value}
                      {unit}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Footer — Average */}
          {averageLabel && (
            <div className="mt-3 flex items-center justify-between border-t pt-2.5">
              <span className="text-xs text-muted-foreground">{averageLabel}</span>
              <span className="text-sm font-semibold">
                {data.averagePerSdr}
                {unit}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
