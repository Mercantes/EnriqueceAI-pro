import { createServerSupabaseClient } from '@/lib/supabase/server';

import { buildPersonalizationPrompt, buildPrompt } from '../prompts';
import type {
  AIUsageInfo,
  AIUsageRow,
  ChannelTarget,
  GenerateMessageRequest,
  GenerateMessageResult,
  LeadContext,
} from '../types';

const DEFAULT_DAILY_LIMIT = 50;
const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 1024;

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ClaudeResponse {
  content: Array<{ type: string; text?: string }>;
  usage?: { input_tokens: number; output_tokens: number };
}

async function callClaude(messages: ClaudeMessage[]): Promise<{ text: string; tokensUsed: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY não configurada');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error (${response.status}): ${error}`);
  }

  const data = (await response.json()) as ClaudeResponse;
  const textBlock = data.content.find((c) => c.type === 'text');
  const text = textBlock?.text ?? '';
  const tokensUsed = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);

  return { text, tokensUsed };
}

function parseAIResponse(
  raw: string,
  channel: ChannelTarget,
): { subject?: string; body: string } {
  // Clean up possible markdown code blocks
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const parsed = JSON.parse(cleaned) as Record<string, unknown>;

  if (typeof parsed.body !== 'string' || !parsed.body.trim()) {
    throw new Error('Resposta da IA não contém campo "body" válido');
  }

  const result: { subject?: string; body: string } = {
    body: parsed.body.trim(),
  };

  if (channel === 'email' && typeof parsed.subject === 'string' && parsed.subject.trim()) {
    result.subject = parsed.subject.trim();
  }

  return result;
}

export class AIService {
  static async generateMessage(
    request: GenerateMessageRequest,
    orgId: string,
  ): Promise<GenerateMessageResult> {
    // Check rate limit
    await AIService.checkRateLimit(orgId);

    const prompt = buildPrompt(
      request.channel,
      request.tone,
      request.leadContext,
      request.additionalContext,
    );

    const { text, tokensUsed } = await callClaude([
      { role: 'user', content: prompt },
    ]);

    const parsed = parseAIResponse(text, request.channel);

    // Increment usage
    await AIService.incrementUsage(orgId);

    return {
      ...parsed,
      tokensUsed,
    };
  }

  static async personalizeMessage(
    channel: ChannelTarget,
    templateBody: string,
    lead: LeadContext,
    orgId: string,
  ): Promise<GenerateMessageResult> {
    // Check rate limit
    await AIService.checkRateLimit(orgId);

    const prompt = buildPersonalizationPrompt(channel, templateBody, lead);

    const { text, tokensUsed } = await callClaude([
      { role: 'user', content: prompt },
    ]);

    const parsed = parseAIResponse(text, channel);

    // Increment usage
    await AIService.incrementUsage(orgId);

    return {
      ...parsed,
      tokensUsed,
    };
  }

  static async getUsage(orgId: string): Promise<AIUsageInfo> {
    const supabase = await createServerSupabaseClient();
    const today = new Date().toISOString().split('T')[0];

    const { data } = (await (supabase
      .from('ai_usage') as ReturnType<typeof supabase.from>)
      .select('*')
      .eq('org_id', orgId)
      .eq('usage_date', today)
      .maybeSingle()) as { data: AIUsageRow | null };

    if (!data) {
      return { used: 0, limit: DEFAULT_DAILY_LIMIT, remaining: DEFAULT_DAILY_LIMIT };
    }

    const limit = data.daily_limit === -1 ? Infinity : data.daily_limit;
    const remaining = limit === Infinity ? Infinity : Math.max(0, limit - data.generation_count);

    return {
      used: data.generation_count,
      limit: data.daily_limit,
      remaining: remaining === Infinity ? -1 : remaining,
    };
  }

  static async checkRateLimit(orgId: string): Promise<void> {
    const usage = await AIService.getUsage(orgId);
    if (usage.limit !== -1 && usage.remaining === 0) {
      throw new Error('Limite diário de gerações de IA atingido');
    }
  }

  static async incrementUsage(orgId: string): Promise<void> {
    const supabase = await createServerSupabaseClient();
    const today = new Date().toISOString().split('T')[0];

    // Try to update existing row
    const { data: existing } = (await (supabase
      .from('ai_usage') as ReturnType<typeof supabase.from>)
      .select('id, generation_count')
      .eq('org_id', orgId)
      .eq('usage_date', today)
      .maybeSingle()) as { data: { id: string; generation_count: number } | null };

    if (existing) {
      await (supabase.from('ai_usage') as ReturnType<typeof supabase.from>)
        .update({ generation_count: existing.generation_count + 1 } as Record<string, unknown>)
        .eq('id', existing.id);
    } else {
      await (supabase.from('ai_usage') as ReturnType<typeof supabase.from>)
        .insert({
          org_id: orgId,
          usage_date: today,
          generation_count: 1,
          daily_limit: DEFAULT_DAILY_LIMIT,
        } as Record<string, unknown>);
    }
  }
}
