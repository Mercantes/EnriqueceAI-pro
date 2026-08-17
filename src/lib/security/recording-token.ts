import crypto from 'crypto';

// Stateless signed token for public call-recording links embedded in closer
// briefing emails. The recording endpoint has no session (it's opened straight
// from an email), so a bare callId in the URL was an IDOR: anyone with the UUID
// could stream another org's call audio. This binds the callId to an expiry via
// HMAC so only links we minted, and only until they expire, are accepted.
// Server-only — the secret never reaches the browser.

const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days — briefings get opened late

function getSecret(): string {
  const secret = process.env.RECORDING_SIGNING_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error('Missing signing secret for recording tokens (SUPABASE_SERVICE_ROLE_KEY).');
  }
  return secret;
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

/** Build a signed, expiring token that authorizes streaming one call's recording. */
export function signRecordingToken(callId: string, ttlSeconds: number = DEFAULT_TTL_SECONDS): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${exp}.${sign(`${callId}:${exp}`)}`;
}

/** Verify a recording token against the callId. Returns true only on a valid, unexpired signature. */
export function verifyRecordingToken(callId: string, token: string | null): boolean {
  if (!token) return false;
  const dot = token.indexOf('.');
  if (dot <= 0) return false;

  const expStr = token.slice(0, dot);
  const providedSig = token.slice(dot + 1);
  const exp = Number(expStr);
  if (!Number.isInteger(exp) || exp < Math.floor(Date.now() / 1000)) return false;

  const expectedSig = sign(`${callId}:${exp}`);
  const provided = Buffer.from(providedSig);
  const expected = Buffer.from(expectedSig);
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(provided, expected);
}
