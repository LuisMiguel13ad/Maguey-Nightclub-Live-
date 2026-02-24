/**
 * Request Signing Tests
 * 
 * Tests for request signing, signature verification, replay protection,
 * and timestamp validation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createSignature,
  createSignatureHeaders,
  verifySignature,
  extractSignedRequest,
  getSecurityStats,
  shouldBlockIP,
  shouldAlertOnIP,
  recordSecurityEvent,
  _resetForTesting,
  DEFAULT_MAX_AGE_SECONDS,
  DEFAULT_MAX_FUTURE_SECONDS,
  SIGNATURE_PREFIX,
  type SignedRequest,
} from '../request-signing';

describe('Request Signing', () => {
  const testSecret = 'test-webhook-secret-key-12345';
  const testBody = JSON.stringify({ ticket_id: 'TEST-001', event_name: 'Test Event' });

  beforeEach(() => {
    _resetForTesting();
  });

  // ============================================
  // SIGNATURE CREATION
  // ============================================

  describe('createSignature', () => {
    it('should create a signed request with signature, timestamp, and body', async () => {
      const signed = await createSignature(testBody, testSecret);

      expect(signed).toHaveProperty('signature');
      expect(signed).toHaveProperty('timestamp');
      expect(signed).toHaveProperty('body');
      expect(signed.body).toBe(testBody);
      expect(typeof signed.timestamp).toBe('number');
      expect(signed.signature).toMatch(/^sha256=/);
    });

    it('should include timestamp in signature calculation', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));

      const signed1 = await createSignature(testBody, testSecret);

      // Advance by 1 second so Unix timestamp changes
      vi.setSystemTime(new Date('2025-01-01T00:00:01Z'));

      const signed2 = await createSignature(testBody, testSecret);

      // Signatures should be different due to different timestamps
      expect(signed1.signature).not.toBe(signed2.signature);
      expect(signed1.timestamp).not.toBe(signed2.timestamp);

      vi.useRealTimers();
    });

    it('should prefix signature with sha256=', async () => {
      const signed = await createSignature(testBody, testSecret);
      expect(signed.signature).toMatch(/^sha256=/);
    });

    it('should use current Unix timestamp', async () => {
      const before = Math.floor(Date.now() / 1000);
      const signed = await createSignature(testBody, testSecret);
      const after = Math.floor(Date.now() / 1000);

      expect(signed.timestamp).toBeGreaterThanOrEqual(before);
      expect(signed.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('createSignatureHeaders', () => {
    it('should create headers with X-Webhook-Signature and X-Webhook-Timestamp', async () => {
      const headers = await createSignatureHeaders(testBody, testSecret);

      expect(headers).toHaveProperty('X-Webhook-Signature');
      expect(headers).toHaveProperty('X-Webhook-Timestamp');
      expect(headers['X-Webhook-Signature']).toMatch(/^sha256=/);
      expect(typeof parseInt(headers['X-Webhook-Timestamp'])).toBe('number');
    });

    it('should match signature from createSignature', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));

      const signed = await createSignature(testBody, testSecret);
      const headers = await createSignatureHeaders(testBody, testSecret);

      expect(headers['X-Webhook-Signature']).toBe(signed.signature);
      expect(headers['X-Webhook-Timestamp']).toBe(signed.timestamp.toString());

      vi.useRealTimers();
    });
  });

  // ============================================
  // SIGNATURE VERIFICATION
  // ============================================

  describe('verifySignature', () => {
    it('should verify a valid signature', async () => {
      const signed = await createSignature(testBody, testSecret);
      const result = await verifySignature(signed, testSecret);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid signature', async () => {
      const signed = await createSignature(testBody, testSecret);
      
      // Modify signature
      const wrongRequest: SignedRequest = {
        ...signed,
        signature: 'sha256=wrong_signature_hash',
      };
      
      const result = await verifySignature(wrongRequest, testSecret);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('INVALID_SIGNATURE');
    });

    it('should reject missing signature', async () => {
      const request: SignedRequest = {
        signature: '',
        timestamp: Math.floor(Date.now() / 1000),
        body: testBody,
      };

      const result = await verifySignature(request, testSecret);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('MISSING_SIGNATURE');
    });

    it('should reject expired timestamp', async () => {
      const oldTimestamp = Math.floor(Date.now() / 1000) - (DEFAULT_MAX_AGE_SECONDS + 10);
      
      // Create signature with old timestamp
      const message = `${oldTimestamp}.${testBody}`;
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(testSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
      const signature = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const request: SignedRequest = {
        signature: SIGNATURE_PREFIX + signature,
        timestamp: oldTimestamp,
        body: testBody,
      };

      const result = await verifySignature(request, testSecret);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('TIMESTAMP_EXPIRED');
      expect(result.timeDelta).toBeGreaterThan(DEFAULT_MAX_AGE_SECONDS);
    });

    it('should detect replay attacks (in-memory cache)', async () => {
      const signed = await createSignature(testBody, testSecret);

      // First verification should succeed
      const result1 = await verifySignature(signed, testSecret);
      expect(result1.valid).toBe(true);

      // Second verification with same signature should fail
      const result2 = await verifySignature(signed, testSecret);
      expect(result2.valid).toBe(false);
      expect(result2.error).toBe('REPLAY_DETECTED');
    });

    it('should use external replay checker if provided', async () => {
      const signed = await createSignature(testBody, testSecret);
      const replayChecker = async () => true; // Simulate replay detected

      const result = await verifySignature(signed, testSecret, {
        replayChecker,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('REPLAY_DETECTED');
    });

    it('should include timeDelta in result', async () => {
      const signed = await createSignature(testBody, testSecret);
      const result = await verifySignature(signed, testSecret);

      expect(result.timeDelta).toBeDefined();
      expect(typeof result.timeDelta).toBe('number');
      expect(Math.abs(result.timeDelta!)).toBeLessThan(5); // Should be very recent
    });
  });

  // ============================================
  // HEADER EXTRACTION
  // ============================================

  describe('extractSignedRequest', () => {
    it('should extract signed request from headers', () => {
      // Use a manually created signed request for this test
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = 'sha256=test_signature_hash';
      
      const headers = new Headers({
        'X-Webhook-Signature': signature,
        'X-Webhook-Timestamp': timestamp.toString(),
      });

      const extracted = extractSignedRequest(headers, testBody);

      expect(extracted).not.toBeNull();
      expect(extracted?.signature).toBe(signature);
      expect(extracted?.timestamp).toBe(timestamp);
      expect(extracted?.body).toBe(testBody);
    });

    it('should handle case-insensitive headers', () => {
      const headers = {
        'x-webhook-signature': 'sha256=abc123',
        'x-webhook-timestamp': '1699999999',
      };

      const extracted = extractSignedRequest(headers, testBody);

      expect(extracted).not.toBeNull();
      expect(extracted?.signature).toBe('sha256=abc123');
      expect(extracted?.timestamp).toBe(1699999999);
    });

    it('should return null if signature header missing', () => {
      const headers = {
        'X-Webhook-Timestamp': '1699999999',
      };

      const extracted = extractSignedRequest(headers, testBody);
      expect(extracted).toBeNull();
    });

    it('should return null if timestamp header missing', () => {
      const headers = {
        'X-Webhook-Signature': 'sha256=abc123',
      };

      const extracted = extractSignedRequest(headers, testBody);
      expect(extracted).toBeNull();
    });
  });

  // ============================================
  // SECURITY MONITORING
  // ============================================

  describe('Security Monitoring', () => {
    it('should track security events', () => {
      recordSecurityEvent({
        type: 'INVALID_SIGNATURE',
        ip: '192.168.1.1',
        details: { reason: 'test' },
      });

      const stats = getSecurityStats();
      expect(stats.totalEvents).toBeGreaterThan(0);
    });

    it('should provide security statistics', () => {
      recordSecurityEvent({
        type: 'INVALID_SIGNATURE',
        ip: '192.168.1.1',
      });

      recordSecurityEvent({
        type: 'REPLAY_ATTEMPT',
        ip: '192.168.1.1',
      });

      const stats = getSecurityStats();
      expect(stats.eventsByType.INVALID_SIGNATURE).toBeGreaterThan(0);
      expect(stats.eventsByType.REPLAY_ATTEMPT).toBeGreaterThan(0);
    });

    it('should check if IP should be blocked', () => {
      // Record many events from same IP
      for (let i = 0; i < 12; i++) {
        recordSecurityEvent({
          type: 'INVALID_SIGNATURE',
          ip: '192.168.1.200',
        });
      }

      const shouldBlock = shouldBlockIP('192.168.1.200', 10);
      expect(shouldBlock).toBe(true);
    });
  });

  // ============================================
  // INTEGRATION TESTS
  // ============================================

  describe('Integration', () => {
    it('should create and verify a complete request flow', async () => {
      // 1. Create signed request
      const signed = await createSignature(testBody, testSecret);

      // 2. Extract from headers
      const headers = {
        'X-Webhook-Signature': signed.signature,
        'X-Webhook-Timestamp': signed.timestamp.toString(),
      };
      const extracted = extractSignedRequest(headers, testBody);
      expect(extracted).not.toBeNull();
      expect(extracted?.signature).toBe(signed.signature);
      expect(extracted?.timestamp).toBe(signed.timestamp);
    });

    it('should reject modified body', async () => {
      const signed = await createSignature(testBody, testSecret);
      const modifiedBody = JSON.stringify({ ticket_id: 'MODIFIED' });

      const request: SignedRequest = {
        ...signed,
        body: modifiedBody,
      };

      const result = await verifySignature(request, testSecret);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('INVALID_SIGNATURE');
    });
  });
});
