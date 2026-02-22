import { describe, expect, it } from 'vitest';

import {
  addFeedbackSchema,
  callFiltersSchema,
  createCallSchema,
  updateCallStatusSchema,
} from './call.schemas';

describe('createCallSchema', () => {
  it('should validate valid input', () => {
    const result = createCallSchema.safeParse({
      origin: '11999991111',
      destination: '11888882222',
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty origin', () => {
    const result = createCallSchema.safeParse({
      origin: '',
      destination: '11888882222',
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty destination', () => {
    const result = createCallSchema.safeParse({
      origin: '11999991111',
      destination: '',
    });
    expect(result.success).toBe(false);
  });

  it('should apply defaults', () => {
    const result = createCallSchema.safeParse({
      origin: '11999991111',
      destination: '11888882222',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.duration_seconds).toBe(0);
      expect(result.data.status).toBe('not_connected');
      expect(result.data.type).toBe('outbound');
    }
  });

  it('should accept optional lead_id UUID', () => {
    const result = createCallSchema.safeParse({
      origin: '11999991111',
      destination: '11888882222',
      lead_id: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid lead_id', () => {
    const result = createCallSchema.safeParse({
      origin: '11999991111',
      destination: '11888882222',
      lead_id: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateCallStatusSchema', () => {
  it('should validate valid input', () => {
    const result = updateCallStatusSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'significant',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid status', () => {
    const result = updateCallStatusSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'invalid',
    });
    expect(result.success).toBe(false);
  });

  it('should reject non-UUID id', () => {
    const result = updateCallStatusSchema.safeParse({
      id: 'not-uuid',
      status: 'busy',
    });
    expect(result.success).toBe(false);
  });
});

describe('callFiltersSchema', () => {
  it('should validate empty filters with defaults', () => {
    const result = callFiltersSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.period).toBe('all');
      expect(result.data.page).toBe(1);
      expect(result.data.per_page).toBe(20);
      expect(result.data.important_only).toBe(false);
    }
  });

  it('should validate all period values', () => {
    for (const period of ['today', 'week', 'month', 'all']) {
      const result = callFiltersSchema.safeParse({ period });
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid period', () => {
    const result = callFiltersSchema.safeParse({ period: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('should reject per_page > 100', () => {
    const result = callFiltersSchema.safeParse({ per_page: 101 });
    expect(result.success).toBe(false);
  });

  it('should coerce page and per_page from strings', () => {
    const result = callFiltersSchema.safeParse({ page: '3', per_page: '50' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.per_page).toBe(50);
    }
  });
});

describe('addFeedbackSchema', () => {
  it('should validate valid input', () => {
    const result = addFeedbackSchema.safeParse({
      call_id: '550e8400-e29b-41d4-a716-446655440000',
      content: 'Some feedback',
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty content', () => {
    const result = addFeedbackSchema.safeParse({
      call_id: '550e8400-e29b-41d4-a716-446655440000',
      content: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid call_id', () => {
    const result = addFeedbackSchema.safeParse({
      call_id: 'not-uuid',
      content: 'feedback',
    });
    expect(result.success).toBe(false);
  });
});
