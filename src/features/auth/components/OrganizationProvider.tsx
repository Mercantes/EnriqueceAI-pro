'use client';

import { createContext, useEffect, useState } from 'react';

import { createClient } from '@/lib/supabase/client';

import type { OrganizationMemberRow, OrganizationRow } from '../types';

export interface OrgContextValue {
  organization: OrganizationRow;
  members: OrganizationMemberRow[];
  currentMember: OrganizationMemberRow;
  isManager: boolean;
  loading: boolean;
}

export const OrgContext = createContext<OrgContextValue | null>(null);

export function OrganizationProvider({
  children,
  initialOrg,
  initialMembers,
  initialMember,
}: {
  children: React.ReactNode;
  initialOrg: OrganizationRow;
  initialMembers: OrganizationMemberRow[];
  initialMember: OrganizationMemberRow;
}) {
  const [organization, setOrganization] = useState(initialOrg);
  const [members, setMembers] = useState(initialMembers);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('org-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'organizations',
          filter: `id=eq.${initialOrg.id}`,
        },
        (payload) => {
          setOrganization(payload.new as OrganizationRow);
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'organization_members',
          filter: `org_id=eq.${initialOrg.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMembers((prev) => [...prev, payload.new as OrganizationMemberRow]);
          } else if (payload.eventType === 'UPDATE') {
            setMembers((prev) =>
              prev.map((m) =>
                m.id === (payload.new as OrganizationMemberRow).id
                  ? (payload.new as OrganizationMemberRow)
                  : m,
              ),
            );
          } else if (payload.eventType === 'DELETE') {
            setMembers((prev) =>
              prev.filter((m) => m.id !== (payload.old as OrganizationMemberRow).id),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [initialOrg.id]);

  return (
    <OrgContext.Provider
      value={{
        organization,
        members,
        currentMember: initialMember,
        isManager: initialMember.role === 'manager',
        loading: false,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
}
