'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import type { SubscriptionStatus } from '../types';
import { BILLING_EXEMPT_PREFIXES, isSubscriptionBlocked } from '../utils/subscription-access';

interface SubscriptionGuardProps {
  status: SubscriptionStatus;
  periodEnd?: string | null;
  children: React.ReactNode;
}

/**
 * Client-side belt over the server-side gate in the `(app)` layout. The layout
 * already blocks server-side (works with JS disabled and against direct
 * navigation); this just gives a snappier client redirect. Both share
 * `isSubscriptionBlocked` so they never disagree.
 */
export function SubscriptionGuard({ status, periodEnd, children }: SubscriptionGuardProps) {
  const pathname = usePathname();
  const router = useRouter();

  const isBlocked = isSubscriptionBlocked(status, periodEnd);

  useEffect(() => {
    if (isBlocked && !BILLING_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))) {
      router.replace('/upgrade');
    }
  }, [isBlocked, pathname, router]);

  return <>{children}</>;
}
