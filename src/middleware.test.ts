import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { middleware } from './middleware';

const APP_URL = 'http://localhost:3000';
const SERVICE_KEY = 'test-service-role-key-123';
const CRON = 'cron-token-aaa,cron-token-bbb';

function req(path: string, init?: RequestInit): NextRequest {
  return new NextRequest(new URL(path, APP_URL), init);
}

describe('middleware — privileged API default-deny (D1)', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_APP_URL = APP_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY;
    process.env.CRON_SECRET = CRON;
  });
  afterAll(() => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.CRON_SECRET;
  });

  it('rejects /api/admin without a Bearer (401)', async () => {
    const res = await middleware(req('/api/admin/check-api4com-config', { method: 'POST' }));
    expect(res.status).toBe(401);
  });

  it('rejects /api/workers with a wrong Bearer (401)', async () => {
    const res = await middleware(
      req('/api/workers/persist-recording', { method: 'POST', headers: { authorization: 'Bearer nope' } }),
    );
    expect(res.status).toBe(401);
  });

  it('allows /api/admin with the service-role Bearer', async () => {
    const res = await middleware(
      req('/api/admin/check-api4com-config', { method: 'POST', headers: { authorization: `Bearer ${SERVICE_KEY}` } }),
    );
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it('allows /api/workers with a rotated cron-secret Bearer', async () => {
    const res = await middleware(
      req('/api/workers/transcribe-call', { method: 'POST', headers: { authorization: 'Bearer cron-token-bbb' } }),
    );
    expect(res.status).not.toBe(401);
  });
});

describe('middleware — CSRF hardening (D2)', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_APP_URL = APP_URL;
  });

  it('allows a cron POST without Origin (Bearer route, skips CSRF)', async () => {
    const res = await middleware(req('/api/cron/meeting-reminders', { method: 'POST' }));
    expect(res.status).not.toBe(403);
  });

  it('blocks a state-changing app request with a foreign Origin (403)', async () => {
    const res = await middleware(
      req('/dashboard', { method: 'POST', headers: { origin: 'https://evil.example.com' } }),
    );
    expect(res.status).toBe(403);
  });

  it('blocks a state-changing app request with NO Origin and NO Referer (403)', async () => {
    const res = await middleware(req('/dashboard', { method: 'POST' }));
    expect(res.status).toBe(403);
  });

  it('accepts a state-changing app request whose Referer is same-origin (Origin absent)', async () => {
    // No Origin, but Referer is the app itself → allowed (falls through to session
    // handling, so not a 403).
    const res = await middleware(
      req('/dashboard', { method: 'POST', headers: { referer: `${APP_URL}/dashboard` } }),
    );
    expect(res.status).not.toBe(403);
  });
});
