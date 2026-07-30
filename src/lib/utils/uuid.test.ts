import { describe, expect, it } from 'vitest';

import { isUuid } from './uuid';

describe('isUuid', () => {
  it('accepts a valid uuid', () => {
    expect(isUuid('c2727473-1df8-4faa-9264-a9fc1759fe3b')).toBe(true);
  });

  it('rejects the literal string "undefined" and other non-uuid junk', () => {
    expect(isUuid('undefined')).toBe(false);
    expect(isUuid('null')).toBe(false);
    expect(isUuid('')).toBe(false);
    expect(isUuid('__unassigned__')).toBe(false);
    expect(isUuid('123')).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid(null)).toBe(false);
    expect(isUuid(42)).toBe(false);
  });
});
