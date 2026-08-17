import { describe, it, expect, beforeAll } from 'vitest';

import { signRecordingToken, verifyRecordingToken } from './recording-token';

beforeAll(() => {
  process.env.RECORDING_SIGNING_SECRET = 'test-secret-for-recording-tokens';
});

const CALL_A = '11111111-1111-1111-1111-111111111111';
const CALL_B = '22222222-2222-2222-2222-222222222222';

describe('recording-token', () => {
  it('accepts a freshly signed token for its own callId', () => {
    const token = signRecordingToken(CALL_A);
    expect(verifyRecordingToken(CALL_A, token)).toBe(true);
  });

  it('rejects a token minted for a different callId (blocks IDOR)', () => {
    const token = signRecordingToken(CALL_A);
    expect(verifyRecordingToken(CALL_B, token)).toBe(false);
  });

  it('rejects a missing or malformed token', () => {
    expect(verifyRecordingToken(CALL_A, null)).toBe(false);
    expect(verifyRecordingToken(CALL_A, '')).toBe(false);
    expect(verifyRecordingToken(CALL_A, 'garbage')).toBe(false);
    expect(verifyRecordingToken(CALL_A, 'nodothere')).toBe(false);
  });

  it('rejects an expired token', () => {
    const expired = signRecordingToken(CALL_A, -10); // exp in the past
    expect(verifyRecordingToken(CALL_A, expired)).toBe(false);
  });

  it('rejects a token whose expiry was tampered with', () => {
    const token = signRecordingToken(CALL_A);
    const sig = token.slice(token.indexOf('.') + 1);
    const forged = `${Math.floor(Date.now() / 1000) + 999999}.${sig}`;
    expect(verifyRecordingToken(CALL_A, forged)).toBe(false);
  });
});
