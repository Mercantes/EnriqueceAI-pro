'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { getAuthOrgIdResult } from '@/lib/auth/get-org-id';
import { from } from '@/lib/supabase/from';

import type { ResolvedPhone } from '@/features/activities/utils/resolve-whatsapp-phone';
import { buildContactPhones } from '@/features/activities/utils/resolve-whatsapp-phone';

import type { LeadContact, LeadPhone, LeadSocio } from '../types';

interface LeadPhoneData {
  telefone: string | null;
  phones: LeadPhone[] | null;
  socios: LeadSocio[] | null;
}

/**
 * Fetch current phone numbers for a lead (used to refresh the dialer list after
 * edits). Sources from lead_contacts so each number keeps its contact label +
 * contactId; falls back to the lead's own columns when there are no contacts.
 */
export async function fetchLeadPhones(leadId: string): Promise<ActionResult<ResolvedPhone[]>> {
  const auth = await getAuthOrgIdResult();
  if (!auth.success) return auth;
  const { orgId, supabase } = auth.data;

  const { data: lead } = (await from(supabase, 'leads')
    .select('telefone, phones, socios')
    .eq('id', leadId)
    .eq('org_id', orgId)
    .single()) as { data: LeadPhoneData | null };

  if (!lead) return { success: true, data: [] };

  const { data: contacts } = (await from(supabase, 'lead_contacts')
    .select('*')
    .eq('lead_id', leadId)
    .eq('org_id', orgId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })) as { data: LeadContact[] | null };

  const resolved = buildContactPhones(contacts ?? [], {
    telefone: lead.telefone,
    phones: lead.phones,
    socios: lead.socios,
  });

  return { success: true, data: resolved };
}
