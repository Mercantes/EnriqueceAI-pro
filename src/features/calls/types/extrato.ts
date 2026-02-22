export interface ExtratoKpis {
  totalCalls: number;
  totalDurationSeconds: number;
  totalCost: number;
  avgCallsPerDay: number;
}

export interface ExtratoDailyRow {
  date: string;
  calls: number;
  durationSeconds: number;
  significantCalls: number;
  cost: number;
}

export interface ExtratoSdrRow {
  userId: string;
  userName: string;
  calls: number;
  avgDurationSeconds: number;
  connectionRate: number;
  cost: number;
}

export interface ExtratoData {
  kpis: ExtratoKpis;
  dailyBreakdown: ExtratoDailyRow[];
  sdrBreakdown: ExtratoSdrRow[];
}
