import type { CallStatus } from '@/features/calls/types';

export interface CallDashboardKpis {
  totalCalls: number;
  avgDurationSeconds: number;
  connectionRate: number;
  significantRate: number;
}

export interface CallOutcomeEntry {
  status: CallStatus;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

export interface HourlyCallEntry {
  hour: number;
  label: string;
  count: number;
}

export interface RecentTeamCall {
  id: string;
  userName: string;
  destination: string;
  status: CallStatus;
  durationSeconds: number;
  startedAt: string;
}

export interface CallDashboardData {
  kpis: CallDashboardKpis;
  outcomes: CallOutcomeEntry[];
  hourlyDistribution: HourlyCallEntry[];
  recentCalls: RecentTeamCall[];
}
