import { NextResponse } from 'next/server';

import { verifyCronSecret } from '@/lib/auth/verify-cron-secret';
import { detectDirectStatusResets } from '@/features/leads/actions/detect-status-reset-alert';

export const maxDuration = 60;

/**
 * Cron diário: detecta reversões em massa de status de lead → 'new' feitas por
 * acesso direto ao banco (SQL Editor / Management API), fora do app, e notifica
 * os managers da org. Guard-rail contra a corrupção do funil por UPDATE manual.
 * Somente leitura do audit_log + envio de notificação.
 */
export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await detectDirectStatusResets();

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: result.data });
}
