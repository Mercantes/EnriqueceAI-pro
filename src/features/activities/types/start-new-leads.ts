export interface AvailableCadence {
  id: string;
  name: string;
  origin: 'inbound_active' | 'inbound_passive' | 'outbound';
  availableLeads: number;
  totalSteps: number;
  firstDayActivities: number;
  priority: 'high' | 'medium' | 'low';
}

/** Sentinel for leads without canal (null or empty string). */
export const NO_SUB_ORIGIN = '__none__';

export interface SubOriginCount {
  /** Canal value, or NO_SUB_ORIGIN for leads without one. */
  canal: string;
  count: number;
}

export interface ForecastDay {
  dayOffset: number;
  dayLabel: string;
  existingActivities: number;
}
