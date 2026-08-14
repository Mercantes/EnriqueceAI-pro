import { describe, expect, it } from 'vitest';

import { calculateVelocity } from './conversion-analytics.service';
import type { EnrollmentQueryRow, LeadQueryRow } from '../types/query-rows';

// Minimal row factories — only the fields calculateVelocity reads matter.
function enrollment(partial: Partial<EnrollmentQueryRow>): EnrollmentQueryRow {
  return {
    cadence_id: 'c1',
    lead_id: 'l1',
    org_id: 'o1',
    current_step: 0,
    status: 'active',
    enrolled_by: null,
    loss_reason_id: null,
    enrolled_at: '2026-08-01T12:00:00Z',
    updated_at: '2026-08-01T12:00:00Z',
    ...partial,
  };
}

function lead(partial: Partial<LeadQueryRow>): LeadQueryRow {
  return {
    id: 'l1',
    status: 'qualified',
    created_by: null,
    assigned_to: null,
    won_by: null,
    created_at: '2026-08-01T00:00:00Z',
    won_at: null,
    ...partial,
  };
}

describe('calculateVelocity', () => {
  it('measures duration from enrolled_at → updated_at for qualified leads (H1 regression)', () => {
    // Regression: velocity used enrollment.created_at, a column that does not
    // exist on cadence_enrollments → new Date(undefined) → NaN → the card was
    // stuck at {0,0,0} even with qualified leads. It must use enrolled_at.
    const enrollments = [
      enrollment({ lead_id: 'l1', enrolled_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-04T00:00:00Z' }), // 3 days
      enrollment({ lead_id: 'l2', enrolled_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-06T00:00:00Z' }), // 5 days
    ];
    const leads = [lead({ id: 'l1', status: 'qualified' }), lead({ id: 'l2', status: 'won' })];

    const result = calculateVelocity(enrollments, leads);

    expect(result.totalQualified).toBe(2);
    expect(result.avgDaysToQualification).toBe(4); // (3 + 5) / 2
    expect(result.medianDaysToQualification).toBe(4); // even count → mean of the two
  });

  it('ignores enrollments whose lead is not qualified/won', () => {
    const enrollments = [
      enrollment({ lead_id: 'l1', enrolled_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-04T00:00:00Z' }),
    ];
    const leads = [lead({ id: 'l1', status: 'contacted' })];

    expect(calculateVelocity(enrollments, leads)).toEqual({
      avgDaysToQualification: 0,
      medianDaysToQualification: 0,
      totalQualified: 0,
    });
  });
});
