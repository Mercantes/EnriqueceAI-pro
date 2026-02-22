'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { ListChecks, X } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';

import type { PendingActivity } from '../types';
import { ActivityExecutionSheet } from './ActivityExecutionSheet';
import { ActivityRow } from './ActivityRow';

interface ActivityLogViewProps {
  activities: PendingActivity[];
  total: number;
  hasFilters: boolean;
}

const ALL_VALUE = '__all__';

const channelOptions = [
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'phone', label: 'Ligação' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'research', label: 'Pesquisa' },
];

const statusOptions = [
  { value: 'overdue', label: 'Atrasadas' },
  { value: 'due', label: 'No prazo' },
];

export function ActivityLogView({ activities: initialActivities, total, hasFilters }: ActivityLogViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activities, setActivities] = useState<PendingActivity[]>(initialActivities);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const currentStatus = searchParams.get('status') ?? '';
  const currentChannel = searchParams.get('channel') ?? '';
  const currentSearch = searchParams.get('search') ?? '';

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== ALL_VALUE) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`/activities?${params.toString()}`);
    },
    [router, searchParams],
  );

  const clearFilters = useCallback(() => {
    router.push('/activities');
  }, [router]);

  // Cadence filter (client-side since cadences come from the data)
  const [cadenceFilter, setCadenceFilter] = useState('all');
  const [stepFilter, setStepFilter] = useState('all');

  const cadenceOptions = useMemo(
    () => [...new Set(activities.map((a) => a.cadenceName))].sort(),
    [activities],
  );

  const filtered = useMemo(() => {
    return activities.filter((a) => {
      if (cadenceFilter !== 'all' && a.cadenceName !== cadenceFilter) return false;
      if (stepFilter !== 'all' && String(a.stepOrder) !== stepFilter) return false;
      return true;
    });
  }, [activities, cadenceFilter, stepFilter]);

  const handleActivityDone = useCallback((enrollmentId: string) => {
    setActivities((prev) => prev.filter((a) => a.enrollmentId !== enrollmentId));
  }, []);

  const handleClose = useCallback(() => {
    setSelectedIndex(null);
  }, []);

  const handleNavigate = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  function findGlobalIndex(activity: PendingActivity) {
    return activities.findIndex((a) => a.enrollmentId === activity.enrollmentId);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ListChecks className="h-6 w-6 text-[var(--muted-foreground)]" />
          <div>
            <h1 className="text-2xl font-bold">Atividades</h1>
            <p className="text-sm text-[var(--muted-foreground)]">
              {total} atividade{total !== 1 ? 's' : ''} encontrada{total !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="mr-1 h-4 w-4" />
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status */}
        <Select
          value={currentStatus || ALL_VALUE}
          onValueChange={(v) => updateParam('status', v)}
        >
          <SelectTrigger className="w-full sm:w-[130px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Todos status</SelectItem>
            {statusOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Channel */}
        <Select
          value={currentChannel || ALL_VALUE}
          onValueChange={(v) => updateParam('channel', v)}
        >
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Atividade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Todas atividades</SelectItem>
            {channelOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Cadence */}
        <Select
          value={cadenceFilter}
          onValueChange={setCadenceFilter}
        >
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Cadência" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas cadências</SelectItem>
            {cadenceOptions.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Step */}
        <Select
          value={stepFilter}
          onValueChange={setStepFilter}
        >
          <SelectTrigger className="w-full sm:w-[110px]">
            <SelectValue placeholder="Passo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos passos</SelectItem>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <SelectItem key={n} value={String(n)}>
                Passo {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Input
            placeholder="Nome, email ou telefone"
            defaultValue={currentSearch}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                updateParam('search', e.currentTarget.value);
              }
            }}
          />
        </div>
      </div>

      {/* Table header */}
      <div className="border-b pb-2">
        <div className="grid grid-cols-[80px_1fr_1fr_1fr_auto] gap-4 px-4 text-xs font-medium uppercase text-[var(--muted-foreground)]">
          <span />
          <span>Atividade</span>
          <span>Cadência</span>
          <span>Lead</span>
          <span />
        </div>
      </div>

      {/* Section label */}
      <div className="rounded-lg bg-[var(--muted)]/50 px-4 py-2">
        <span className="text-sm font-semibold text-[var(--foreground)]">
          Atividades das Cadências ({filtered.length})
        </span>
      </div>

      {/* Activity list */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center text-[var(--muted-foreground)]">
          Nenhuma atividade encontrada com os filtros aplicados.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((activity) => (
            <ActivityRow
              key={activity.enrollmentId}
              activity={activity}
              onExecute={() => setSelectedIndex(findGlobalIndex(activity))}
              onSkip={() => {
                handleActivityDone(activity.enrollmentId);
                import('../actions/skip-activity').then(({ skipActivity }) =>
                  skipActivity(activity.enrollmentId),
                );
              }}
            />
          ))}
        </div>
      )}

      {/* Execution Sheet */}
      <ActivityExecutionSheet
        activities={activities}
        selectedIndex={selectedIndex}
        onClose={handleClose}
        onNavigate={handleNavigate}
        onActivityDone={handleActivityDone}
      />
    </div>
  );
}
