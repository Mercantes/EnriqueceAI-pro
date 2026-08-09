import { NextResponse } from 'next/server';

import { verifyCronSecret } from '@/lib/auth/verify-cron-secret';
import { runMeetingWebhookDispatchJob } from '@/features/meeting-reminders/actions/run-meeting-webhook-dispatch';

export const maxDuration = 60;

export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await runMeetingWebhookDispatchJob();

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  // DEBUG TEMPORÁRIO (remover): diagnostica por que o toggle não liga.
  // Mostra o valor cru que ESTA ROTA lê (aspas/espaço aparecem no JSON.stringify)
  // e compara com o `enabled` que a SERVER ACTION calculou — se a rota casar
  // 'true' mas a action vier false, é inlining de env no build da action.
  const raw = process.env.MEETING_WEBHOOK_ENABLED;
  const debug = {
    route_raw: JSON.stringify(raw ?? null),
    route_len: raw?.length ?? null,
    route_match_true: raw === 'true',
    action_enabled: result.data.enabled,
    url_set: Boolean(process.env.N8N_MEETING_WEBHOOK_URL),
    org_set: Boolean(process.env.MEETING_WEBHOOK_ORG_ID),
  };

  return NextResponse.json({ ok: true, data: result.data, debug });
}
