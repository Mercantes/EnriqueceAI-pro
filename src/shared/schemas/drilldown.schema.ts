import { z } from 'zod';

import { isUuid } from '@/lib/utils/uuid';

export const drilldownMetricSchema = z.enum([
  'overall_leads',
  'overall_contacted',
  'overall_replied',
  'overall_meetings',
  'overall_qualified',
  'cadence_enrollments',
  'sdr_activities',
  'activity_total',
  'activity_today',
  'conversion_stage',
]);

// Drop non-UUID values (e.g. the literal string "undefined" from a client that
// built `?sdrId=${maybeUndefined}`) so they never reach `.eq('uuid_col', ...)`
// and trigger `invalid input syntax for type uuid: "undefined"`.
const uuidDrilldownFilter = z
  .string()
  .optional()
  .transform((v) => (isUuid(v) ? v : undefined));

export const drilldownFiltersSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  sdrId: uuidDrilldownFilter,
  cadenceId: uuidDrilldownFilter,
  stage: z.string().optional(),
});

export const fetchDrilldownInputSchema = z.object({
  metric: drilldownMetricSchema,
  filters: drilldownFiltersSchema,
  page: z.number().int().min(1).default(1),
});

export type FetchDrilldownInput = z.infer<typeof fetchDrilldownInputSchema>;
