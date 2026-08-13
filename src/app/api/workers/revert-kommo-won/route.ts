import { NextResponse } from 'next/server';

import { verifyServiceRole } from '@/lib/auth/verify-service-role';
import { from } from '@/lib/supabase/from';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { CRMRegistry } from '@/features/integrations/services/crm-registry';
import { ensureFreshCredentials } from '@/features/integrations/services/crm-token';
import { KommoAdapter } from '@/features/integrations/services/kommo.adapter';
import type { CrmConnectionRow } from '@/features/integrations/types/crm';

export const maxDuration = 300;

// Backfill window that wrongly marked won leads as "Venda ganha" (status 142).
const DEFAULT_SINCE = '2026-08-13T10:35:00+00:00';
// "Feedback" stage (default_stage_id) — fallback target when a lead has no
// recorded creation stage.
const FALLBACK_STAGE = 103287655;

interface Marker {
  id: string;
  lead_id: string;
  external_id: string;
  created_at: string;
}

/**
 * Reverts the erroneous backfill that moved every won lead's Kommo deal to
 * "Venda ganha". For each deal_won marker written since `since`, moves the deal
 * back to its pre-backfill stage (the lead's creation stage, which is where
 * these idle deals sat) and removes the deal_won marker.
 *
 * Deals that were RECREATED by the backfill (a fresh crm_deal_created in the
 * window) are also moved off "won", and their ids are returned in
 * `recreatedDeals` so they can be deleted manually (they did not exist before —
 * this worker never hard-deletes).
 *
 * It DELETES the processed deal_won markers, so call repeatedly with offset=0
 * until `found` is 0 (each call drains the next batch).
 *
 * POST /api/workers/revert-kommo-won
 * Body: { orgId, since?, dryRun?, limit? }
 * Auth: Bearer SUPABASE_SERVICE_ROLE_KEY
 */
export async function POST(request: Request) {
  if (!verifyServiceRole(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as {
    orgId?: string;
    since?: string;
    dryRun?: boolean;
    limit?: number;
  };
  const orgId = body.orgId;
  const since = body.since ?? DEFAULT_SINCE;
  const dryRun = body.dryRun === true;
  const limit = Math.min(body.limit ?? 50, 200);

  if (!orgId) {
    return NextResponse.json({ error: 'orgId required' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: markers } = (await from(supabase, 'interactions')
    .select('id, lead_id, external_id, created_at')
    .eq('org_id', orgId)
    .eq('type', 'crm_synced')
    .eq('metadata->>event', 'deal_won')
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(limit)) as { data: Marker[] | null };

  if (!markers || markers.length === 0) {
    return NextResponse.json({ orgId, found: 0, message: 'nada a reverter (janela drenada)' });
  }

  const { data: connection } = (await from(supabase, 'crm_connections')
    .select('*')
    .eq('org_id', orgId)
    .eq('crm_provider', 'kommo')
    .eq('status', 'connected')
    .maybeSingle()) as { data: CrmConnectionRow | null };

  if (!connection) {
    return NextResponse.json({ error: 'no connected kommo connection' }, { status: 400 });
  }
  const pipelineId = parseInt(connection.default_pipeline_id ?? String(FALLBACK_STAGE), 10);

  // Resolve target stage + recreated flag per marker.
  const items: Array<{ leadId: string; dealId: string; markerId: string; targetStage: number; recreated: boolean }> = [];
  for (const m of markers) {
    const { data: dc } = (await from(supabase, 'interactions')
      .select('created_at, metadata')
      .eq('lead_id', m.lead_id)
      .eq('type', 'crm_deal_created')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()) as { data: { created_at: string; metadata: Record<string, unknown> | null } | null };

    const rawStage = dc?.metadata?.stage_id;
    const targetStage = parseInt(typeof rawStage === 'string' ? rawStage : String(FALLBACK_STAGE), 10) || FALLBACK_STAGE;
    const recreated = dc ? new Date(dc.created_at).getTime() >= new Date(since).getTime() : false;
    items.push({ leadId: m.lead_id, dealId: m.external_id, markerId: m.id, targetStage, recreated });
  }

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      orgId,
      found: items.length,
      recreatedDeals: items.filter((i) => i.recreated).map((i) => i.dealId),
      byTargetStage: items.reduce<Record<string, number>>((acc, i) => {
        acc[i.targetStage] = (acc[i.targetStage] ?? 0) + 1;
        return acc;
      }, {}),
      items: items.map((i) => ({ dealId: i.dealId, targetStage: i.targetStage, recreated: i.recreated })),
    });
  }

  const adapter = CRMRegistry.getAdapter('kommo') as KommoAdapter;
  const results: Array<{ dealId: string; targetStage: number; recreated: boolean; ok: boolean; error?: string }> = [];
  const recreatedDeals: string[] = [];
  let reverted = 0;
  let failed = 0;

  for (const it of items) {
    try {
      // Re-fetch connection for fresh (possibly rotated) credentials.
      const { data: fresh } = (await from(supabase, 'crm_connections')
        .select('*')
        .eq('id', connection.id)
        .single()) as { data: CrmConnectionRow | null };
      const creds = await ensureFreshCredentials(fresh ?? connection, adapter, supabase);

      await adapter.updateDealStatus(creds, it.dealId, pipelineId, it.targetStage);
      // Drop the deal_won marker so this lead is no longer counted as won-synced.
      await from(supabase, 'interactions').delete().eq('id', it.markerId);

      reverted++;
      if (it.recreated) recreatedDeals.push(it.dealId);
      results.push({ dealId: it.dealId, targetStage: it.targetStage, recreated: it.recreated, ok: true });
    } catch (err) {
      failed++;
      results.push({
        dealId: it.dealId,
        targetStage: it.targetStage,
        recreated: it.recreated,
        ok: false,
        error: err instanceof Error ? err.message.slice(0, 200) : String(err),
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return NextResponse.json({ orgId, processed: items.length, reverted, failed, recreatedDeals, results });
}
