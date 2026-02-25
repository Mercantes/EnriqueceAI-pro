import { NextResponse } from 'next/server';

import { createServiceRoleClient } from '@/lib/supabase/service';
import {
  createWebhookLogger,
  isEventProcessed,
  markEventProcessed,
} from '@/lib/webhooks';

import type { Api4ComWebhookPayload } from '@/features/integrations/types/api4com';
import type { CallStatus } from '@/features/calls/types';

const logger = createWebhookLogger('api4com');

// Map FreeSWITCH hangup causes to our CallStatus
const hangupCauseToStatus: Record<string, CallStatus> = {
  NO_ANSWER: 'no_contact',
  NO_USER_RESPONSE: 'no_contact',
  USER_BUSY: 'busy',
  CALL_REJECTED: 'not_connected',
  UNALLOCATED_NUMBER: 'not_connected',
  INVALID_NUMBER_FORMAT: 'not_connected',
  // NORMAL_CLEARING and ORIGINATOR_CANCEL keep the existing status
};

export async function POST(request: Request) {
  const rawBody = await request.text();

  let body: Api4ComWebhookPayload;
  try {
    body = JSON.parse(rawBody) as Api4ComWebhookPayload;
  } catch {
    logger.warn('Invalid JSON body');
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (body.eventType !== 'channel-hangup') {
    logger.info('Ignoring non-hangup event', { eventType: body.eventType });
    return NextResponse.json({ received: true });
  }

  const supabase = createServiceRoleClient();

  // Idempotency check
  if (await isEventProcessed(supabase, 'api4com', body.id)) {
    logger.info('Event already processed', { id: body.id });
    return NextResponse.json({ received: true });
  }

  // Correlate with our calls table via metadata->api4com_call_id
  const { data: call } = (await (supabase
    .from('calls') as ReturnType<typeof supabase.from>)
    .select('id, status')
    .eq('metadata->>api4com_call_id', body.id)
    .maybeSingle()) as { data: { id: string; status: CallStatus } | null };

  if (!call) {
    // Fallback: try matching by caller (ramal) + called (phone)
    const calledNormalized = body.called.replace(/\D/g, '');
    const { data: fallbackCall } = (await (supabase
      .from('calls') as ReturnType<typeof supabase.from>)
      .select('id, status')
      .eq('origin', body.caller)
      .like('destination', `%${calledNormalized.slice(-8)}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()) as { data: { id: string; status: CallStatus } | null };

    if (!fallbackCall) {
      logger.warn('No matching call found', {
        api4comId: body.id,
        caller: body.caller,
        called: body.called,
      });
      // Still mark as processed to avoid re-processing
      await markEventProcessed(supabase, 'api4com', body.id, 'channel-hangup.no_match');
      return NextResponse.json({ received: true });
    }

    await updateCallFromWebhook(supabase, fallbackCall.id, fallbackCall.status, body);
    await markEventProcessed(supabase, 'api4com', body.id, 'channel-hangup.fallback');

    logger.info('Call updated via fallback', { callId: fallbackCall.id, api4comId: body.id });
    return NextResponse.json({ received: true });
  }

  await updateCallFromWebhook(supabase, call.id, call.status, body);
  await markEventProcessed(supabase, 'api4com', body.id, 'channel-hangup');

  logger.info('Call updated', { callId: call.id, api4comId: body.id });
  return NextResponse.json({ received: true });
}

async function updateCallFromWebhook(
  supabase: ReturnType<typeof createServiceRoleClient>,
  callId: string,
  currentStatus: CallStatus,
  payload: Api4ComWebhookPayload,
) {
  const updates: Record<string, unknown> = {
    duration_seconds: payload.duration,
    recording_url: payload.recordUrl || null,
  };

  // Set started_at from webhook if available
  if (payload.startedAt) {
    updates.started_at = payload.startedAt;
  }

  // Only override status if hangup cause maps to a specific status
  // and the current status hasn't been manually set by the SDR
  const mappedStatus = hangupCauseToStatus[payload.hangupCause];
  if (mappedStatus && currentStatus === 'not_connected') {
    updates.status = mappedStatus;
  }

  // If the call was answered and has duration, it was connected
  if (payload.answeredAt && payload.duration > 0 && currentStatus === 'not_connected') {
    updates.status = 'significant';
  }

  await (supabase
    .from('calls') as ReturnType<typeof supabase.from>)
    .update(updates)
    .eq('id', callId);
}
