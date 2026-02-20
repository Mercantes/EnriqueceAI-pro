'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { requireAuth } from '@/lib/auth/require-auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';

import { AIService } from '../services/ai.service';
import type { AIUsageInfo, GenerateMessageRequest, GenerateMessageResult } from '../types';

async function getOrgId(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, userId: string) {
  const { data: member } = (await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()) as { data: { org_id: string } | null };
  return member?.org_id ?? null;
}

export async function generateMessageAction(
  request: GenerateMessageRequest,
): Promise<ActionResult<GenerateMessageResult>> {
  try {
    const user = await requireAuth();
    const supabase = await createServerSupabaseClient();
    const orgId = await getOrgId(supabase, user.id);
    if (!orgId) return { success: false, error: 'Organização não encontrada', code: 'NO_ORG' };

    // Validate input
    if (!request.channel || !request.tone || !request.leadContext) {
      return { success: false, error: 'Parâmetros inválidos', code: 'INVALID_PARAMS' };
    }

    if (!request.leadContext.nome_fantasia && !request.leadContext.razao_social) {
      return { success: false, error: 'Lead deve ter nome fantasia ou razão social', code: 'MISSING_LEAD_NAME' };
    }

    const result = await AIService.generateMessage(request, orgId);
    return { success: true, data: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao gerar mensagem';

    if (message.includes('Limite diário')) {
      return { success: false, error: message, code: 'RATE_LIMIT' };
    }
    if (message.includes('ANTHROPIC_API_KEY')) {
      return { success: false, error: 'Serviço de IA não configurado', code: 'NOT_CONFIGURED' };
    }

    return { success: false, error: message };
  }
}

export async function getAIUsageAction(): Promise<ActionResult<AIUsageInfo>> {
  try {
    const user = await requireAuth();
    const supabase = await createServerSupabaseClient();
    const orgId = await getOrgId(supabase, user.id);
    if (!orgId) return { success: false, error: 'Organização não encontrada', code: 'NO_ORG' };

    const usage = await AIService.getUsage(orgId);
    return { success: true, data: usage };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao buscar uso de IA';
    return { success: false, error: message };
  }
}
