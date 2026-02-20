'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { requireAuth } from '@/lib/auth/require-auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import type { CalendarConnectionSafe, CrmConnectionSafe, GmailConnectionSafe, WhatsAppConnectionSafe } from '../types';

export interface ConnectionsOverview {
  gmail: GmailConnectionSafe | null;
  whatsapp: WhatsAppConnectionSafe | null;
  crm: CrmConnectionSafe | null;
  calendar: CalendarConnectionSafe | null;
}

export async function fetchConnections(): Promise<ActionResult<ConnectionsOverview>> {
  const user = await requireAuth();
  const supabase = await createServerSupabaseClient();

  const { data: member } = (await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()) as { data: { org_id: string } | null };

  if (!member) {
    return { success: false, error: 'Organização não encontrada' };
  }

  // Fetch Gmail connection (per user) — exclude encrypted tokens
  const { data: gmailRow } = (await (supabase
    .from('gmail_connections') as ReturnType<typeof supabase.from>)
    .select('id, email_address, status, created_at, updated_at')
    .eq('org_id', member.org_id)
    .eq('user_id', user.id)
    .maybeSingle()) as { data: GmailConnectionSafe | null };

  // Fetch WhatsApp connection (per org) — exclude encrypted tokens
  const { data: whatsappRow } = (await (supabase
    .from('whatsapp_connections') as ReturnType<typeof supabase.from>)
    .select('id, phone_number_id, business_account_id, status, created_at, updated_at')
    .eq('org_id', member.org_id)
    .maybeSingle()) as { data: WhatsAppConnectionSafe | null };

  // Fetch CRM connection (per org) — exclude encrypted credentials
  const { data: crmRow } = (await (supabase
    .from('crm_connections') as ReturnType<typeof supabase.from>)
    .select('id, crm_provider, field_mapping, status, last_sync_at, created_at, updated_at')
    .eq('org_id', member.org_id)
    .limit(1)
    .maybeSingle()) as { data: CrmConnectionSafe | null };

  // Fetch Calendar connection (per user) — exclude encrypted tokens
  const { data: calendarRow } = (await (supabase
    .from('calendar_connections') as ReturnType<typeof supabase.from>)
    .select('id, calendar_email, status, created_at, updated_at')
    .eq('org_id', member.org_id)
    .eq('user_id', user.id)
    .maybeSingle()) as { data: CalendarConnectionSafe | null };

  return {
    success: true,
    data: {
      gmail: gmailRow ?? null,
      whatsapp: whatsappRow ?? null,
      crm: crmRow ?? null,
      calendar: calendarRow ?? null,
    },
  };
}
