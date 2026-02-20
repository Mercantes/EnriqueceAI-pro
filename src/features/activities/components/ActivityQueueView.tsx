'use client';

import { useCallback, useState } from 'react';

import { ListChecks } from 'lucide-react';

import type { PendingActivity } from '../types';

import { ActivityRow } from './ActivityRow';
import { ActivityEmptyState } from './ActivityEmptyState';
import { ActivityExecutionSheet } from './ActivityExecutionSheet';

interface ActivityQueueViewProps {
  initialActivities: PendingActivity[];
}

export function ActivityQueueView({ initialActivities }: ActivityQueueViewProps) {
  const [activities, setActivities] = useState<PendingActivity[]>(initialActivities);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const handleActivityDone = useCallback((enrollmentId: string) => {
    setActivities((prev) => prev.filter((a) => a.enrollmentId !== enrollmentId));
  }, []);

  const handleClose = useCallback(() => {
    setSelectedIndex(null);
  }, []);

  const handleNavigate = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  if (activities.length === 0) {
    return <ActivityEmptyState />;
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <ListChecks className="h-5 w-5 text-[var(--muted-foreground)]" />
        <h2 className="text-lg font-semibold">
          Atividades ({activities.length})
        </h2>
      </div>

      {/* Queue list */}
      <div className="space-y-2">
        {activities.map((activity, index) => (
          <ActivityRow
            key={activity.enrollmentId}
            activity={activity}
            onExecute={() => setSelectedIndex(index)}
            onSkip={() => {
              handleActivityDone(activity.enrollmentId);
              import('../actions/skip-activity').then(({ skipActivity }) =>
                skipActivity(activity.enrollmentId),
              );
            }}
          />
        ))}
      </div>

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
