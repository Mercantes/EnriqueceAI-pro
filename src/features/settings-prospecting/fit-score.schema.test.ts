import { describe, expect, it } from 'vitest';

import { fitScoreRuleSchema, fitScoreRulesArraySchema } from './fit-score.schema';

describe('fitScoreRuleSchema', () => {
  it('should accept valid rule with positive points', () => {
    const result = fitScoreRuleSchema.safeParse({
      points: 5,
      field: 'email',
      operator: 'not_empty',
      value: null,
    });
    expect(result.success).toBe(true);
  });

  it('should accept valid rule with negative points', () => {
    const result = fitScoreRuleSchema.safeParse({
      points: -3,
      field: 'porte',
      operator: 'equals',
      value: 'MEI',
    });
    expect(result.success).toBe(true);
  });

  it('should reject points = 0', () => {
    const result = fitScoreRuleSchema.safeParse({
      points: 0,
      field: 'email',
      operator: 'contains',
      value: '@gmail.com',
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty field', () => {
    const result = fitScoreRuleSchema.safeParse({
      points: 1,
      field: '',
      operator: 'contains',
      value: 'test',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid operator', () => {
    const result = fitScoreRuleSchema.safeParse({
      points: 1,
      field: 'email',
      operator: 'invalid_op',
      value: 'test',
    });
    expect(result.success).toBe(false);
  });

  it('should accept all valid operators', () => {
    for (const op of ['contains', 'equals', 'not_empty', 'starts_with']) {
      const result = fitScoreRuleSchema.safeParse({
        points: 1,
        field: 'email',
        operator: op,
        value: op === 'not_empty' ? null : 'test',
      });
      expect(result.success).toBe(true);
    }
  });
});

describe('fitScoreRulesArraySchema', () => {
  it('should accept empty array', () => {
    const result = fitScoreRulesArraySchema.safeParse([]);
    expect(result.success).toBe(true);
  });

  it('should accept array of valid rules', () => {
    const result = fitScoreRulesArraySchema.safeParse([
      { points: 5, field: 'email', operator: 'not_empty', value: null },
      { points: -2, field: 'porte', operator: 'equals', value: 'MEI' },
    ]);
    expect(result.success).toBe(true);
  });

  it('should reject if any rule is invalid', () => {
    const result = fitScoreRulesArraySchema.safeParse([
      { points: 5, field: 'email', operator: 'not_empty', value: null },
      { points: 0, field: 'porte', operator: 'equals', value: 'MEI' }, // invalid: 0 points
    ]);
    expect(result.success).toBe(false);
  });
});
