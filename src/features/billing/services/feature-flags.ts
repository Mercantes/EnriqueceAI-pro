import type { PlanFeatures, PlanRow } from '../types';

export interface UsageLimits {
  leads: { current: number; max: number; exceeded: boolean };
  aiPerDay: { current: number; max: number; exceeded: boolean; unlimited: boolean };
  whatsappPerMonth: { current: number; max: number; exceeded: boolean };
  users: { current: number; included: number; additional: number };
}

export function checkFeature(
  features: PlanFeatures,
  feature: keyof PlanFeatures,
): boolean {
  const value = features[feature];
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value !== 'basic';
  return !!value;
}

export function calculateUsageLimits(
  plan: PlanRow,
  currentLeads: number,
  aiUsedToday: number,
  waUsedThisMonth: number,
  memberCount: number,
): UsageLimits {
  const aiUnlimited = plan.max_ai_per_day === -1;
  const additionalUsers = Math.max(0, memberCount - plan.included_users);

  return {
    leads: {
      current: currentLeads,
      max: plan.max_leads,
      exceeded: currentLeads >= plan.max_leads,
    },
    aiPerDay: {
      current: aiUsedToday,
      max: plan.max_ai_per_day,
      exceeded: !aiUnlimited && aiUsedToday >= plan.max_ai_per_day,
      unlimited: aiUnlimited,
    },
    whatsappPerMonth: {
      current: waUsedThisMonth,
      max: plan.max_whatsapp_per_month,
      exceeded: waUsedThisMonth >= plan.max_whatsapp_per_month,
    },
    users: {
      current: memberCount,
      included: plan.included_users,
      additional: additionalUsers,
    },
  };
}

export function calculateMonthlyTotal(
  plan: PlanRow,
  memberCount: number,
): number {
  const additionalUsers = Math.max(0, memberCount - plan.included_users);
  return plan.price_cents + additionalUsers * plan.additional_user_price_cents;
}

export function isNearLimit(current: number, max: number, threshold = 0.8): boolean {
  if (max <= 0) return false;
  return current / max >= threshold;
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}
