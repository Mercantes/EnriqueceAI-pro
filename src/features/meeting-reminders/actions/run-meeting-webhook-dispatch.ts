'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { from } from '@/lib/supabase/from';
import { createServiceRoleClient } from '@/lib/supabase/service';

import {
  runMeetingWebhookDispatch,
  type MeetingWebhookMomento,
  type MeetingWebhookRunSummary,
} from '../services/meeting-webhook-dispatch.service';

const JOB_NAME = 'meeting-webhook-dispatch';

/** Org da V4 Amaral (único tenant que dispara pro n8n por ora). */
const DEFAULT_ORG_ID = 'c2727473-1df8-4faa-9264-a9fc1759fe3b';
const DEFAULT_WEBHOOK_URL = 'https://n8n.v4companyamaral.com/webhook/enriquece/reuniao-marcada';
const DEFAULT_MOMENTOS: MeetingWebhookMomento[] = ['d1', 'dia'];

const ENABLED_FLAG_KEY = 'meeting_webhook_enabled';

function parseMomentos(value: string | undefined): MeetingWebhookMomento[] {
  const parsed = (value ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is MeetingWebhookMomento => s === 'd1' || s === 'dia');
  return parsed.length > 0 ? parsed : DEFAULT_MOMENTOS;
}

/**
 * Flag no banco (app_flags) — controle confiável independente da env do Coolify.
 * Defensivo: se a tabela não existir/der erro, retorna false (cai pra env).
 */
async function isDbFlagEnabled(
  supabase: ReturnType<typeof createServiceRoleClient>,
): Promise<boolean> {
  try {
    const { data } = (await from(supabase, 'app_flags' as never)
      .select('enabled')
      .eq('key', ENABLED_FLAG_KEY)
      .limit(1)) as { data: Array<{ enabled: boolean }> | null };
    return data?.[0]?.enabled === true;
  } catch {
    return false;
  }
}

/**
 * Entry-point do dispatcher de webhook de reunião (chamado pela rota cron).
 *
 * Toggles por env (piloto = puro toggle, sem deploy):
 * - MEETING_WEBHOOK_ENABLED='true' habilita o POST (default: dry-run).
 * - MEETING_WEBHOOK_ORG_ID='uuid' sobrescreve a org alvo (default: V4 Amaral).
 * - MEETING_WEBHOOK_MOMENTOS='d1,dia' restringe os momentos (default: ambos).
 * - N8N_MEETING_WEBHOOK_URL / N8N_MEETING_WEBHOOK_SECRET — destino e segredo opcional.
 */
export async function runMeetingWebhookDispatchJob(): Promise<
  ActionResult<MeetingWebhookRunSummary>
> {
  const supabase = createServiceRoleClient();
  const nowIso = new Date().toISOString();

  // Liga por env (Coolify) OU pela flag no banco — o que estiver ligado ativa.
  const envEnabled = process.env.MEETING_WEBHOOK_ENABLED === 'true';
  const enabled = envEnabled || (await isDbFlagEnabled(supabase));

  try {
    const summary = await runMeetingWebhookDispatch(supabase, {
      enabled,
      orgId: process.env.MEETING_WEBHOOK_ORG_ID ?? DEFAULT_ORG_ID,
      webhookUrl: process.env.N8N_MEETING_WEBHOOK_URL ?? DEFAULT_WEBHOOK_URL,
      webhookSecret: process.env.N8N_MEETING_WEBHOOK_SECRET,
      momentos: parseMomentos(process.env.MEETING_WEBHOOK_MOMENTOS),
    });

    try {
      await from(supabase, 'worker_run_state' as never).upsert(
        {
          job_name: JOB_NAME,
          last_run_at: nowIso,
          last_status: 'success',
          last_success_at: nowIso,
          metadata: {
            enabled: summary.enabled,
            candidates: summary.candidates,
            sent: summary.sent,
            failed: summary.failed,
            skipped: summary.skipped,
          },
        } as never,
        { onConflict: 'job_name' } as never,
      );
    } catch (err) {
      console.warn('[meeting-webhook] failed to write run state:', err);
    }

    return { success: true, data: summary };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'erro desconhecido';
    try {
      await from(supabase, 'worker_run_state' as never).upsert(
        { job_name: JOB_NAME, last_run_at: nowIso, last_status: 'error', metadata: { error: msg } } as never,
        { onConflict: 'job_name' } as never,
      );
    } catch {
      // best-effort
    }
    return { success: false, error: msg };
  }
}
