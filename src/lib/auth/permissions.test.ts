import { describe, expect, it } from 'vitest';

import { canAccessPath, MANAGER_ONLY_PATHS } from './permissions';

describe('permissions', () => {
  describe('canAccessPath', () => {
    it('should allow managers to access any path', () => {
      expect(canAccessPath('manager', '/settings/users')).toBe(true);
      expect(canAccessPath('manager', '/settings/billing')).toBe(true);
      expect(canAccessPath('manager', '/dashboard')).toBe(true);
    });

    it('should block SDRs from manager-only paths', () => {
      for (const path of MANAGER_ONLY_PATHS) {
        expect(canAccessPath('sdr', path)).toBe(false);
      }
    });

    it('should allow SDRs to access non-restricted paths', () => {
      expect(canAccessPath('sdr', '/dashboard')).toBe(true);
      expect(canAccessPath('sdr', '/settings')).toBe(true);
      expect(canAccessPath('sdr', '/leads')).toBe(true);
    });

    it('should block SDRs from sub-paths of manager-only paths', () => {
      expect(canAccessPath('sdr', '/settings/users/invite')).toBe(false);
      expect(canAccessPath('sdr', '/settings/billing/plans')).toBe(false);
    });
  });
});
