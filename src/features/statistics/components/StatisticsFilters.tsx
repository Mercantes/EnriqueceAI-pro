'use client';

import { useCallback, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/shared/components/ui/button';

import type { OrgMember, StatisticsPeriod } from '../types/shared';
import { periodOptions } from '../types/shared';

interface StatisticsFiltersProps {
  basePath: string;
  members: OrgMember[];
  periods?: StatisticsPeriod[];
  children?: React.ReactNode;
}

export function StatisticsFilters({
  basePath,
  members,
  periods,
  children,
}: StatisticsFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentPeriod = searchParams.get('period') ?? '30d';
  const currentUser = searchParams.get('user') ?? '';

  const updateParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (!value || value === '' || (key === 'period' && value === '30d')) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `${basePath}?${qs}` : basePath);
      });
    },
    [router, searchParams, startTransition, basePath],
  );

  const visiblePeriods = periods
    ? periodOptions.filter((p) => periods.includes(p.value))
    : periodOptions;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${isPending ? 'opacity-70' : ''}`}>
      <div className="flex gap-1">
        {visiblePeriods.map((p) => (
          <Button
            key={p.value}
            variant={currentPeriod === p.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => updateParams({ period: p.value })}
          >
            {p.label}
          </Button>
        ))}
      </div>
      <select
        value={currentUser}
        onChange={(e) => updateParams({ user: e.target.value || undefined })}
        className="h-8 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-sm"
      >
        <option value="">Todos os vendedores</option>
        {members.map((m) => (
          <option key={m.userId} value={m.userId}>
            {m.email.split('@')[0]}
          </option>
        ))}
      </select>
      {children}
    </div>
  );
}

export function useStatisticsParams() {
  const searchParams = useSearchParams();
  return {
    period: searchParams.get('period') ?? '30d',
    userId: searchParams.get('user') ?? '',
    cadence: searchParams.get('cadence') ?? '',
  };
}
