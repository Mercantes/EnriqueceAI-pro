import { NextResponse } from 'next/server';

import { verifyServiceRole } from '@/lib/auth/verify-service-role';
import { from } from '@/lib/supabase/from';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { CRMRegistry } from '@/features/integrations/services/crm-registry';
import { ensureFreshCredentials } from '@/features/integrations/services/crm-token';
import { KommoAdapter, KOMMO_WON_STATUS_ID } from '@/features/integrations/services/kommo.adapter';
import type { CrmConnectionRow } from '@/features/integrations/types/crm';

export const maxDuration = 300;

// Backfill window (UTC unix) in which we moved deals to "Venda ganha" (142).
const BACKFILL_START = 1786617420; // 2026-08-13 10:37:00Z
const BACKFILL_END = 1786619100; // 2026-08-13 11:05:00Z

interface TargetEntry {
  status_id: number;
  loss_reason_id?: number | null;
  closed_at?: number | null;
}

/**
 * Restaura ao estado imediatamente anterior ao backfill (snapshot 10:32 UTC).
 *
 * Entrada (body):
 *  - orgId
 *  - dealIds: number[]      — deals a processar nesta chamada (fatia dos 270 não-recriados)
 *  - manifest: { [id]: {status_id, loss_reason_id?, closed_at?} } — alvo alta-fidelidade (snapshot)
 *  - recreatedIds: number[] — os 33 recriados a DELETAR (guard: só deleta se estiver aqui)
 *  - dryRun
 *
 * Por deal (não-recriado): alvo = manifest[id] OU (fallback) value_before do meu
 * move-para-142 no log de eventos. GET estado atual; só escreve se:
 *   - ainda em 142 (desfaz o ganho falso), OU
 *   - já no status alvo mas com loss_reason/closed_at divergente (corrige metadados
 *     que meu revert parcial carimbou com a data de hoje).
 * Nunca sobrescreve um deal que o time moveu para um 3º status.
 *
 * Recriados: DELETE (guard pela lista).
 */
