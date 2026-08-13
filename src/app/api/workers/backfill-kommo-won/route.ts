import { NextResponse } from 'next/server';

import { verifyServiceRole } from '@/lib/auth/verify-service-role';
import { from } from '@/lib/supabase/from';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { markDealWonInCrm } from '@/features/leads/services/crm-push.service';

export const maxDuration = 300;

/**
 * One-shot worker that regularizes the CRM for leads already marked "won" in the
 * app: it ensures each won lead's deal exists AND moves it into the CRM's "won"
 * column (Kommo status 142). This backfills the historical gap where marking a
 * lead won never propagated the stage change to Kommo.
 *
 * markDealWonInCrm is idempotent on the CRM side (re-PATCHing the same status is
 * a no-op), and this route skips leads that already carry a `deal_won` sync
 * marker so re-running only touches what's left.
 *
 * Because the move-to-won PATCH also tells us whether a deal still exists in
 * Kommo (200 = moved, 404 = deal deleted CRM-side), the per-lead `result` here
 * doubles as confirmation for specific leads (e.g. Safra Bag / Tevali).
 *
 * Process in chunks via limit+offset to stay under proxy request timeouts.
 *
 * POST /api/workers/backfill-kommo-won
 * Body: { orgId: string, dryRun?: boolean, limit?: number, offset?: number, force?: boolean }
 * Auth: Bearer SUPABASE_SERVICE_ROLE_KEY
 */
export async function POST(request: Request) {
  if (!verifyServiceRole(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as {
    orgId?: string;
    dryRun?: boolean;
    limit?: number;
    offset?: number;
    force?: boolean;
  };
  const orgId = body.orgId;
  const dryRun = body.dryRun === true;
  const force = body.force === true;
  const limit = Math.min(body.limit ?? 100, 500);
  const offset = Math.max(body.offset ?? 0, 0);

  if (!orgId) {
    return NextResponse.json({ error: 'orgId required' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  // All won leads for the org, stable order so limit+offset paginate cleanly.
  const { data: wonLeads } = (await from(supabase, 'leads')
    .select('id, nome_fantasia, razao_social, won_at')
    .eq('org_id', orgId)
    .eq('status', 'won')
    .is('deleted_at', null)
    .order('won_at', { ascending: true })
    .range(offset, offset + limit - 1)) as {
    data: Array<{ id: string; nome_fantasia: string | null; razao_social: string | null; won_at: string | null }> | null;
  };

  if (!wonLeads || wonLeads.length === 0) {
    return NextResponse.json({ orgId, offset, limit, found: 0, message: 'No won leads in range' });
  }

  // Skip leads already carrying a deal_won marker (unless force), so re-runs are cheap.
  const pending: typeof wonLeads = [];
  let alreadyWon = 0;
  for (const lead of wonLeads) {
    if (force) {
      pending.push(lead);
      continue;
    }
    const { data: doneMarker } = (await from(supabase, 'interactions')
      .select('id')
      .eq('lead_id', lead.id)
      .eq('type', 'crm_synced')
      .eq('metadata->>event', 'deal_won')
      .limit(1)
      .maybeSingle()) as { data: { id: string } | null };
    if (doneMarker) alreadyWon++;
    else pending.push(lead);
  }

  const labelOf = (l: { nome_fantasia: string | null; razao_social: string | null }) =>
    l.nome_fantasia ?? l.razao_social ?? '(sem nome)';

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      orgId,
      offset,
      limit,
      rangeCount: wonLeads.length,
      alreadyWon,
      pending: pending.length,
      leads: pending.map((l) => ({ id: l.id, name: labelOf(l), won_at: l.won_at })),
    });
  }

  const results: Array<{ id: string; name: string; movedToWon: boolean; dealExternalId?: string; skippedReason?: string; error?: string }> = [];
  let movedToWon = 0;
  let dealCreated = 0;
  let skipped = 0;
  let failed = 0;

  for (const lead of pending) {
    try {
      const r = await markDealWonInCrm(orgId, lead.id);
      if (r.movedToWon) movedToWon++;
      if (r.dealCreated) dealCreated++;
      if (!r.movedToWon && r.skippedReason) skipped++;
      results.push({
        id: lead.id,
        name: labelOf(lead),
        movedToWon: r.movedToWon === true,
        dealExternalId: r.dealExternalId,
        skippedReason: r.skippedReason,
      });
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : 'unknown';
      results.push({ id: lead.id, name: labelOf(lead), movedToWon: false, error: msg });
    }
    // Gentle pacing to respect Kommo API rate limits.
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return NextResponse.json({
    orgId,
    offset,
    limit,
    rangeCount: wonLeads.length,
    alreadyWonSkipped: alreadyWon,
    processed: pending.length,
    movedToWon,
    dealCreated,
    skipped,
    failed,
    results,
  });
}
