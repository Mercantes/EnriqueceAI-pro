import { describe, expect, it } from 'vitest';

import { drilldownFiltersSchema } from './drilldown.schema';

const UUID = 'c2727473-1df8-4faa-9264-a9fc1759fe3b';

describe('drilldownFiltersSchema uuid sanitization', () => {
  it('drops the literal string "undefined" for sdrId/cadenceId (guards against uuid cast error)', () => {
    const r = drilldownFiltersSchema.parse({
      from: '2026-07-01',
      to: '2026-07-30',
      sdrId: 'undefined',
      cadenceId: 'undefined',
    });
    expect(r.sdrId).toBeUndefined();
    expect(r.cadenceId).toBeUndefined();
  });

  it('keeps valid uuids untouched', () => {
    const r = drilldownFiltersSchema.parse({ from: 'a', to: 'b', sdrId: UUID, cadenceId: UUID });
    expect(r.sdrId).toBe(UUID);
    expect(r.cadenceId).toBe(UUID);
  });
});
