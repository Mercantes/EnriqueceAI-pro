'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { requireAuth } from '@/lib/auth/require-auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import { registerWebhook } from '../services/api4com.service';

/**
 * Register a webhook on API4COM so we receive channel-hangup events.
 * Called automatically after saving API4COM config.
 */
export async function registerApi4ComWebhook(): Promise<ActionResult<void>> {
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const webhookUrl = `${appUrl}/api/webhooks/api4com`;
  const gateway = `flux-${member.org_id}`;

  try {
    await registerWebhook(user.id, webhookUrl, gateway);
    return { success: true, data: undefined };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao registrar webhook';
    console.error('[api4com] registerWebhook failed:', message);
    return { success: false, error: message };
  }
}
