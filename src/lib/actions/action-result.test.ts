import { describe, expect, it } from 'vitest';

import type { ActionResult } from './action-result';

describe('ActionResult', () => {
  it('should represent a successful result', () => {
    const result: ActionResult<{ id: string }> = {
      success: true,
      data: { id: '123' },
    };

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('123');
    }
  });

  it('should represent an error result', () => {
    const result: ActionResult<never> = {
      success: false,
      error: 'Something went wrong',
      code: 'VALIDATION_ERROR',
    };

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Something went wrong');
      expect(result.code).toBe('VALIDATION_ERROR');
    }
  });

  it('should allow error result without code', () => {
    const result: ActionResult<never> = {
      success: false,
      error: 'Unauthorized',
    };

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBeUndefined();
    }
  });
});
