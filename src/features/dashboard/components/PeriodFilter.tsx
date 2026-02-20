'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/shared/components/ui/button';

const periods = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
] as const;

export function PeriodFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get('period') ?? '30d';

  const setPeriod = useCallback(
    (period: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (period === '30d') {
        params.delete('period');
      } else {
        params.set('period', period);
      }
      router.push(`/dashboard?${params.toString()}`);
    },
    [router, searchParams],
  );

  return (
    <div className="flex gap-1">
      {periods.map((p) => (
        <Button
          key={p.value}
          variant={current === p.value ? 'default' : 'outline'}
          size="sm"
          onClick={() => setPeriod(p.value)}
        >
          {p.label}
        </Button>
      ))}
    </div>
  );
}
