import crypto from 'crypto';

import { describe, expect, it } from 'vitest';

import { verifyHmacSignature } from './verify-signature';

function computeSignature(body: string, secret: string, algorithm = 'sha256'): string {
  return `${algorithm}=` + crypto.createHmac(algorithm, secret).update(body).digest('hex');
}

describe('verifyHmacSignature', () => {
  const secret = 'test-secret-key';
  const body = '{"event":"test"}';

  it('should return true for a valid signature', () => {
    const signature = computeSignature(body, secret);

    expect(verifyHmacSignature(body, signature, secret)).toBe(true);
  });

  it('should return false for an invalid signature', () => {
    expect(verifyHmacSignature(body, 'sha256=invalid', secret)).toBe(false);
  });

  it('should return false for a different body', () => {
    const signature = computeSignature(body, secret);

    expect(verifyHmacSignature('different body', signature, secret)).toBe(false);
  });

  it('should return false for a different secret', () => {
    const signature = computeSignature(body, secret);

    expect(verifyHmacSignature(body, signature, 'wrong-secret')).toBe(false);
  });

  it('should handle signatures with different lengths safely (no throw)', () => {
    // timingSafeEqual requires same-length buffers — our code handles this
    expect(verifyHmacSignature(body, 'sha256=short', secret)).toBe(false);
    expect(verifyHmacSignature(body, 'sha256=' + 'a'.repeat(200), secret)).toBe(false);
  });

  it('should support custom algorithm', () => {
    const sha512Sig = computeSignature(body, secret, 'sha512');

    expect(verifyHmacSignature(body, sha512Sig, secret, 'sha512')).toBe(true);
  });

  it('should reject sha512 signature when expecting sha256', () => {
    const sha512Sig = computeSignature(body, secret, 'sha512');

    expect(verifyHmacSignature(body, sha512Sig, secret, 'sha256')).toBe(false);
  });
});
