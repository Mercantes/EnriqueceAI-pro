'use server';

import type { ActionResult } from '@/lib/actions/action-result';
import { getAuthOrgId } from '@/lib/auth/get-org-id';

import { AIService } from '../services/ai.service';
import type { AIUsageInfo, GenerateMessageRequest, GenerateMessageResult } from '../types';

export async function generateMessageAction(
  request: GenerateMessageRequest,
): Promise<ActionResult<GenerateMessageResult>> {
  try {
    const { orgId } = await getAuthOrgId();

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
    const { orgId } = await getAuthOrgId();

    const usage = await AIService.getUsage(orgId);
    return { success: true, data: usage };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao buscar uso de IA';
    return { success: false, error: message };
  }
}
