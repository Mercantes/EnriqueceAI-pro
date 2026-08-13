import { NextResponse } from 'next/server';

import { verifyServiceRole } from '@/lib/auth/verify-service-role';
import { from } from '@/lib/supabase/from';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { CRMRegistry } from '@/features/integrations/services/crm-registry';
import { ensureFreshCredentials } from '@/features/integrations/services/crm-token';
import { KommoAdapter, KOMMO_WON_STATUS_ID } from '@/features/integrations/services/kommo.adapter';
import type { CrmConnectionRow } from '@/features/integrations/types/crm';

export const maxDuration = 300;

// Window in which the erroneous backfill moved deals to "Venda ganha".
const DEFAULT_SINCE = '2026-08-13T10:35:00+00:00';
// How close a Kommo status event must be to our deal_won marker to count as
// "the move we made" (seconds).
const MATCH_WINDOW_SECONDS = 300;

interface Marker {
  id: string;
  lead_id: string;
  external_id: string;
  created_at: string;
}

/**
 * Reverts ONLY the moves the backfill made today, each to the EXACT stage the
 * deal sat in immediately before we touched it. Source of truth is Kommo's own
 * event log: for each deal_won marker we wrote, we find the lead_status_changed
 * event to status 142 that happened right when we wrote the marker, and move the
 * deal back to that event's value_before.
 *
 * Safety by construction:
 *  - Deals that were ALREADY won before today have no in-window status event
 *    (our PATCH 142→142 produced no change), so they are never reverted.
 *  - A deal is only moved when it is STILL at 142 now (per the events log), so we
 *    never regress a deal someone moved on after us.
 *
 * Drains the deal_won markers (deletes each processed one), so call repeatedly
 * until `found` is 0.
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
  const limit = Math.min(body.limit ?? 40, 100);

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
    return NextResponse.json({ orgId, found: 0, message: 'nada a reverter (marcadores drenados)' });
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
  const pipelineId = parseInt(connection.default_pipeline_id ?? '13390831', 10);

  const adapter = CRMRegistry.getAdapter('kommo') as KommoAdapter;

  const results: Array<{
    dealId: string;
    action: 'reverted' | 'skipped';
    fromStage?: number;
    toStage?: number;
    reason?: string;
    error?: string;
  }> = [];
  let reverted = 0;
  let skipped = 0;
  let failed = 0;

  for (const m of markers) {
    const markerUnix = Math.floor(new Date(m.created_at).getTime() / 1000);
    try {
      const { data: fresh } = (await from(supabase, 'crm_connections')
        .select('*')
        .eq('id', connection.id)
        .single()) as { data: CrmConnectionRow | null };
      const creds = await ensureFreshCredentials(fresh ?? connection, adapter, supabase);

      const events = await adapter.getStatusChangeEvents(creds, m.external_id);
      const current = events[0]?.after ?? null; // events sorted newest-first
      // Our move: a change TO 142 that happened right when we wrote the marker.
      const myMove = events.find(
        (e) => e.after === KOMMO_WON_STATUS_ID && Math.abs(e.createdAt - markerUnix) <= MATCH_WINDOW_SECONDS,
      );

      if (!myMove || myMove.before == null) {
        skipped++;
        results.push({ dealId: m.external_id, action: 'skipped', reason: 'sem evento de move nosso (ganho antes de hoje ou deal ausente)' });
      } else if (current !== KOMMO_WON_STATUS_ID) {
        skipped++;
        results.push({ dealId: m.external_id, action: 'skipped', fromStage: myMove.before, reason: `já não está em ganho (status atual ${current})` });
      } else if (!dryRun) {
        await adapter.updateDealStatus(creds, m.external_id, pipelineId, myMove.before);
        reverted++;
        results.push({ dealId: m.external_id, action: 'reverted', fromStage: KOMMO_WON_STATUS_ID, toStage: myMove.before });
      } else {
        reverted++;
        results.push({ dealId: m.external_id, action: 'reverted', fromStage: KOMMO_WON_STATUS_ID, toStage: myMove.before });
      }

      // Drain the marker (except in dry-run, which must not mutate state).
      if (!dryRun) {
        await from(supabase, 'interactions').delete().eq('id', m.id);
      }
    } catch (err) {
      failed++;
      results.push({ dealId: m.external_id, action: 'skipped', error: err instanceof Error ? err.message.slice(0, 200) : String(err) });
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return NextResponse.json({ orgId, dryRun, found: markers.length, reverted, skipped, failed, results });
}
