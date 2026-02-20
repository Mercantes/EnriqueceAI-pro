import { CreditCard } from 'lucide-react';

import { requireAuth } from '@/lib/auth/require-auth';

import { EmptyState } from '@/shared/components/EmptyState';

import { fetchBillingOverview, fetchPlanComparison } from '@/features/billing/actions/fetch-billing';
import { BillingView } from '@/features/billing/components/BillingView';
import { PlanComparisonView } from '@/features/billing/components/PlanComparison';

export default async function BillingPage() {
  await requireAuth();

  const [overviewResult, comparisonResult] = await Promise.all([
    fetchBillingOverview(),
    fetchPlanComparison(),
  ]);

  if (!overviewResult.success) {
    return (
      <EmptyState
        icon={CreditCard}
        title="Billing"
        description={overviewResult.error}
      />
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="mb-6 text-2xl font-bold">Planos e Assinatura</h1>
      <div className="space-y-8">
        <BillingView data={overviewResult.data} />
        {comparisonResult.success && (
          <PlanComparisonView data={comparisonResult.data} />
        )}
      </div>
    </div>
  );
}
