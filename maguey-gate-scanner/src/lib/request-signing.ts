/**
 * Request Signing with Replay Protection
 * 
 * Provides secure request signing using HMAC-SHA256 with timestamp validation
 * and replay attack protection for webhook security.
 * 
 * @example
 * ```typescript
 * // Create a signed request
 * const signed = await createSignature(JSON.stringify(payload), webhookSecret);
 * 
 * // Verify a signed request
 * const result = await verifySignature(request, webhookSecret);
 * if (!result.valid) {
 *   console.error('Verification failed:', result.error);
 * }
 * ```
 */

import { createLogger } from './logger';

const logger = createLogger({ module: 'request-signing' });

// ============================================
// TYPES
// ============================================

/**
 * Signed request containing signature, timestamp, and body
 */
export interface SignedRequest {
  /** HMAC-SHA256 signature of timestamp + body */
  signature: string;
  /** Unix timestamp in seconds */
  timestamp: number;
  /** Request body (JSON string) */
  body: string;
}

/**
 * Verification error types
 */
export type VerificationErrorType = 
  | 'INVALID_SIGNATURE'    // Signature doesn't match
  | 'TIMESTAMP_EXPIRED'    // Request is too old
  | 'TIMESTAMP_FUTURE'     // Timestamp is in the future
  | 'REPLAY_DETECTED'      // Duplicate signature detected
  | 'MISSING_SIGNATURE'    // No signature provided
  | 'MISSING_TIMESTAMP'    // No timestamp provided
  | 'INVALID_FORMAT';      // Invalid signature format

/**
 * Result of signature verification
 */
export interface VerificationResult {
  /** Whether the signature is valid */
  valid: boolean;
  /** Error type if validation failed */
  error?: VerificationErrorType;
  /** Human-readable error message */
  message?: string;
  /** Time difference in seconds (for debugging) */
  timeDelta?: number;
}

/**
 * Security event for monitoring
 */
export interface SecurityEvent {
  type: 'INVALID_SIGNATURE' | 'REPLAY_ATTEMPT' | 'TIMESTAMP_VIOLATION' | 'RATE_LIMIT_EXCEEDED';
  timestamp: Date;
  ip?: string;
  signature?: string;
  details?: Record<string, unknown>;
}

/**
 * Options for signature verification
 */
export interface VerifyOptions {
  /** Maximum age of request in seconds (default: 300 = 5 minutes) */
  maxAgeSeconds?: number;
  /** Maximum future time tolerance in seconds (default: 60 = 1 minute) */
  maxFutureSeconds?: number;
  /** IP address for logging and rate limiting */
  clientIp?: string;
  /** Function to check for replay attacks */
  replayChecker?: (signature: string) => Promise<boolean>;
  /** Function to record used signatures */
  signatureRecorder?: (signature: string, timestamp: number) => Promise<void>;
}

// ============================================
// CONSTANTS
// ============================================

/** Default maximum age for requests (5 minutes) */
export const DEFAULT_MAX_AGE_SECONDS = 300;

/** Default maximum future tolerance (1 minute for clock skew) */
export const DEFAULT_MAX_FUTURE_SECONDS = 60;

/** Signature algorithm */
export const SIGNATURE_ALGORITHM = 'HMAC-SHA256';

/** Signature prefix for validation */
export const SIGNATURE_PREFIX = 'sha256=';

// ============================================
// REPLAY PROTECTION (In-Memory Cache)
// ============================================

/**
 * In-memory cache for used signatures
 * Note: In production, use Redis or database for distributed systems
 */
class SignatureCache {
  private cache: Map<string, number> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly maxAgeMs: number;

  constructor(maxAgeSeconds: number = DEFAULT_MAX_AGE_SECONDS) {
    this.maxAgeMs = maxAgeSeconds * 1000;
    this.startCleanup();
  }

  /**
   * Check if a signature has been used
   */
  has(signature: string): boolean {
    return this.cache.has(signature);
  }

  /**
   * Record a used signature
   */
  add(signature: string, timestamp: number): void {
    this.cache.set(signature, timestamp);
  }

  /**
   * Clean up expired signatures
   */
  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.maxAgeMs - 60000; // Extra 1 minute buffer
    
