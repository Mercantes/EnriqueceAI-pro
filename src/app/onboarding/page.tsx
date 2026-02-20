import { redirect } from 'next/navigation';

import { requireAuth } from '@/lib/auth/require-auth';

import { checkNeedsOnboarding } from '@/features/auth/actions/complete-onboarding';

import { OnboardingWizard } from './OnboardingWizard';

export default async function OnboardingPage() {
  await requireAuth();

  const needsOnboarding = await checkNeedsOnboarding();
  if (!needsOnboarding) {
    redirect('/dashboard');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
      <OnboardingWizard />
    </div>
  );
}
