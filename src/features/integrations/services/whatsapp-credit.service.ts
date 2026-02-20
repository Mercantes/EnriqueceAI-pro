import type { SupabaseClient } from '@supabase/supabase-js';

import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface CreditCheckResult {
  allowed: boolean;
  used: number;
  limit: number;
  isOverage: boolean;
  error?: string;
}

/**
 * Controls WhatsApp credit consumption per organization per month.
 */
export class WhatsAppCreditService {
  /**
   * Checks if the org has credits and deducts one.
   * If the row for the current period doesn't exist, creates it from the plan.
   * Over-limit sends are allowed but flagged as overage.
   */
  static async checkAndDeductCredit(
    orgId: string,
    supabaseClient?: SupabaseClient,
  ): Promise<CreditCheckResult> {
    const supabase = supabaseClient ?? await createServerSupabaseClient();
    const period = getCurrentPeriod();

    // Try to fetch existing credit row for this period
    const { data: credit } = (await (supabase
      .from('whatsapp_credits') as ReturnType<typeof supabase.from>)
      .select('id, plan_credits, used_credits, overage_count')
      .eq('org_id', orgId)
      .eq('period', period)
      .maybeSingle()) as {
        data: { id: string; plan_credits: number; used_credits: number; overage_count: number } | null;
      };

    if (credit) {
      return deductFromExisting(supabase, credit);
    }

    // No row for this period — create one from the org's plan
    return createAndDeduct(supabase, orgId, period);
  }
}

function getCurrentPeriod(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

async function deductFromExisting(
  supabase: SupabaseClient,
  credit: { id: string; plan_credits: number; used_credits: number; overage_count: number },
): Promise<CreditCheckResult> {
  const isOverage = credit.used_credits >= credit.plan_credits;

  const updatePayload: Record<string, unknown> = {
    used_credits: credit.used_credits + 1,
  };
  if (isOverage) {
    updatePayload.overage_count = credit.overage_count + 1;
  }

  await (supabase.from('whatsapp_credits') as ReturnType<typeof supabase.from>)
    .update(updatePayload as Record<string, unknown>)
    .eq('id', credit.id);

  return {
    allowed: true,
    used: credit.used_credits + 1,
    limit: credit.plan_credits,
    isOverage,
  };
}

async function createAndDeduct(
  supabase: SupabaseClient,
  orgId: string,
  period: string,
): Promise<CreditCheckResult> {
  // Fetch plan limit via subscription
  const { data: sub } = (await (supabase
    .from('subscriptions') as ReturnType<typeof supabase.from>)
    .select('plan:plans(max_whatsapp_per_month)')
    .eq('org_id', orgId)
    .in('status', ['active', 'trialing'])
    .maybeSingle()) as {
      data: { plan: { max_whatsapp_per_month: number } } | null;
    };

  const planCredits = sub?.plan?.max_whatsapp_per_month ?? 0;

  if (planCredits === 0) {
    return { allowed: false, used: 0, limit: 0, isOverage: false, error: 'Sem plano WhatsApp ativo' };
  }

  // Insert the row for this period (deducting 1 immediately)
  const { error: insertError } = await (supabase
    .from('whatsapp_credits') as ReturnType<typeof supabase.from>)
    .insert({
      org_id: orgId,
      plan_credits: planCredits,
      used_credits: 1,
      overage_count: 0,
      period,
    } as Record<string, unknown>);

  if (insertError) {
    // Race condition: row was created between our select and insert
    // Retry by fetching the existing row
    const { data: retryCredit } = (await (supabase
      .from('whatsapp_credits') as ReturnType<typeof supabase.from>)
      .select('id, plan_credits, used_credits, overage_count')
      .eq('org_id', orgId)
      .eq('period', period)
      .maybeSingle()) as {
        data: { id: string; plan_credits: number; used_credits: number; overage_count: number } | null;
      };

    if (retryCredit) {
      return deductFromExisting(supabase, retryCredit);
    }

    return { allowed: false, used: 0, limit: planCredits, isOverage: false, error: 'Falha ao criar créditos' };
  }

  return {
    allowed: true,
    used: 1,
    limit: planCredits,
    isOverage: false,
  };
}
