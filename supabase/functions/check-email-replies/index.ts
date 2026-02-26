import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const CRON_SECRET = Deno.env.get('CRON_SECRET');
const APP_URL = Deno.env.get('APP_URL');

serve(async (req) => {
  // Validate caller (pg_cron sends service_role_key)
  const auth = req.headers.get('authorization');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!auth || auth !== `Bearer ${serviceRoleKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!APP_URL || !CRON_SECRET) {
    return new Response(
      JSON.stringify({ error: 'Missing APP_URL or CRON_SECRET env vars' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  try {
    const response = await fetch(`${APP_URL}/api/cron/check-email-replies`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(55_000),
    });

    const body = await response.json();

    return new Response(JSON.stringify(body), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[check-email-replies] Relay failed:', message);

    return new Response(
      JSON.stringify({ error: `Relay failed: ${message}` }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