export async function POST(request: Request) {
  if (!verifyServiceRole(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as {
    orgId?: string;
    dealIds?: number[];
    manifest?: Record<string, TargetEntry>;
    recreatedIds?: number[];
    recoverClosedAtIds?: number[];
    forceMoveIds?: number[];
    dryRun?: boolean;
  };
  const orgId = body.orgId;
  const dryRun = body.dryRun === true;
  const manifest = body.manifest ?? {};
  const recreated = new Set((body.recreatedIds ?? []).map(String));
  const dealIds = (body.dealIds ?? []).map(String);
  // Deals cuja data de perda (closed_at) foi carimbada com hoje pelo revert e
  // deve ser recuperada do log de eventos (timestamp do move-para-143 pré-backfill).
  const recoverClosedAt = (body.recoverClosedAtIds ?? []).map(String);
  // Deals que o revert parcial mis-moveu para o status errado: move ao alvo dos
  // eventos (value_before) INCONDICIONALMENTE, mesmo não estando em 142.
  const forceMove = (body.forceMoveIds ?? []).map(String);

  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });
  if (dealIds.length === 0 && recreated.size === 0 && recoverClosedAt.length === 0 && forceMove.length === 0) {
    return NextResponse.json({ error: 'dealIds, recreatedIds, recoverClosedAtIds or forceMoveIds required' }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data: connection } = (await from(supabase, 'crm_connections')
    .select('*')
    .eq('org_id', orgId)
    .eq('crm_provider', 'kommo')
    .eq('status', 'connected')
    .maybeSingle()) as { data: CrmConnectionRow | null };
  if (!connection) return NextResponse.json({ error: 'no connected kommo connection' }, { status: 400 });

  const pipelineId = parseInt(connection.default_pipeline_id ?? '13390831', 10);
  const adapter = CRMRegistry.getAdapter('kommo') as KommoAdapter;

  const freshCreds = async () => {
    const { data: fresh } = (await from(supabase, 'crm_connections')
      .select('*')
      .eq('id', connection.id)
      .single()) as { data: CrmConnectionRow | null };
    return ensureFreshCredentials(fresh ?? connection, adapter, supabase);
  };

  const results: Array<Record<string, unknown>> = [];
  let restored = 0;
  let deleted = 0;
  let skipped = 0;
  let failed = 0;

  // 1) Restaurar os deals tocados.
  for (const id of dealIds) {
    try {
      const creds = await freshCreds();
      const current = await adapter.getDealFull(creds, id);
      if (!current) {
        skipped++;
        results.push({ dealId: id, action: 'skipped', reason: 'deal inexistente no kommo' });
        continue;
      }

      // Alvo: manifesto (alta fidelidade) ou eventos (value_before do move de hoje).
      let target: TargetEntry | null = manifest[id] ?? null;
      if (!target) {
        const events = await adapter.getStatusChangeEvents(creds, id);
        const myMove = events.find(
          (e) => e.after === KOMMO_WON_STATUS_ID && e.createdAt >= BACKFILL_START && e.createdAt <= BACKFILL_END,
        );
        if (myMove && myMove.before != null) target = { status_id: myMove.before };
      }
      if (!target) {
        skipped++;
        results.push({ dealId: id, action: 'skipped', reason: 'sem alvo (nem manifesto nem evento de move)' });
        continue;
      }

      const wantLoss = target.loss_reason_id ?? null;
      const wantClosed = target.closed_at ?? null;
      const statusMatches = current.statusId === target.status_id;
      const metaMatches =
        (wantLoss == null || current.lossReasonId === wantLoss) &&
        (wantClosed == null || current.closedAt === wantClosed);

      const stillWon = current.statusId === KOMMO_WON_STATUS_ID;
      const needsMetaFix = statusMatches && !metaMatches;

      if (!stillWon && !needsMetaFix) {
        skipped++;
        results.push({ dealId: id, action: 'skipped', from: current.statusId, to: target.status_id, reason: statusMatches ? 'já correto' : 'status atual não é ganho (não sobrescrever)' });
        continue;
      }

      if (!dryRun) {
        await adapter.updateDealFull(creds, id, {
          pipelineId,
          statusId: target.status_id,
          lossReasonId: wantLoss,
          closedAt: wantClosed,
        });
      }
      restored++;
      results.push({ dealId: id, action: 'restored', from: current.statusId, to: target.status_id, lossReason: wantLoss, closedAt: wantClosed });
    } catch (err) {
      failed++;
      results.push({ dealId: id, action: 'failed', error: err instanceof Error ? err.message.slice(0, 180) : String(err) });
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  // 2) Deletar os recriados (guard pela lista).
  for (const id of recreated) {
    try {
      const creds = await freshCreds();
      const current = await adapter.getDealFull(creds, id);
      if (!current) {
        skipped++;
        results.push({ dealId: id, action: 'skipped', reason: 'recriado já inexistente' });
        continue;
      }
      if (!dryRun) {
        await adapter.deleteDeal(creds, id);
      }
      deleted++;
      results.push({ dealId: id, action: 'deleted' });
    } catch (err) {
      failed++;
      results.push({ dealId: id, action: 'failed', error: err instanceof Error ? err.message.slice(0, 180) : String(err) });
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  // 3) Recuperar a data de perda (closed_at) dos deals cujo revert carimbou hoje:
  //    usa o timestamp do move-para-143 PRÉ-backfill no log de eventos do Kommo.
  let closedAtFixed = 0;
  for (const id of recoverClosedAt) {
    try {
      const creds = await freshCreds();
      const events = await adapter.getStatusChangeEvents(creds, id);
      // move-para-perdido (143) mais recente ANTES do backfill = perda original.
      const originalLoss = events
        .filter((e) => e.after === 143 && e.createdAt < BACKFILL_START)
        .sort((a, b) => b.createdAt - a.createdAt)[0];
      if (!originalLoss) {
        skipped++;
        results.push({ dealId: id, action: 'skipped', reason: 'sem evento de perda pré-backfill' });
        continue;
      }
      if (!dryRun) {
        await adapter.updateDealFull(creds, id, { pipelineId, statusId: 143, closedAt: originalLoss.createdAt });
      }
      closedAtFixed++;
      results.push({ dealId: id, action: 'closed_at_fixed', closedAt: originalLoss.createdAt });
    } catch (err) {
      failed++;
      results.push({ dealId: id, action: 'failed', error: err instanceof Error ? err.message.slice(0, 180) : String(err) });
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  // 4) Force-move: deals mis-movidos pelo revert parcial → alvo dos eventos, incondicional.
  let forceMoved = 0;
  for (const id of forceMove) {
    try {
      const creds = await freshCreds();
      const events = await adapter.getStatusChangeEvents(creds, id);
      const myMove = events.find(
        (e) => e.after === KOMMO_WON_STATUS_ID && e.createdAt >= BACKFILL_START && e.createdAt <= BACKFILL_END,
      );
      if (!myMove || myMove.before == null) {
        skipped++;
        results.push({ dealId: id, action: 'skipped', reason: 'sem alvo (evento de move)' });
        continue;
      }
      const target = myMove.before;
      // Se o alvo é "perdido" (143), recupera também a data original de perda.
      let closedAt: number | null = null;
      if (target === 143) {
        const loss = events
          .filter((e) => e.after === 143 && e.createdAt < BACKFILL_START)
          .sort((a, b) => b.createdAt - a.createdAt)[0];
        closedAt = loss?.createdAt ?? null;
      }
      if (!dryRun) {
        await adapter.updateDealFull(creds, id, { pipelineId, statusId: target, closedAt });
      }
      forceMoved++;
      results.push({ dealId: id, action: 'force_moved', to: target, closedAt });
    } catch (err) {
      failed++;
      results.push({ dealId: id, action: 'failed', error: err instanceof Error ? err.message.slice(0, 180) : String(err) });
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  return NextResponse.json({
    orgId,
    dryRun,
    processed: dealIds.length + recreated.size + recoverClosedAt.length + forceMove.length,
    restored,
    deleted,
    closedAtFixed,
    forceMoved,
    skipped,
    failed,
    results,
  });
}
