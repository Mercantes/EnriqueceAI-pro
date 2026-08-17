import { NextResponse } from 'next/server';

import { handleCalendarCallback } from '@/features/integrations/actions/manage-calendar';
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

  // Validate the CSRF state cookie issued by getCalendarAuthUrl before
  // exchanging the code (blocks Google account grafting onto the org).
  const stateValid = await consumeOAuthState('google', state);
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

  const result = await handleCalendarCallback(code);

  if (result.success) {
    return NextResponse.redirect(
      new URL('/settings/integrations?success=calendar_connected', getAppUrl()),
    );
  }

  return NextResponse.redirect(
    new URL(`/settings/integrations?error=${encodeURIComponent(result.error)}`, getAppUrl()),
  );
}
