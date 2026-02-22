export interface SdrComparisonRow {
  userId: string;
  userName: string;
  leads: number;
  activities: number;
  calls: number;
  replies: number;
  meetings: number;
  conversionRate: number;
  goalPercentage: number;
}

export interface SdrTrendEntry {
  date: string;
  label: string;
  [sdrName: string]: string | number;
}

export type RankingMetric = 'leads' | 'activities' | 'calls' | 'conversion';

export interface SdrRankingEntry {
  userId: string;
  userName: string;
  value: number;
  label: string;
}

export interface SdrGoalEntry {
  userId: string;
  userName: string;
  target: number;
  actual: number;
  percentage: number;
}

export interface TeamAnalyticsData {
  comparison: SdrComparisonRow[];
  trends: SdrTrendEntry[];
  sdrNames: string[];
  rankings: Record<RankingMetric, SdrRankingEntry[]>;
  goals: SdrGoalEntry[];
}