    for (const [sig, ts] of this.cache.entries()) {
      if (ts * 1000 < cutoff) {
        this.cache.delete(sig);
      }
    }
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup(): void {
    // Clean up every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Stop cleanup and clear cache
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }

  /**
   * Get cache size (for monitoring)
   */
  get size(): number {
    return this.cache.size;
  }
}

// Global signature cache instance
const signatureCache = new SignatureCache();

// ============================================
// SECURITY EVENT TRACKING
// ============================================

/**
 * Track security events by IP for rate limiting and alerting
 */
class SecurityEventTracker {
  private events: Map<string, SecurityEvent[]> = new Map();
  private readonly windowMs: number = 3600000; // 1 hour window

  /**
   * Record a security event
   */
  recordEvent(event: SecurityEvent): void {
    const key = event.ip || 'unknown';
    const existing = this.events.get(key) || [];
    existing.push(event);
    this.events.set(key, existing);

    // Log the event
    logger.warn('Security event recorded', {
      eventType: event.type,
      ip: event.ip,
      ...event.details,
    });

    // Cleanup old events
    this.cleanupOldEvents(key);
  }

  /**
   * Get event count for an IP in the last hour
   */
  getEventCount(ip: string, type?: SecurityEvent['type']): number {
    const events = this.events.get(ip) || [];
    const cutoff = Date.now() - this.windowMs;
    
    return events.filter(e => {
      if (e.timestamp.getTime() < cutoff) return false;
      if (type && e.type !== type) return false;
      return true;
    }).length;
  }

  /**
   * Check if IP should be blocked due to repeated failures
   */
  shouldBlock(ip: string, threshold: number = 10): boolean {
    return this.getEventCount(ip) >= threshold;
  }

  /**
   * Check if an alert should be sent
   */
  shouldAlert(ip: string, threshold: number = 5): boolean {
    return this.getEventCount(ip) >= threshold;
  }

  /**
   * Cleanup old events for an IP
   */
  private cleanupOldEvents(ip: string): void {
    const events = this.events.get(ip);
    if (!events) return;

    const cutoff = Date.now() - this.windowMs;
    const filtered = events.filter(e => e.timestamp.getTime() >= cutoff);
    
    if (filtered.length === 0) {
      this.events.delete(ip);
    } else {
      this.events.set(ip, filtered);
    }
  }

  /**
   * Get all recent events (for monitoring dashboard)
   */
  getAllRecentEvents(): SecurityEvent[] {
    const cutoff = Date.now() - this.windowMs;
    const all: SecurityEvent[] = [];
    
    for (const events of this.events.values()) {
      all.push(...events.filter(e => e.timestamp.getTime() >= cutoff));
    }
    
    return all.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
}

// Global security event tracker
const securityTracker = new SecurityEventTracker();

// ============================================
// SIGNATURE CREATION
// ============================================

/**
 * Convert ArrayBuffer to hex string
 */
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Create HMAC-SHA256 signature
 */
async function createHmacSignature(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  
  // Import the secret key
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  // Sign the message
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(message)
  );
  
  return bufferToHex(signatureBuffer);
}

/**
 * Create a signed request with HMAC-SHA256 signature
 * 
 * @param body - Request body (JSON string)
 * @param secret - Webhook secret key
 * @returns Signed request with signature, timestamp, and body
 * 
 * @example
 * ```typescript
 * const signed = await createSignature(JSON.stringify({ orderId: '123' }), 'my-secret');
 * // signed.signature = 'sha256=abc123...'
 * // signed.timestamp = 1699999999
 * // signed.body = '{"orderId":"123"}'
 * ```
 */
export async function createSignature(body: string, secret: string): Promise<SignedRequest> {
  const timestamp = Math.floor(Date.now() / 1000);
  
  // Create message: timestamp + body
  const message = `${timestamp}.${body}`;
  
  // Generate HMAC-SHA256 signature
  const signature = await createHmacSignature(message, secret);
  
  return {
    signature: SIGNATURE_PREFIX + signature,
    timestamp,
    body,
  };
}

/**
 * Create signature for HTTP headers
 * Returns headers to add to the request
 */
