import { NextResponse } from 'next/server';

import { handleCrmCallback } from '@/features/integrations/actions/manage-crm';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      new URL('/settings/integrations?error=oauth_denied', url.origin),
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/settings/integrations?error=no_code', url.origin),
    );
  }

  const result = await handleCrmCallback('pipedrive', code);

  if (result.success) {
    return NextResponse.redirect(
      new URL('/settings/integrations?success=pipedrive_connected', url.origin),
    );
  }

  return NextResponse.redirect(
    new URL(`/settings/integrations?error=${encodeURIComponent(result.error)}`, url.origin),
  );
}
