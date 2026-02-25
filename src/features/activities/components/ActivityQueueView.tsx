'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { ChevronDown, ListChecks, UserPlus, Users, Zap } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';

import { EnrollInCadenceDialog } from '@/features/leads/components/EnrollInCadenceDialog';

import type { PendingCallLead } from '../actions/fetch-pending-calls';
import type { DialerQueueItem } from '../actions/fetch-dialer-queue';
import type { DailyProgress } from '../actions/fetch-daily-progress';
import type { PendingActivity } from '../types';

import { ActivityEmptyState } from './ActivityEmptyState';
import { ActivityExecutionSheet } from './ActivityExecutionSheet';
import {
  ActivityFilters,
  defaultFilters,
  type ActivityFilterValues,
} from './ActivityFilters';
import { ActivityPagination } from './ActivityPagination';
import { ActivityRow, ACTIVITY_GRID_COLS } from './ActivityRow';
import { DailyGoalCard } from './DailyGoalCard';
import { PendingCallsSection } from './PendingCallsSection';
import { PowerDialerTab } from './PowerDialerTab';
import { ProgressCard } from './ProgressCard';

interface ActivityQueueViewProps {
  initialActivities: PendingActivity[];
  progress: DailyProgress;
  pendingCalls: PendingCallLead[];
  dialerQueue?: DialerQueueItem[];
  showPowerDialer?: boolean;
  availableLeadsCount?: number;
  availableLeadIds?: string[];
}

const channelGroupLabel: Record<string, string> = {
  email: 'E-mail',
  whatsapp: 'WhatsApp',
  phone: 'Ligação',
  linkedin: 'LinkedIn',
  research: 'Pesquisa',
};

const DEFAULT_PER_PAGE = 25;

function applyFilters(activities: PendingActivity[], filters: ActivityFilterValues): PendingActivity[] {
  return activities.filter((a) => {
    // Status filter
    if (filters.status === 'overdue') {
      const diffH = (Date.now() - new Date(a.nextStepDue).getTime()) / 3600000;
      if (diffH < 1) return false;
    }
    if (filters.status === 'due') {
      const diffH = (Date.now() - new Date(a.nextStepDue).getTime()) / 3600000;
      if (diffH >= 1) return false;
    }

    // Channel
    if (filters.channel !== 'all' && a.channel !== filters.channel) return false;

    // Cadence
    if (filters.cadence !== 'all' && a.cadenceName !== filters.cadence) return false;

    // Step
    if (filters.step !== 'all' && String(a.stepOrder) !== filters.step) return false;

    // Search
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const leadName = (a.lead.nome_fantasia ?? a.lead.razao_social ?? a.lead.cnpj).toLowerCase();
      const cadence = a.cadenceName.toLowerCase();
      if (!leadName.includes(q) && !cadence.includes(q)) return false;
    }

    return true;
  });
}

