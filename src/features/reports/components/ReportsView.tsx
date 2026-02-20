'use client';

import { useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Download } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';

import type { ReportData, ReportView } from '../reports.contract';
import { cadenceMetricsToCsv, downloadCsv, sdrMetricsToCsv } from '../utils/csv-export';
import { CadenceReport } from './CadenceReport';
import { OverallReport } from './OverallReport';
import { SdrReport } from './SdrReport';

interface ReportsViewProps {
  data: ReportData;
}

const tabs: { value: ReportView; label: string }[] = [
  { value: 'overall', label: 'Geral' },
  { value: 'cadence', label: 'Por Cadência' },
  { value: 'sdr', label: 'Por SDR' },
];

const periods = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
] as const;

export function ReportsView({ data }: ReportsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<ReportView>(
    (searchParams.get('view') as ReportView) ?? 'overall',
  );
  const currentPeriod = searchParams.get('period') ?? '30d';

  const setPeriod = useCallback(
    (period: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (period === '30d') {
        params.delete('period');
      } else {
        params.set('period', period);
      }
      router.push(`/reports?${params.toString()}`);
    },
    [router, searchParams],
  );

  function handleExport() {
    const dateStr = new Date().toISOString().split('T')[0];
    if (activeTab === 'cadence') {
      const csv = cadenceMetricsToCsv(data.cadenceMetrics);
      downloadCsv(csv, `relatorio-cadencias-${dateStr}.csv`);
    } else if (activeTab === 'sdr') {
      const csv = sdrMetricsToCsv(data.sdrMetrics);
      downloadCsv(csv, `relatorio-sdrs-${dateStr}.csv`);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Relatórios</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Analise o desempenho das campanhas, SDRs e funil de conversão.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {periods.map((p) => (
              <Button
                key={p.value}
                variant={currentPeriod === p.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriod(p.value)}
              >
                {p.label}
              </Button>
            ))}
          </div>
          {activeTab !== 'overall' && (
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? 'border-b-2 border-[var(--foreground)] text-[var(--foreground)]'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overall' && <OverallReport metrics={data.overallMetrics} />}
      {activeTab === 'cadence' && <CadenceReport metrics={data.cadenceMetrics} />}
      {activeTab === 'sdr' && <SdrReport metrics={data.sdrMetrics} />}
    </div>
  );
}
