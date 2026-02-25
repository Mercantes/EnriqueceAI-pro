import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const APP_URL = Deno.env.get('APP_URL');

serve(async (req) => {
  // Validate caller (service_role_key auth)
  const auth = req.headers.get('authorization');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!auth || auth !== `Bearer ${serviceRoleKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!APP_URL) {
    return new Response(
      JSON.stringify({ error: 'Missing APP_URL env var' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  try {
    const body = await req.json();

    const response = await fetch(`${APP_URL}/api/workers/enrich-leads`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });

    const responseBody = await response.json();

    return new Response(JSON.stringify(responseBody), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[enrich-leads] Relay failed:', message);

    return new Response(
      JSON.stringify({ error: `Relay failed: ${message}` }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
