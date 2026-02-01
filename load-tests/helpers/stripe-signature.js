// Stripe webhook signature generation for k6 load tests
import crypto from 'k6/crypto';

export function generateStripeSignature(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;

  // k6 crypto.hmac for HMAC-SHA256
  const signature = crypto.hmac('sha256', secret, signedPayload, 'hex');

  return `t=${timestamp},v1=${signature}`;
}
