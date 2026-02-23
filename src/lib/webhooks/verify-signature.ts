import crypto from 'crypto';

/**
 * Verify an HMAC signature using timing-safe comparison.
 * Extracts the common HMAC verification pattern used by webhook providers.
 *
 * @param body - Raw request body string
 * @param signature - Full signature header (e.g. "sha256=abc123...")
 * @param secret - The shared secret / app secret
 * @param algorithm - Hash algorithm (default: "sha256")
 * @returns true if the signature is valid
 */
export function verifyHmacSignature(
  body: string,
  signature: string,
  secret: string,
  algorithm: string = 'sha256',
): boolean {
  const expectedSignature =
    `${algorithm}=` +
    crypto.createHmac(algorithm, secret).update(body).digest('hex');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}
