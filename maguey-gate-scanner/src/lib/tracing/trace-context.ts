/**
 * W3C Trace Context Implementation
 * 
 * Implements the W3C Trace Context specification for distributed tracing.
 * https://www.w3.org/TR/trace-context/
 * 
 * Format: traceparent: 00-{traceId}-{spanId}-{traceFlags}
 * Example: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
 */

export interface TraceContext {
  traceId: string;      // 32 hex chars (128-bit)
  spanId: string;       // 16 hex chars (64-bit)
  parentSpanId?: string;
  traceFlags: number;   // 8-bit field (sampled = 0x01)
  traceState?: string;  // Optional vendor-specific data
}

const TRACE_ID_LENGTH = 32;
const SPAN_ID_LENGTH = 16;
const TRACEPARENT_VERSION = '00';
const TRACEPARENT_LENGTH = 55; // 00-{32}-{16}-{2}

/**
 * Generate a random 128-bit trace ID (32 hex characters)
 */
export function generateTraceId(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Fallback for environments without crypto.getRandomValues
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a random 64-bit span ID (16 hex characters)
 */
export function generateSpanId(): string {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Fallback for environments without crypto.getRandomValues
    for (let i = 0; i < 8; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Parse a traceparent header string into a TraceContext
 * 
 * Format: 00-{traceId}-{spanId}-{traceFlags}
 * 
 * @param header - The traceparent header value
 * @returns Parsed TraceContext or null if invalid
 */
export function parseTraceparent(header: string): TraceContext | null {
  if (!header || typeof header !== 'string') {
    return null;
  }

  const parts = header.trim().split('-');
  
  // Must have exactly 4 parts
  if (parts.length !== 4) {
    return null;
  }

  const [version, traceId, spanId, traceFlags] = parts;

  // Validate version (must be 00 for now)
  if (version !== TRACEPARENT_VERSION) {
    return null;
  }

  // Validate trace ID (32 hex chars)
  if (!/^[0-9a-f]{32}$/i.test(traceId)) {
    return null;
  }

  // Validate span ID (16 hex chars, not all zeros)
  if (!/^[0-9a-f]{16}$/i.test(spanId) || spanId === '0000000000000000') {
    return null;
  }

  // Validate trace flags (2 hex chars, 0-255)
  const flags = parseInt(traceFlags, 16);
  if (isNaN(flags) || flags < 0 || flags > 255) {
    return null;
  }

  return {
    traceId: traceId.toLowerCase(),
    spanId: spanId.toLowerCase(),
    traceFlags: flags,
  };
}

/**
 * Format a TraceContext into a traceparent header string
 * 
 * @param ctx - The TraceContext to format
 * @returns Formatted traceparent header value
 */
export function formatTraceparent(ctx: TraceContext): string {
  const flags = ctx.traceFlags.toString(16).padStart(2, '0');
  return `${TRACEPARENT_VERSION}-${ctx.traceId}-${ctx.spanId}-${flags}`;
}

/**
 * Create a child trace context from a parent context
 * 
 * @param parent - The parent TraceContext
 * @returns A new TraceContext with the parent's traceId and a new spanId
 */
export function createChildContext(parent: TraceContext): TraceContext {
  return {
    traceId: parent.traceId,
    spanId: generateSpanId(),
    parentSpanId: parent.spanId,
    traceFlags: parent.traceFlags,
    traceState: parent.traceState,
  };
}

/**
 * Determine if a trace should be sampled based on trace ID and sample rate
 * 
 * Uses consistent sampling: same trace ID always gets same decision
 * 
 * @param traceId - The trace ID
 * @param sampleRate - Sample rate between 0.0 and 1.0
 * @returns true if trace should be sampled
 */
export function shouldSample(traceId: string, sampleRate: number): boolean {
  if (sampleRate >= 1.0) return true;
  if (sampleRate <= 0.0) return false;

  // Use first 8 hex chars of trace ID for consistent sampling
  const hash = parseInt(traceId.substring(0, 8), 16);
  const threshold = Math.floor(hash / 0xffffffff * 1000000) / 1000000;
  
  return threshold < sampleRate;
}

/**
 * Check if a trace context is sampled
 */
export function isSampled(ctx: TraceContext): boolean {
  return (ctx.traceFlags & 0x01) === 0x01;
}

/**
 * Create a new root trace context
 */
export function createRootContext(sampled: boolean = true): TraceContext {
  return {
    traceId: generateTraceId(),
    spanId: generateSpanId(),
    traceFlags: sampled ? 0x01 : 0x00,
  };
}
