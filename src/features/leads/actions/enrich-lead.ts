'use server';

import { revalidatePath } from 'next/cache';

import type { ActionResult } from '@/lib/actions/action-result';
import { requireAuth } from '@/lib/auth/require-auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import { CnpjWsProvider } from '../services/enrichment-provider';
import { enrichLead } from '../services/enrichment.service';

export async function enrichLeadAction(leadId: string): Promise<ActionResult<void>> {
  const user = await requireAuth();
  const supabase = await createServerSupabaseClient();

  // Verify lead belongs to user's org
  const { data: member } = (await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()) as { data: { org_id: string } | null };

  if (!member) {
    return { success: false, error: 'Organização não encontrada' };
  }

  const { data: lead } = (await supabase
    .from('leads')
    .select('id, cnpj, org_id')
    .eq('id', leadId)
    .single()) as { data: { id: string; cnpj: string; org_id: string } | null };

  if (!lead || lead.org_id !== member.org_id) {
    return { success: false, error: 'Lead não encontrado' };
  }

  // Use CNPJ.ws as default provider (free tier)
  const provider = new CnpjWsProvider();

  const result = await enrichLead({
    leadId: lead.id,
    cnpj: lead.cnpj,
    provider,
    supabase,
  });

  revalidatePath('/leads');
  revalidatePath(`/leads/${leadId}`);

  if (!result.success) {
    return { success: false, error: result.error ?? 'Falha no enriquecimento' };
  }

  return { success: true, data: undefined };
}
