import { Suspense } from 'react';

import { VerifyEmailCard } from '@/features/auth/components/VerifyEmailCard';

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailCard />
    </Suspense>
  );
}