export async function createSignatureHeaders(
  body: string,
  secret: string
): Promise<Record<string, string>> {
  const signed = await createSignature(body, secret);
  
  return {
    'X-Webhook-Signature': signed.signature,
    'X-Webhook-Timestamp': signed.timestamp.toString(),
  };
}

// ============================================
// SIGNATURE VERIFICATION
// ============================================

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Verify a signed request
 * 
 * @param request - The signed request to verify
 * @param secret - Webhook secret key
 * @param options - Verification options
 * @returns Verification result with valid flag and any error details
 * 
 * @example
 * ```typescript
 * const result = await verifySignature({
 *   signature: 'sha256=abc123...',
 *   timestamp: 1699999999,
 *   body: '{"orderId":"123"}'
 * }, 'my-secret');
 * 
 * if (!result.valid) {
 *   console.error(result.error, result.message);
 * }
 * ```
 */
export async function verifySignature(
  request: SignedRequest,
  secret: string,
  options: VerifyOptions = {}
): Promise<VerificationResult> {
  const {
    maxAgeSeconds = DEFAULT_MAX_AGE_SECONDS,
    maxFutureSeconds = DEFAULT_MAX_FUTURE_SECONDS,
    clientIp,
    replayChecker,
    signatureRecorder,
  } = options;

  // Validate signature format
  if (!request.signature) {
    return {
      valid: false,
      error: 'MISSING_SIGNATURE',
      message: 'No signature provided',
    };
  }

  if (!request.timestamp) {
    return {
      valid: false,
      error: 'MISSING_TIMESTAMP',
      message: 'No timestamp provided',
    };
  }

  // Check signature format
  let signatureValue = request.signature;
  if (signatureValue.startsWith(SIGNATURE_PREFIX)) {
    signatureValue = signatureValue.slice(SIGNATURE_PREFIX.length);
  }

  // Validate timestamp
  const now = Math.floor(Date.now() / 1000);
  const timeDelta = now - request.timestamp;

  // Check if timestamp is too old
  if (timeDelta > maxAgeSeconds) {
    securityTracker.recordEvent({
      type: 'TIMESTAMP_VIOLATION',
      timestamp: new Date(),
      ip: clientIp,
      details: { timeDelta, maxAge: maxAgeSeconds, reason: 'expired' },
    });

    return {
      valid: false,
      error: 'TIMESTAMP_EXPIRED',
      message: `Request timestamp expired. Age: ${timeDelta}s, max allowed: ${maxAgeSeconds}s`,
      timeDelta,
    };
  }

  // Check if timestamp is too far in the future
  if (timeDelta < -maxFutureSeconds) {
    securityTracker.recordEvent({
      type: 'TIMESTAMP_VIOLATION',
      timestamp: new Date(),
      ip: clientIp,
      details: { timeDelta, maxFuture: maxFutureSeconds, reason: 'future' },
    });

    return {
      valid: false,
      error: 'TIMESTAMP_FUTURE',
      message: `Request timestamp is in the future. Delta: ${timeDelta}s`,
      timeDelta,
    };
  }

  // Check for replay attack (in-memory)
  if (signatureCache.has(signatureValue)) {
    securityTracker.recordEvent({
      type: 'REPLAY_ATTEMPT',
      timestamp: new Date(),
      ip: clientIp,
      signature: signatureValue.slice(0, 16) + '...',
      details: { requestTimestamp: request.timestamp },
    });

    return {
      valid: false,
      error: 'REPLAY_DETECTED',
      message: 'Duplicate signature detected (replay attack)',
      timeDelta,
    };
  }

  // Check for replay attack (external checker, e.g., database)
  if (replayChecker) {
    const isReplay = await replayChecker(signatureValue);
    if (isReplay) {
      securityTracker.recordEvent({
        type: 'REPLAY_ATTEMPT',
        timestamp: new Date(),
        ip: clientIp,
        signature: signatureValue.slice(0, 16) + '...',
        details: { requestTimestamp: request.timestamp, source: 'external' },
      });

      return {
        valid: false,
        error: 'REPLAY_DETECTED',
        message: 'Duplicate signature detected (replay attack)',
        timeDelta,
      };
    }
  }

  // Compute expected signature
  const message = `${request.timestamp}.${request.body}`;
  const expectedSignature = await createHmacSignature(message, secret);

  // Constant-time comparison
  if (!constantTimeCompare(signatureValue, expectedSignature)) {
    securityTracker.recordEvent({
      type: 'INVALID_SIGNATURE',
      timestamp: new Date(),
      ip: clientIp,
      details: { 
        requestTimestamp: request.timestamp,
        bodyLength: request.body.length,
      },
    });

    return {
      valid: false,
      error: 'INVALID_SIGNATURE',
      message: 'Signature verification failed',
      timeDelta,
    };
  }

  // Record the signature to prevent replay
  signatureCache.add(signatureValue, request.timestamp);

  // Record in external store if provided
  if (signatureRecorder) {
    try {
      await signatureRecorder(signatureValue, request.timestamp);
    } catch (error) {
      logger.warn('Failed to record signature in external store', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't fail the request if recording fails
    }
  }

  logger.debug('Signature verified successfully', {
    timeDelta,
    ip: clientIp,
  });

  return {
    valid: true,
    timeDelta,
  };
}

/**
 * Extract signed request from HTTP headers and body
 */
export function extractSignedRequest(
  headers: Headers | Record<string, string>,
  body: string
): SignedRequest | null {
  const getHeader = (name: string): string | null => {
    if (headers instanceof Headers) {
      return headers.get(name);
    }
    return headers[name] || headers[name.toLowerCase()] || null;
  };

  const signature = getHeader('X-Webhook-Signature') || getHeader('x-webhook-signature');
  const timestampStr = getHeader('X-Webhook-Timestamp') || getHeader('x-webhook-timestamp');

  if (!signature || !timestampStr) {
    return null;
  }

  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) {
    return null;
  }

  return {
    signature,
    timestamp,
    body,
  };
}

