/**
 * QR Code Generator
 * 
 * Generates valid QR tokens and signatures for load testing
 */

import { createHmac } from 'k6/crypto';

/**
 * Generate a test QR token for a ticket
 * 
 * @param ticketId - Ticket ID
 * @param secret - QR signing secret
 * @returns QR token string
 */
export function generateTestQRToken(ticketId, secret = null) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  const token = `qr_test_${ticketId}_${timestamp}_${random}`;
  return token;
}

/**
 * Generate QR signature using HMAC-SHA256
 * 
 * @param qrToken - QR token to sign
 * @param secret - Signing secret
 * @returns HMAC signature (hex)
 */
export function generateQRSignature(qrToken, secret) {
  if (!secret) {
    secret = __ENV.VITE_QR_SIGNING_SECRET || 'test-qr-signing-secret-for-load-tests';
  }
  
  // k6 crypto HMAC implementation
  // Note: For actual testing, you should use real QR signatures from the database
  // This is a simplified version for load testing
  const hash = createHmac('sha256', secret);
  hash.update(qrToken);
  return hash.digest('hex');
}

/**
 * Generate a batch of QR tokens for load testing
 * 
 * @param count - Number of tokens to generate
 * @param ticketIds - Array of ticket IDs (optional, will generate if not provided)
 * @param secret - QR signing secret
 * @returns Array of { qrToken, qrSignature, ticketId }
 */
export function generateBatchQRTokens(count, ticketIds = null, secret = null) {
  if (!secret) {
    secret = __ENV.VITE_QR_SIGNING_SECRET || 'test-qr-signing-secret-for-load-tests';
  }
  
  const tokens = [];
  
  for (let i = 0; i < count; i++) {
    const ticketId = ticketIds && ticketIds[i] 
      ? ticketIds[i] 
      : `test_ticket_${Date.now()}_${i}_${Math.random().toString(36).substring(7)}`;
    
    const qrToken = generateTestQRToken(ticketId, secret);
    const qrSignature = generateQRSignature(qrToken, secret);
    
    tokens.push({
      qrToken,
      qrSignature,
      ticketId,
    });
  }
  
  return tokens;
}

/**
 * Generate QR token from existing ticket data
 * 
 * @param ticket - Ticket object with qr_token and qr_signature
 * @returns { qrToken, qrSignature }
 */
export function extractQRFromTicket(ticket) {
  return {
    qrToken: ticket.qr_token,
    qrSignature: ticket.qr_signature,
    ticketId: ticket.id,
  };
}

/**
 * Validate QR token format
 */
export function validateQRTokenFormat(qrToken) {
  return qrToken && typeof qrToken === 'string' && qrToken.length > 0;
}

/**
 * Validate QR signature format
 */
export function validateQRSignatureFormat(qrSignature) {
  return qrSignature && typeof qrSignature === 'string' && qrSignature.length === 64; // SHA256 hex = 64 chars
}
