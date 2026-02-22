'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { createServiceRoleClient } from '@/lib/supabase/service';

import { landingLeadSchema } from './landing-lead.schema';

export async function submitLandingLead(
  rawInput: Record<string, unknown>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = landingLeadSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? 'Dados inválidos' };
  }

  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from('landing_leads')
    .insert(parsed.data)
    .select('id')
    .single();

  if (error || !data) {
    console.error('landing_leads insert error:', error?.message);
    return { success: false, error: 'Erro ao enviar formulário. Tente novamente.' };
  }

  return { success: true, data: { id: data.id as string } };
}
