// Dashboard feature barrel export

// Legacy types (kept for backward compatibility)
export type {
  DashboardMetrics,
  ImportSummary,
  EnrichmentStats,
} from './dashboard.contract';

// New types (Story 3.2 + 3.3 + 3.4)
export type {
  DashboardData,
  DashboardFilters,
  OpportunityKpiData,
  DailyDataPoint,
  CadenceOption,
  RankingData,
  RankingCardData,
  SdrRankingEntry,
  InsightsData,
  LossReasonEntry,
  ConversionByOriginEntry,
} from './types';

// Components
export { DashboardView } from './components/DashboardView';
export { DashboardFilters as DashboardFiltersComponent } from './components/DashboardFilters';
export { OpportunityKpiCard } from './components/OpportunityKpiCard';
export { OpportunityChart } from './components/OpportunityChart';
export { RankingCard } from './components/RankingCard';
export { LossReasonsChart } from './components/LossReasonsChart';
export { ConversionByOriginChart } from './components/ConversionByOriginChart';
export { EmptyDashboard } from './components/EmptyDashboard';
export { MetricCard } from './components/MetricCard';
export { RecentImports } from './components/RecentImports';
export { EnrichmentCard } from './components/EnrichmentCard';
export { DistributionCard } from './components/DistributionCard';
export { PeriodFilter } from './components/PeriodFilter';

// Actions
export { getDashboardData } from './actions/get-dashboard-data';
export { getRankingData } from './actions/get-ranking-data';
export { getInsightsData } from './actions/get-insights-data';
export { fetchDashboardMetrics } from './actions/fetch-dashboard';
