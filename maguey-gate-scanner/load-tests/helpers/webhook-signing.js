/**
 * Webhook Signing Helper
 * 
 * Creates signed webhook requests for load testing
 */

import { createHmac } from 'k6/crypto';

/**
 * Create a signed webhook request
 * 
 * @param body - Request body object
 * @param secret - Webhook secret
 * @returns Headers and body string
 */
export function createSignedWebhookRequest(body, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const bodyString = JSON.stringify(body);
  const signedData = `${timestamp}.${bodyString}`;
  
  // Generate HMAC signature
  // Note: k6's createHmac might not work exactly like Node.js crypto
  // This is a simplified version - adjust based on your actual signing implementation
  const hash = createHmac('sha256', secret);
  hash.update(signedData);
  const signature = hash.digest('hex');
  
  const headers = {
    'Content-Type': 'application/json',
    'X-Timestamp': timestamp.toString(),
    'X-Signature': `sha256=${signature}`,
  };
  
  return {
    headers,
    body: bodyString,
  };
}

/**
 * Generate webhook signature (alternative implementation)
 */
export function generateWebhookSignature(payload, secret, timestamp) {
  const message = `${timestamp}.${payload}`;
  const hash = createHmac('sha256', secret);
  hash.update(message);
  return hash.digest('hex');
}