export function ActivityQueueView({ initialActivities, progress, pendingCalls, dialerQueue = [], showPowerDialer = true, availableLeadsCount = 0, availableLeadIds = [] }: ActivityQueueViewProps) {
  const [activities, setActivities] = useState<PendingActivity[]>(initialActivities);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'execution' | 'dialer'>('execution');
  const [quickMode, setQuickMode] = useState(false);
  const [filters, setFilters] = useState<ActivityFilterValues>(defaultFilters);
  const [enrollOpen, setEnrollOpen] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE);

  const handleActivityDone = useCallback((enrollmentId: string) => {
    setActivities((prev) => prev.filter((a) => a.enrollmentId !== enrollmentId));
  }, []);

  const handleClose = useCallback(() => {
    setSelectedIndex(null);
  }, []);

  const handleNavigate = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  // Filtered activities
  const filtered = useMemo(() => applyFilters(activities, filters), [activities, filters]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filters]);

  // Paginated slice of filtered activities
  const paginatedActivities = useMemo(() => {
    const start = (page - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, page, perPage]);

  const handlePerPageChange = useCallback((newPerPage: number) => {
    setPerPage(newPerPage);
    setPage(1);
  }, []);

  // Cadence options for filter
  const cadenceOptions = useMemo(
    () => [...new Set(activities.map((a) => a.cadenceName))].sort(),
    [activities],
  );

  // Grouped by channel for quick mode (uses paginated slice)
  const grouped = useMemo(() => {
    if (!quickMode) return null;
    const groups = new Map<string, PendingActivity[]>();
    for (const a of paginatedActivities) {
      const list = groups.get(a.channel) ?? [];
      list.push(a);
      groups.set(a.channel, list);
    }
    return groups;
  }, [quickMode, paginatedActivities]);

  // Collapsed state for quick mode groups
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  function toggleGroup(channel: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(channel)) next.delete(channel);
      else next.add(channel);
      return next;
    });
  }

  // Find index in full activities array for execution sheet
  function findGlobalIndex(activity: PendingActivity) {
    return activities.findIndex((a) => a.enrollmentId === activity.enrollmentId);
  }

  return (
    <div className="space-y-6">
      {/* Available leads banner */}
      {availableLeadsCount > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/20">
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>
              Prospectando <strong>{activities.length}</strong> leads
              {' · '}
              <strong>{availableLeadsCount}</strong> leads disponíveis para serem iniciados
            </span>
          </div>
          <Button
            size="sm"
            onClick={() => setEnrollOpen(true)}
            className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Iniciar novos leads
          </Button>
        </div>
      )}

      {/* Enrollment dialog */}
      <EnrollInCadenceDialog
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
        leadIds={availableLeadIds}
      />

      {/* Progress cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ProgressCard completed={progress.completed} total={progress.total} />
        <DailyGoalCard target={progress.target} completed={progress.completed} onStartProspecting={availableLeadsCount > 0 ? () => setEnrollOpen(true) : undefined} />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b">
        <button
          type="button"
          onClick={() => setActiveTab('execution')}
          className={`border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
            activeTab === 'execution'
              ? 'border-[var(--primary)] text-[var(--primary)]'
              : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
          }`}
        >
          Execução
        </button>
        {showPowerDialer && (
          <button
            type="button"
            onClick={() => setActiveTab('dialer')}
            className={`border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
              activeTab === 'dialer'
                ? 'border-[var(--primary)] text-[var(--primary)]'
                : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            Power Dialer
          </button>
        )}
      </div>

      {activeTab === 'dialer' && showPowerDialer ? (
        <PowerDialerTab initialQueue={dialerQueue} />
      ) : (
        <>
          {/* Pending calls section */}
          <PendingCallsSection leads={pendingCalls} />

          {/* Filters + Quick mode toggle */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <ActivityFilters
              filters={filters}
              onFiltersChange={setFilters}
              cadenceOptions={cadenceOptions}
            />
            <Button
              variant={quickMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => setQuickMode(!quickMode)}
              className="gap-1.5 shrink-0"
            >
              <Zap className="h-3.5 w-3.5" />
              Modo Execução rápida
            </Button>
          </div>

          {/* Column headers */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ListChecks className="h-5 w-5 text-[var(--muted-foreground)]" />
              <h2 className="text-lg font-semibold">
                Atividades das Cadências ({filtered.length})
              </h2>
            </div>
            {filtered.length > 0 && (
              <div className={`${ACTIVITY_GRID_COLS} items-center gap-4 border-b border-[var(--border)] px-4 pb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]`}>
                <span>Atividade</span>
                <span>Cadência</span>
                <span>Lead</span>
                <span />
              </div>
            )}
          </div>

          {filtered.length === 0 ? (
            <ActivityEmptyState onStartActivities={availableLeadsCount > 0 ? () => setEnrollOpen(true) : undefined} />
          ) : quickMode && grouped ? (
            /* Quick mode: grouped by channel */
            <div className="space-y-4">
              {[...grouped.entries()].map(([channel, items]) => (
                <div key={channel} className="rounded-lg border">
                  <button
                    type="button"
                    onClick={() => toggleGroup(channel)}
                    className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-[var(--accent)]/50"
                  >
                    <span>{channelGroupLabel[channel] ?? channel} ({items.length})</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${collapsedGroups.has(channel) ? '-rotate-180' : ''}`} />
                  </button>
                  {!collapsedGroups.has(channel) && (
                    <div className="space-y-2 p-2">
                      {items.map((activity) => (
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
                </div>
              ))}
              <ActivityPagination
                total={filtered.length}
                page={page}
                perPage={perPage}
                onPageChange={setPage}
                onPerPageChange={handlePerPageChange}
              />
            </div>
          ) : (
            /* Normal mode: flat list with pagination */
            <div className="space-y-2">
              {paginatedActivities.map((activity) => (
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
              <ActivityPagination
                total={filtered.length}
                page={page}
                perPage={perPage}
                onPageChange={setPage}
                onPerPageChange={handlePerPageChange}
              />
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
        </>
      )}
    </div>
  );
}
