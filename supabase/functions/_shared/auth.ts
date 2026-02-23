// Auth helpers for Edge Functions
import { supabaseAdmin } from './supabase-admin.ts';

interface AuthContext {
  userId: string;
  organizationId: string;
}

type AuthResult =
  | { ok: true; context: AuthContext }
  | { ok: false; response: Response };

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

/**
 * Validate JWT from Authorization header and resolve the user's organization.
 * Uses service-role client to bypass RLS.
 */
export async function getAuthContext(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: CORS_HEADERS },
      ),
    };
  }

  const token = authHeader.replace('Bearer ', '');

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: CORS_HEADERS },
      ),
    };
  }

  // Resolve the user's active organization membership.
  // NOTE: uses "organization_members" (the real table).
  // A view "org_members" also exists as an alias for backwards-compat.
  const { data: member, error: memberError } = await supabaseAdmin
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single();

  if (memberError || !member) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: 'User is not an active member of any organization' }),
        { status: 403, headers: CORS_HEADERS },
      ),
    };
  }

  return {
    ok: true,
    context: { userId: user.id, organizationId: member.org_id },
  };
}

/**
 * Validate the Evolution webhook secret header.
 */
export function validateWebhookSecret(req: Request): boolean {
  const secret =
    req.headers.get('X-EVOLUTION-SECRET') ||
    req.headers.get('x-evolution-secret') ||
    '';
  const expectedSecret = Deno.env.get('EVOLUTION_WEBHOOK_SECRET') || '';
  return secret !== '' && secret === expectedSecret;
}
