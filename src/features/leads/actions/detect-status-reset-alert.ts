'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { from } from '@/lib/supabase/from';
import { createNotificationsForOrgMembers } from '@/features/notifications/services/notification.service';

// Janela de varredura: cron diário + folga para não perder eventos na virada.
const LOOKBACK_HOURS = 25;
// Ignora updates avulsos (1-2 linhas); só alerta em lote — o padrão nocivo são
// os UPDATE em massa (455, 161, 28...) rodados por SQL direto.
const BULK_THRESHOLD = 5;

interface AuditRow {
  org_id: string | null;
  created_at: string;
  metadata: {
    changes?: { status?: { from?: string | null; to?: string | null } };
    pg_application_name?: string | null;
  } | null;
}

export interface OrgResetSummary {
  orgId: string;
  count: number;
  firstAt: string;
  app: string;
}

/**
 * Puro (testável): dos eventos de `lead.lifecycle_direct_update`, mantém apenas
 * as reversões de status PARA 'new' vindas de fora do app e agrupa por org.
 *
 * "Fora do app" = pg_application_name != 'postgrest'. As mutações legítimas via
 * Server Action passam pelo PostgREST ('postgrest'); os resets nocivos vêm do
 * SQL Editor / Management API ('mgmt-api') ou de scripts diretos. Só contam
 * transições de outro status → 'new' (é o que faz o lead já contatado reaparecer
 * como novo); mudanças para outros status não são o alvo deste alerta.
 */
export function summarizeDirectResets(rows: AuditRow[]): OrgResetSummary[] {
  const byOrg = new Map<string, OrgResetSummary>();
  for (const r of rows) {
    if (!r.org_id) continue;
    const ch = r.metadata?.changes?.status;
    if (!ch || ch.to !== 'new' || ch.from == null || ch.from === 'new') continue;
    const app = r.metadata?.pg_application_name ?? 'desconhecido';
    if (app === 'postgrest') continue; // caminho normal da aplicação

    const cur = byOrg.get(r.org_id);
    if (cur) {
      cur.count += 1;
      if (r.created_at < cur.firstAt) cur.firstAt = r.created_at;
    } else {
      byOrg.set(r.org_id, { orgId: r.org_id, count: 1, firstAt: r.created_at, app });
    }
  }
  return [...byOrg.values()];
}

/**
 * Guard-rail: detecta reversões em massa de status → 'new' feitas por acesso
 * direto ao banco (fora do app) nas últimas 24h e avisa os managers da org.
 *
 * Contexto: leads já contatados vinham sendo revertidos para 'new' por UPDATE
 * manual no SQL Editor (audit_log `lead.lifecycle_direct_update`, "bypassed
 * Server Actions"), fazendo-os reaparecer como "Novo" e distorcendo o funil.
 * Reprospecção deve passar pelo fluxo de reabrir/re-enroll do app. Este job
 * transforma "descobrir semanas depois" em "saber em 24h". Somente leitura +
 * notificação (não altera dado).
 */
export async function detectDirectStatusResets(): Promise<
  ActionResult<{ orgsAlerted: number; totalLeads: number }>
> {
  const supabase = createServiceRoleClient();
  const cutoffISO = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();

  const { data, error } = (await from(supabase, 'audit_log')
    .select('org_id, created_at, metadata')
    .eq('action', 'lead.lifecycle_direct_update')
    .gte('created_at', cutoffISO)
    .limit(5000)) as { data: AuditRow[] | null; error: { message: string } | null };

  if (error) {
    console.error('[status-reset-alert] Failed to read audit_log:', error.message);
    return { success: false, error: error.message };
  }

  const offenders = summarizeDirectResets(data ?? []).filter((s) => s.count >= BULK_THRESHOLD);

  // Dedup: um alerta por org por dia (BRT, DST-safe).
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  let orgsAlerted = 0;
  let totalLeads = 0;

  for (const s of offenders) {
    try {
      const { count: existing } = (await from(supabase, 'notifications')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', s.orgId)
        .eq('type', 'integration_error')
        .gte('created_at', `${today}T03:00:00.000Z`)
        .contains('metadata', { alert_type: 'bulk_status_reset' })) as { count: number | null };

      if ((existing ?? 0) > 0) continue;

      const firstBrt = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date(s.firstAt));

      await createNotificationsForOrgMembers({
        orgId: s.orgId,
        type: 'integration_error',
        title: `⚠️ ${s.count} leads revertidos para "Novo" por acesso direto ao banco`,
        body:
          `${s.count} leads tiveram o status revertido para "Novo" nas últimas 24h por ` +
          `alteração direta no banco (fora do app, origem "${s.app}"), a partir de ${firstBrt}. ` +
          `Isso faz leads já contatados reaparecerem como novos e distorce o funil. ` +
          `Reprospecção deve usar o fluxo de reabrir/re-enroll do app, nunca SQL direto. ` +
          `Confira quem executou no audit log do painel do Supabase.`,
        resourceType: 'integration',
        metadata: {
          alert_type: 'bulk_status_reset',
          count: s.count,
          app: s.app,
          first_at: s.firstAt,
        },
        roleFilter: 'manager',
      });

      orgsAlerted += 1;
      totalLeads += s.count;
      console.warn(
        `[status-reset-alert] Alert: org=${s.orgId} count=${s.count} app=${s.app}`,
      );
    } catch (err) {
      console.error(`[status-reset-alert] Error for org=${s.orgId}:`, err);
    }
  }

  console.warn(
    `[status-reset-alert] Complete: orgs_alerted=${orgsAlerted} total_leads=${totalLeads}`,
  );
  return { success: true, data: { orgsAlerted, totalLeads } };
}
