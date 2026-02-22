export interface FunnelStage {
  label: string;
  count: number;
  percentage: number;
  color: string;
}

export interface StageConversion {
  from: string;
  to: string;
  rate: number;
  numerator: number;
  denominator: number;
}

export interface PipelineVelocity {
  avgDaysToQualification: number;
  medianDaysToQualification: number;
  totalQualified: number;
}

export interface CadenceConversionRow {
  cadenceId: string;
  cadenceName: string;
  enrollments: number;
  replies: number;
  meetings: number;
  qualified: number;
  conversionRate: number;
}

export interface ConversionByOriginEntry {
  origin: string;
  qualified: number;
  unqualified: number;
  total: number;
  conversionRate: number;
}

export interface ConversionAnalyticsData {
  funnel: FunnelStage[];
  stageConversions: StageConversion[];
  velocity: PipelineVelocity;
  cadenceConversion: CadenceConversionRow[];
  conversionByOrigin: ConversionByOriginEntry[];
}
