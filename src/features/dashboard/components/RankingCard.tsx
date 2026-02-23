'use client';

import type { LucideIcon } from 'lucide-react';
import { TrendingDown, TrendingUp } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { RankingCardData } from '../types';

interface RankingCardProps {
  title: string;
  icon: LucideIcon;
  unit?: string; // e.g., "%" for conversion rate
  data: RankingCardData;
  secondaryLabel?: string; // e.g., "prospectando" for leads card
}

export function RankingCard({
  title,
  icon: Icon,
  unit = '',
  data,
  secondaryLabel,
}: RankingCardProps) {
  const isAbove = data.percentOfTarget >= 0;
  const absPercent = Math.abs(data.percentOfTarget);

  return (
    <div className="rounded-lg border bg-card p-5">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      </div>

      {/* Main value */}
      <p className="text-3xl font-bold">
        {data.total}
        {unit}
      </p>

      {/* Target + % indicator */}
      {data.monthTarget > 0 ? (
        <div className="mt-2 space-y-1">
          <p className="text-xs text-muted-foreground">
            Meta: <span className="font-medium text-foreground">{data.monthTarget}{unit}</span>
          </p>
          <div
            className={cn(
              'flex items-center gap-1 text-xs font-medium',
              isAbove ? 'text-emerald-600' : 'text-red-500',
            )}
          >
            {isAbove ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span>
              {absPercent}% {isAbove ? 'acima' : 'abaixo'} do previsto
            </span>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">Sem meta definida</p>
      )}

      {/* SDR Breakdown */}
      {data.sdrBreakdown.length > 0 && (
        <div className="mt-4 border-t pt-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Por vendedor
          </p>
          <div className="space-y-2">
            {data.sdrBreakdown.map((sdr) => (
              <div
                key={sdr.userId}
                className="flex items-center justify-between text-sm"
              >
                <span className="truncate text-muted-foreground">
                  {sdr.userName || sdr.userId.slice(0, 8)}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {sdr.value}
                    {unit}
                  </span>
                  {secondaryLabel && sdr.secondaryValue !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      ({sdr.secondaryValue} {secondaryLabel})
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Average */}
      {data.sdrBreakdown.length > 0 && (
        <div className="mt-3 border-t pt-2">
          <p className="text-xs text-muted-foreground">
            Média/vendedor:{' '}
            <span className="font-medium text-foreground">
              {data.averagePerSdr}
              {unit}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
