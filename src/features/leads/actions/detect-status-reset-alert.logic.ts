// Núcleo puro do guard-rail de reversão de status — SEM 'use server' (num
// módulo de Server Actions todos os exports precisam ser funções async; a função
// pura e os tipos ficam aqui para poderem ser exportados e testados isoladamente).

export interface AuditRow {
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
 * Dos eventos de `lead.lifecycle_direct_update`, mantém apenas as reversões de
 * status PARA 'new' vindas de fora do app e agrupa por org.
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
