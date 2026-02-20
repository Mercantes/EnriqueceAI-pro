'use client';

import { AlertTriangle, Check, CreditCard, Users, Zap } from 'lucide-react';

import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Progress } from '@/shared/components/ui/progress';

import { formatCents, isNearLimit } from '../services/feature-flags';
import type { BillingOverview } from '../types';

interface BillingViewProps {
  data: BillingOverview;
}

function statusLabel(status: string): { label: string; variant: 'default' | 'secondary' | 'destructive' } {
  switch (status) {
    case 'active':
      return { label: 'Ativa', variant: 'default' };
    case 'trialing':
      return { label: 'Trial', variant: 'secondary' };
    case 'past_due':
      return { label: 'Pagamento pendente', variant: 'destructive' };
    case 'canceled':
      return { label: 'Cancelada', variant: 'destructive' };
    default:
      return { label: status, variant: 'secondary' };
  }
}

export function BillingView({ data }: BillingViewProps) {
  const { plan, subscription, memberCount, additionalUsers, monthlyTotal, aiUsageToday, whatsappUsage } = data;
  const status = statusLabel(subscription.status);
  const aiUnlimited = plan.max_ai_per_day === -1;

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="size-4" />
            Plano Atual
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold">{plan.name}</p>
              <p className="text-sm text-[var(--muted-foreground)]">
                {formatCents(plan.price_cents)}/mês
                {additionalUsers > 0 && (
                  <span>
                    {' '}+ {additionalUsers} usuário{additionalUsers > 1 ? 's' : ''} adicional
                    ({formatCents(additionalUsers * plan.additional_user_price_cents)})
                  </span>
                )}
              </p>
            </div>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>

          <div className="rounded-lg bg-[var(--muted)] p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--muted-foreground)]">Total mensal</span>
              <span className="font-semibold">{formatCents(monthlyTotal)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-[var(--muted-foreground)]">Período atual</p>
              <p className="font-medium">
                {new Date(subscription.current_period_start).toLocaleDateString('pt-BR')} —{' '}
                {new Date(subscription.current_period_end).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <div>
              <p className="text-[var(--muted-foreground)]">Membros</p>
              <p className="font-medium">
                {memberCount} de {plan.included_users} inclusos
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage Limits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="size-4" />
            Uso do Plano
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* AI Usage */}
          <UsageBar
            label="IA (hoje)"
            current={aiUsageToday.used}
            max={aiUsageToday.limit}
            unlimited={aiUnlimited}
          />

          {/* WhatsApp Usage */}
          <UsageBar
            label="WhatsApp (mês)"
            current={whatsappUsage.used}
            max={whatsappUsage.limit}
          />

          {/* Users */}
          <UsageBar
            label="Usuários"
            current={memberCount}
            max={plan.included_users}
            overageLabel={additionalUsers > 0 ? `+${additionalUsers} adicional` : undefined}
          />
        </CardContent>
      </Card>

      {/* Features */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4" />
            Recursos do Plano
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <FeatureItem label="Leads" value={`Até ${plan.max_leads.toLocaleString('pt-BR')}`} />
            <FeatureItem
              label="IA por dia"
              value={aiUnlimited ? 'Ilimitado' : `${plan.max_ai_per_day} gerações`}
            />
            <FeatureItem
              label="WhatsApp por mês"
              value={`${plan.max_whatsapp_per_month.toLocaleString('pt-BR')} mensagens`}
            />
            <FeatureItem
              label="Usuários inclusos"
              value={`${plan.included_users} usuário${plan.included_users > 1 ? 's' : ''}`}
            />
            <FeatureItem
              label="Enriquecimento"
              value={plan.features.enrichment === 'full' ? 'Completo' : plan.features.enrichment === 'lemit' ? 'Intermediário' : 'Básico'}
            />
            <FeatureItem label="CRM" value={plan.features.crm ? 'Incluído' : 'Não incluído'} enabled={plan.features.crm} />
            <FeatureItem label="Calendário" value={plan.features.calendar ? 'Incluído' : 'Não incluído'} enabled={plan.features.calendar} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface UsageBarProps {
  label: string;
  current: number;
  max: number;
  unlimited?: boolean;
  overageLabel?: string;
}

function UsageBar({ label, current, max, unlimited, overageLabel }: UsageBarProps) {
  const percentage = unlimited ? 0 : max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const nearLimit = !unlimited && isNearLimit(current, max);
  const exceeded = !unlimited && max > 0 && current >= max;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-[var(--muted-foreground)]">
          {unlimited ? (
            `${current} (ilimitado)`
          ) : (
            <>
              {current} / {max}
              {overageLabel && <span className="ml-1 text-amber-600">({overageLabel})</span>}
            </>
          )}
        </span>
      </div>
      {!unlimited && (
        <div className="flex items-center gap-2">
          <Progress
            value={percentage}
            className={exceeded ? '[&>[data-slot=progress-indicator]]:bg-red-500' : nearLimit ? '[&>[data-slot=progress-indicator]]:bg-amber-500' : ''}
          />
          {(nearLimit || exceeded) && (
            <AlertTriangle className="size-4 shrink-0 text-amber-500" />
          )}
        </div>
      )}
    </div>
  );
}

interface FeatureItemProps {
  label: string;
  value: string;
  enabled?: boolean;
}

function FeatureItem({ label, value, enabled }: FeatureItemProps) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <span className="flex items-center gap-1 font-medium">
        {enabled !== undefined && (
          <Check className={`size-3.5 ${enabled ? 'text-green-500' : 'text-[var(--muted-foreground)]'}`} />
        )}
        {value}
      </span>
    </div>
  );
}
