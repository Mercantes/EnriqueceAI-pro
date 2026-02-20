import type { MemberRole } from '@/features/auth/types';

export const MANAGER_ONLY_PATHS = [
  '/settings/users',
  '/settings/integrations',
  '/settings/billing',
];

export function canAccessPath(role: MemberRole, path: string): boolean {
  if (role === 'manager') return true;
  return !MANAGER_ONLY_PATHS.some((p) => path.startsWith(p));
}
