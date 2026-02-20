import type { User } from '@supabase/supabase-js';

import type { MemberRole, OrganizationMemberRow, OrganizationRow } from './types';

export type { MemberRole, OrganizationRow as Organization };

export interface AuthContract {
  getCurrentUser(): Promise<User | null>;
  getCurrentOrg(): Promise<OrganizationRow | null>;
  getMemberRole(): Promise<MemberRole | null>;
  getOrgMembers(): Promise<OrganizationMemberRow[]>;
  isManager(): Promise<boolean>;
}

// Member management types re-exported for consumers
export type { OrganizationMemberRow } from './types';
