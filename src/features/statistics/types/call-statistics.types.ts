import type { CallStatus } from '@/features/calls/types';

export interface CallOutcomeBarEntry {
  status: CallStatus;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

export interface DurationBucket {
  label: string;
  range: string;
  count: number;
}

export interface HeatmapCell {
  dayOfWeek: number;
  dayLabel: string;
  hourBlock: number;
  hourLabel: string;
  count: number;
}

export interface SdrCallEntry {
  userId: string;
  userName: string;
  totalCalls: number;
  connectionRate: number;
}

export interface CallStatisticsKpis {
  totalCalls: number;
  totalDurationSeconds: number;
  avgDurationSeconds: number;
  bestDay: string;
  bestHour: string;
}

export interface CallStatisticsData {
  kpis: CallStatisticsKpis;
  outcomes: CallOutcomeBarEntry[];
  durationDistribution: DurationBucket[];
  heatmap: HeatmapCell[];
  callsBySdr: SdrCallEntry[];
}
