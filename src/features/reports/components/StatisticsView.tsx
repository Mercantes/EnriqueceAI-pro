'use client';

import { useCallback, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/shared/components/ui/button';

import type { StatisticsData } from '../services/statistics.service';
import { ConversionByOriginChart } from './ConversionByOriginChart';
import { LossReasonsChart } from './LossReasonsChart';
import { ResponseTimeSection } from './ResponseTimeSection';
import { TimeIntervalModal } from './TimeIntervalModal';

interface StatisticsViewProps {
  data: StatisticsData;
  members: { userId: string; email: string }[];
}

const periods = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
] as const;

export function StatisticsView({ data, members }: StatisticsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [intervalModalOpen, setIntervalModalOpen] = useState(false);

  const currentPeriod = searchParams.get('period') ?? '30d';
  const currentUser = searchParams.get('user') ?? '';
  const currentThreshold = parseInt(searchParams.get('threshold') ?? '60', 10);

  const updateParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (!value || value === '' || (key === 'period' && value === '30d') || (key === 'threshold' && value === '60')) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      startTransition(() => {
        router.push(`/statistics?${params.toString()}`);
      });
    },
    [router, searchParams, startTransition],
  );

  const memberNames = new Map(members.map((m) => [m.userId, m.email.split('@')[0] ?? m.email]));

  return (
    <div className={`space-y-6 ${isPending ? 'opacity-70' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Estatísticas</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Insights de motivos de perda, conversão e tempo de resposta.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Period filter */}
          <div className="flex gap-1">
            {periods.map((p) => (
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
          {/* User filter */}
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
        </div>
      </div>

      {/* Charts grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Loss Reasons */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <h2 className="mb-4 text-lg font-semibold">Motivos de Perda</h2>
          <LossReasonsChart data={data.lossReasons} />
        </div>

        {/* Conversion by Origin */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
          <h2 className="mb-4 text-lg font-semibold">Conversão por Origem</h2>
          <ConversionByOriginChart data={data.conversionByOrigin} memberNames={memberNames} />
        </div>
      </div>

      {/* Response Time (full width) */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="mb-4 text-lg font-semibold">Tempo de Resposta</h2>
        <ResponseTimeSection
          data={data.responseTime}
          onOpenIntervalModal={() => setIntervalModalOpen(true)}
        />
      </div>

      {/* Interval Modal */}
      <TimeIntervalModal
        open={intervalModalOpen}
        onOpenChange={setIntervalModalOpen}
        currentMinutes={currentThreshold}
        onConfirm={(minutes) => updateParams({ threshold: String(minutes) })}
      />
    </div>
  );
}
