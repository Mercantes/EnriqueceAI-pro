'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { from } from '@/lib/supabase/from';
import { createNotificationsForOrgMembers } from '@/features/notifications/services/notification.service';

interface LimboLead {
  org_id: string;
  assigned_to: string | null;
}

/**
 * Rede de segurança do "limbo de cadência": varre `v_leads_cadence_limbo`
 * (status='contacted' sem cadência ativa e sem atividade pendente) e alerta os
 * gestores de cada org, 1x por dia (dedup por org + data BRT). O corpo traz o
 * total e a quebra por dono, para o gestor saber quem cobrar.
 *
 * Só detecta e avisa — a triagem/destino dos leads é ação humana (ou do passivo
 * planejado). Tolerante a erro por org: uma org que falha não derruba as outras.
 */
export async function checkCadenceLimbo(): Promise<
  ActionResult<{ orgs: number; alerted: number; total: number }>
> {
  const supabase = createServiceRoleClient();

  const { data: leads, error } = (await from(supabase, 'v_leads_cadence_limbo' as never)
    .select('org_id, assigned_to')) as {
      data: LimboLead[] | null;
      error: { message: string } | null;
    };

  if (error) {
    console.error('[cadence-limbo] Failed to fetch limbo leads:', error.message);
    return { success: false, error: error.message };
  }

  if (!leads?.length) {
    return { success: true, data: { orgs: 0, alerted: 0, total: 0 } };
  }

  // Agrupa por org e, dentro da org, conta por dono (assigned_to).
  const byOrg = new Map<string, { total: number; byOwner: Map<string, number> }>();
  for (const lead of leads) {
    const group = byOrg.get(lead.org_id) ?? { total: 0, byOwner: new Map<string, number>() };
    group.total += 1;
    const owner = lead.assigned_to ?? 'unassigned';
    group.byOwner.set(owner, (group.byOwner.get(owner) ?? 0) + 1);
    byOrg.set(lead.org_id, group);
  }

  // Dedup diário (DST-safe): 1 alerta por org por dia.
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  let alerted = 0;

  for (const [orgId, group] of byOrg) {
    try {
      const { count: existingAlert } = (await from(supabase, 'notifications')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('type', 'integration_error')
        .gte('created_at', `${today}T03:00:00.000Z`)
        .contains('metadata', { alert_type: 'cadence_limbo' })) as { count: number | null };

      if ((existingAlert ?? 0) > 0) continue;

      await createNotificationsForOrgMembers({
        orgId,
        type: 'integration_error',
        title: `${group.total} lead${group.total === 1 ? '' : 's'} em limbo de cadência`,
        body:
          `${group.total} lead(s) em "Contatado" sem cadência ativa e sem atividade pendente — ` +
          `ninguém está sendo cobrado por eles e não voltam sozinhos. Revise e reative, troque ` +
          `de cadência ou defina destino (perdido/reciclar).`,
        resourceType: 'lead',
        metadata: {
          alert_type: 'cadence_limbo',
          count: group.total,
          by_owner: Object.fromEntries(group.byOwner),
        },
        roleFilter: 'manager',
      });

      alerted += 1;
      console.warn(`[cadence-limbo] Alert sent: org=${orgId} total=${group.total}`);
    } catch (err) {
      console.error(`[cadence-limbo] Error for org=${orgId}:`, err);
    }
  }

  const total = leads.length;
  console.warn(`[cadence-limbo] Complete: orgs=${byOrg.size} alerted=${alerted} total=${total}`);
  return { success: true, data: { orgs: byOrg.size, alerted, total } };
}
