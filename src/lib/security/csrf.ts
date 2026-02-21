import { headers } from 'next/headers';

/**
 * Verifies that a server action request originates from the same site.
 * Next.js checks this automatically for server actions, but this provides
 * an explicit defense-in-depth layer for non-action POST handlers.
 *
 * @throws Error if the origin doesn't match
 */
export async function verifyCsrfOrigin(): Promise<void> {
  const headerStore = await headers();
  const origin = headerStore.get('origin');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const allowedOrigin = new URL(appUrl).origin;

  if (!origin) {
    // No origin header — likely a same-origin request from the browser
    return;
  }

  if (origin !== allowedOrigin) {
    throw new Error(`CSRF origin mismatch: expected ${allowedOrigin}, got ${origin}`);
  }
}
