'use client';

import { useContext } from 'react';

import { OrgContext } from '../components/OrganizationProvider';
import type { OrgContextValue } from '../components/OrganizationProvider';

export function useOrganization(): OrgContextValue {
  const context = useContext(OrgContext);
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}
