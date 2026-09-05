'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { getAuthOrgIdResult } from '@/lib/auth/get-org-id';
import { from } from '@/lib/supabase/from';

export interface ActiveCadence {
  id: string;
  name: string;
  total_steps: number;
}

export interface FetchActiveCadencesOptions {
  /**
   * Lista para o "Trocar cadência". Para SDR (não manager) só entram cadências
   * com `sdr_switch_allowed = true` — o gestor decide para onde o SDR pode
   * mover leads. Manager vê todas. Inscrição normal (`enroll`) ignora a flag.
   */
  forSwitch?: boolean;
}

export async function fetchActiveCadences(
  options: FetchActiveCadencesOptions = {},
): Promise<ActionResult<ActiveCadence[]>> {
  const auth = await getAuthOrgIdResult();
  if (!auth.success) return auth;
  const { orgId, role, supabase } = auth.data;

  let query = from(supabase, 'cadences')
    .select('id, name, total_steps')
    .eq('org_id', orgId)
    .eq('status', 'active')
    .is('deleted_at', null);

  if (options.forSwitch && role !== 'manager') {
    query = query.eq('sdr_switch_allowed', true);
  }

  const { data, error } = (await query.order('name')) as {
    data: ActiveCadence[] | null;
    error: { message: string } | null;
  };

  if (error) {
    return { success: false, error: 'Erro ao buscar cadências' };
  }

  return { success: true, data: data ?? [] };
}