// ============================================
// SECURITY MONITORING
// ============================================

/**
 * Get security event statistics
 */
export function getSecurityStats(): {
  totalEvents: number;
  eventsByType: Record<SecurityEvent['type'], number>;
  topIPs: Array<{ ip: string; count: number }>;
  cacheSize: number;
} {
  const events = securityTracker.getAllRecentEvents();
  const eventsByType: Record<SecurityEvent['type'], number> = {
    INVALID_SIGNATURE: 0,
    REPLAY_ATTEMPT: 0,
    TIMESTAMP_VIOLATION: 0,
    RATE_LIMIT_EXCEEDED: 0,
  };

  const ipCounts = new Map<string, number>();

  for (const event of events) {
    eventsByType[event.type]++;
    const ip = event.ip || 'unknown';
    ipCounts.set(ip, (ipCounts.get(ip) || 0) + 1);
  }

  const topIPs = Array.from(ipCounts.entries())
    .map(([ip, count]) => ({ ip, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalEvents: events.length,
    eventsByType,
    topIPs,
    cacheSize: signatureCache.size,
  };
}

/**
 * Check if IP should be blocked based on security events
 */
export function shouldBlockIP(ip: string, threshold: number = 10): boolean {
  return securityTracker.shouldBlock(ip, threshold);
}

/**
 * Check if an alert should be triggered for an IP
 */
export function shouldAlertOnIP(ip: string, threshold: number = 5): boolean {
  return securityTracker.shouldAlert(ip, threshold);
}

/**
 * Record a security event manually
 */
export function recordSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
  securityTracker.recordEvent({
    ...event,
    timestamp: new Date(),
  });
}

// ============================================
// EXPORTS
// ============================================

export const requestSigning = {
  // Creation
  createSignature,
  createSignatureHeaders,
  
  // Verification
  verifySignature,
  extractSignedRequest,
  
  // Security monitoring
  getSecurityStats,
  shouldBlockIP,
  shouldAlertOnIP,
  recordSecurityEvent,
  
  // Constants
  DEFAULT_MAX_AGE_SECONDS,
  DEFAULT_MAX_FUTURE_SECONDS,
  SIGNATURE_ALGORITHM,
  SIGNATURE_PREFIX,
};

export default requestSigning;
