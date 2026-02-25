'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { requireAuth } from '@/lib/auth/require-auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import { originateCall } from '@/features/integrations/services/api4com.service';

interface InitiateCallInput {
  phone: string;
  leadId?: string;
  extraMetadata?: Record<string, string>;
}

interface InitiateCallResult {
  callId: string;
  api4comId: string;
}

export async function initiateApi4ComCall(
  input: InitiateCallInput,
): Promise<ActionResult<InitiateCallResult>> {
  const user = await requireAuth();
  const supabase = await createServerSupabaseClient();

  const { data: member } = (await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()) as { data: { org_id: string } | null };

  if (!member) {
    return { success: false, error: 'Organização não encontrada' };
  }

  const gateway = `flux-${member.org_id}`;

  try {
    const { data: api4comResponse, ramal } = await originateCall(user.id, input.phone, {
      gateway,
      ...input.extraMetadata,
    });

    // Create call record with api4com_call_id in metadata for webhook correlation
    const { data: call, error: callError } = (await supabase
      .from('calls')
      .insert({
        org_id: member.org_id,
        user_id: user.id,
        lead_id: input.leadId ?? null,
        origin: ramal,
        destination: input.phone,
        duration_seconds: 0,
        status: 'not_connected',
        type: 'outbound',
        metadata: { api4com_call_id: api4comResponse.id, gateway },
      })
      .select('id')
      .single()) as { data: { id: string } | null; error: { message: string } | null };

    if (callError || !call) {
      console.error('[api4com] Failed to create call record:', callError?.message);
      return { success: false, error: 'Erro ao registrar chamada' };
    }

    return {
      success: true,
      data: { callId: call.id, api4comId: api4comResponse.id },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao iniciar chamada';
    console.error('[api4com] originateCall failed:', message);
    return { success: false, error: message };
  }
}

export async function hangupApi4ComCall(
  api4comCallId: string,
): Promise<ActionResult<void>> {
  const user = await requireAuth();

  try {
    const { hangupCall } = await import('@/features/integrations/services/api4com.service');
    await hangupCall(user.id, api4comCallId);
    return { success: true, data: undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao desligar chamada';
    console.error('[api4com] hangupCall failed:', message);
    return { success: false, error: message };
  }
}
