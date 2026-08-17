import { NextResponse } from 'next/server';

import { handleCrmCallback } from '@/features/integrations/actions/manage-crm';
import { consumeOAuthState } from '@/lib/security/oauth-state';
import { getAppUrl } from '@/lib/utils/app-url';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const state = url.searchParams.get('state');

  if (error) {
    return NextResponse.redirect(
      new URL('/settings/integrations?error=oauth_denied', getAppUrl()),
    );
  }

  // Validate the CSRF state cookie issued by getCrmAuthUrl before exchanging the
  // code. Without this, an attacker can graft their own HubSpot account onto a
  // logged-in manager's org.
  const stateValid = await consumeOAuthState('hubspot', state);
  if (!stateValid) {
    return NextResponse.redirect(
      new URL('/settings/integrations?error=oauth_state_mismatch', getAppUrl()),
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/settings/integrations?error=no_code', getAppUrl()),
    );
  }

  const result = await handleCrmCallback('hubspot', code);

  if (result.success) {
    return NextResponse.redirect(
      new URL('/settings/integrations?success=hubspot_connected', getAppUrl()),
    );
  }

  return NextResponse.redirect(
    new URL(`/settings/integrations?error=${encodeURIComponent(result.error)}`, getAppUrl()),
  );
}
