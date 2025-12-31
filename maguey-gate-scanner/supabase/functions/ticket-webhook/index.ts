import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ============================================
// STRUCTURED LOGGER FOR EDGE FUNCTION
// ============================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  requestId?: string;
  ticketCount?: number;
  orderId?: string;
  ip?: string;
  securityEvent?: string;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: { name: string; message: string; stack?: string };
  duration?: number;
}

function createLogger(baseContext: LogContext = {}) {
  const log = (level: LogLevel, message: string, context?: LogContext, error?: Error) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...baseContext, ...context },
    };
    if (error) {
      entry.error = { name: error.name, message: error.message, stack: error.stack };
    }
    console.log(JSON.stringify(entry));
  };

  return {
    debug: (msg: string, ctx?: LogContext) => log('debug', msg, ctx),
    info: (msg: string, ctx?: LogContext) => log('info', msg, ctx),
    warn: (msg: string, ctx?: LogContext) => log('warn', msg, ctx),
    error: (msg: string, err?: Error, ctx?: LogContext) => log('error', msg, ctx, err),
    child: (ctx: LogContext) => createLogger({ ...baseContext, ...ctx }),
    time: (label: string) => {
      const start = performance.now();
      return () => {
        const duration = Math.round(performance.now() - start);
        log('debug', `${label} completed`, { duration });
      };
    },
  };
}

const logger = createLogger({ function: 'ticket-webhook' });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature, x-webhook-timestamp',
};

// ============================================
// CONSTANTS
// ============================================

/** Maximum age for requests (5 minutes) */
const MAX_REQUEST_AGE_SECONDS = 300;

/** Maximum future tolerance (1 minute for clock skew) */
const MAX_FUTURE_SECONDS = 60;

/** Signature algorithm prefix */
const SIGNATURE_PREFIX = 'sha256=';

/** Rate limit: requests per minute per IP */
const RATE_LIMIT_PER_MINUTE = 50;

/** Security event threshold for blocking */
const SECURITY_BLOCK_THRESHOLD = 10;

/** Security event threshold for alerting */
const SECURITY_ALERT_THRESHOLD = 5;

// ============================================
// IN-MEMORY CACHES
// ============================================

// Rate limiting cache
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Signature cache for replay protection (in-memory)
const signatureCache = new Map<string, number>();

// Security event tracker
const securityEvents = new Map<string, Array<{ type: string; timestamp: number }>>();

// ============================================
// RATE LIMITING
// ============================================

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const limit = rateLimitMap.get(ip);
  
  if (!limit || now > limit.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60000 }); // 1 minute window
    return true;
  }
  
  if (limit.count >= RATE_LIMIT_PER_MINUTE) {
    return false;
  }
  
  limit.count++;
  return true;
}

// ============================================
// SECURITY EVENT TRACKING
// ============================================

type SecurityEventType = 'INVALID_SIGNATURE' | 'REPLAY_ATTEMPT' | 'TIMESTAMP_VIOLATION' | 'RATE_LIMIT_EXCEEDED';

function recordSecurityEvent(ip: string, type: SecurityEventType, details?: Record<string, unknown>): void {
  const events = securityEvents.get(ip) || [];
  events.push({ type, timestamp: Date.now() });
  securityEvents.set(ip, events);

  // Log the security event
  logger.warn('Security event', { 
    securityEvent: type, 
    ip,
    ...details,
  });

  // Cleanup old events (keep last hour)
  const cutoff = Date.now() - 3600000;
  securityEvents.set(ip, events.filter(e => e.timestamp >= cutoff));
}

function getSecurityEventCount(ip: string): number {
  const events = securityEvents.get(ip) || [];
  const cutoff = Date.now() - 3600000; // Last hour
  return events.filter(e => e.timestamp >= cutoff).length;
}

function shouldBlockIP(ip: string): boolean {
  return getSecurityEventCount(ip) >= SECURITY_BLOCK_THRESHOLD;
}

function shouldAlertOnIP(ip: string): boolean {
  return getSecurityEventCount(ip) >= SECURITY_ALERT_THRESHOLD;
}

// ============================================
// SIGNATURE CACHE FOR REPLAY PROTECTION
// ============================================

function hasSignatureBeenUsed(signature: string): boolean {
  return signatureCache.has(signature);
}

function recordUsedSignature(signature: string, timestamp: number): void {
  signatureCache.set(signature, timestamp);
  
  // Cleanup old signatures (keep signatures for 2x max age)
  const cutoff = Math.floor(Date.now() / 1000) - (MAX_REQUEST_AGE_SECONDS * 2);
  for (const [sig, ts] of signatureCache.entries()) {
    if (ts < cutoff) {
      signatureCache.delete(sig);
    }
  }
}

// ============================================
// CRYPTO UTILITIES
// ============================================

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function createHmacSignature(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(message)
  );
  
  return bufferToHex(signatureBuffer);
}

// Hash payload for idempotency key generation
async function hashPayload(payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return bufferToHex(hashBuffer).substring(0, 32);
}

// Constant-time string comparison
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

// ============================================
// ENHANCED SIGNATURE VERIFICATION
// ============================================

interface VerificationResult {
  valid: boolean;
  error?: 'INVALID_SIGNATURE' | 'TIMESTAMP_EXPIRED' | 'TIMESTAMP_FUTURE' | 'REPLAY_DETECTED' | 'MISSING_HEADERS';
  message?: string;
  timeDelta?: number;
}

async function verifyWebhookSignatureEnhanced(
  body: string,
  signature: string | null,
  timestamp: string | null,
  secret: string | null,
  clientIp: string,
  supabase: any
): Promise<VerificationResult> {
  // If no secret configured, allow (for development)
  if (!secret) {
    logger.debug('No webhook secret configured, skipping signature verification');
    return { valid: true };
  }

  // Check for required headers
  if (!signature) {
    return {
      valid: false,
      error: 'MISSING_HEADERS',
      message: 'Missing X-Webhook-Signature header',
    };
  }

  if (!timestamp) {
    return {
      valid: false,
      error: 'MISSING_HEADERS',
      message: 'Missing X-Webhook-Timestamp header',
    };
  }

  // Parse and validate timestamp
  const requestTimestamp = parseInt(timestamp, 10);
  if (isNaN(requestTimestamp)) {
    return {
      valid: false,
      error: 'TIMESTAMP_EXPIRED',
      message: 'Invalid timestamp format',
    };
  }

  const now = Math.floor(Date.now() / 1000);
  const timeDelta = now - requestTimestamp;

  // Check if timestamp is too old
  if (timeDelta > MAX_REQUEST_AGE_SECONDS) {
    recordSecurityEvent(clientIp, 'TIMESTAMP_VIOLATION', {
      timeDelta,
      maxAge: MAX_REQUEST_AGE_SECONDS,
      reason: 'expired',
    });

    return {
      valid: false,
      error: 'TIMESTAMP_EXPIRED',
      message: `Request timestamp expired. Age: ${timeDelta}s, max allowed: ${MAX_REQUEST_AGE_SECONDS}s`,
      timeDelta,
    };
  }

  // Check if timestamp is too far in the future
  if (timeDelta < -MAX_FUTURE_SECONDS) {
    recordSecurityEvent(clientIp, 'TIMESTAMP_VIOLATION', {
      timeDelta,
      maxFuture: MAX_FUTURE_SECONDS,
      reason: 'future',
    });

    return {
      valid: false,
      error: 'TIMESTAMP_FUTURE',
      message: `Request timestamp is in the future. Delta: ${timeDelta}s`,
      timeDelta,
    };
  }

  // Extract signature value (remove prefix if present)
  let signatureValue = signature;
  if (signatureValue.startsWith(SIGNATURE_PREFIX)) {
    signatureValue = signatureValue.slice(SIGNATURE_PREFIX.length);
  }

  // Check for replay attack (in-memory cache)
  if (hasSignatureBeenUsed(signatureValue)) {
    recordSecurityEvent(clientIp, 'REPLAY_ATTEMPT', {
      signaturePrefix: signatureValue.slice(0, 16),
      requestTimestamp,
      source: 'memory',
    });

    return {
      valid: false,
      error: 'REPLAY_DETECTED',
      message: 'Duplicate signature detected (replay attack)',
      timeDelta,
    };
  }

  // Check for replay attack (database - webhook_events table)
  try {
    const { data: existingEvent } = await supabase
      .from('webhook_events')
      .select('id')
      .eq('signature_hash', signatureValue)
      .maybeSingle();

    if (existingEvent) {
      recordSecurityEvent(clientIp, 'REPLAY_ATTEMPT', {
        signaturePrefix: signatureValue.slice(0, 16),
        requestTimestamp,
        source: 'database',
      });

      return {
        valid: false,
        error: 'REPLAY_DETECTED',
        message: 'Duplicate signature detected (replay attack)',
        timeDelta,
      };
    }
  } catch (error) {
    // Log but don't fail if database check fails
    logger.warn('Database replay check failed, using in-memory only', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Compute expected signature
  // Signature = HMAC-SHA256(timestamp + "." + body)
  const message = `${requestTimestamp}.${body}`;
  const expectedSignature = await createHmacSignature(message, secret);

  // Constant-time comparison
  if (!constantTimeCompare(signatureValue, expectedSignature)) {
    recordSecurityEvent(clientIp, 'INVALID_SIGNATURE', {
      requestTimestamp,
      bodyLength: body.length,
    });

    return {
      valid: false,
      error: 'INVALID_SIGNATURE',
      message: 'Signature verification failed',
      timeDelta,
    };
  }

  // Record the signature to prevent replay (in-memory)
  recordUsedSignature(signatureValue, requestTimestamp);

  // Record signature in database for distributed replay protection
  try {
    await supabase
      .from('webhook_events')
      .insert({
        signature_hash: signatureValue,
        event_type: 'ticket_webhook',
        source_ip: clientIp,
        timestamp: new Date(requestTimestamp * 1000).toISOString(),
        expires_at: new Date((requestTimestamp + MAX_REQUEST_AGE_SECONDS * 2) * 1000).toISOString(),
      });
  } catch (error) {
    // Log but don't fail if database insert fails
    logger.warn('Failed to record signature in database', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  logger.debug('Signature verified successfully', { timeDelta, clientIp });

  return {
    valid: true,
    timeDelta,
  };
}

// ============================================
// TICKET DATA INTERFACE
// ============================================

interface TicketData {
  ticket_id: string;
  event_name: string;
  ticket_type: string;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  qr_code_data?: string;
  order_id?: string;
  price_paid?: number;
  stripe_payment_id?: string;
  purchase_date?: string;
  metadata?: Record<string, any>;
}

// ============================================
// SECURITY ALERT FUNCTION
// ============================================

async function sendSecurityAlert(
  supabase: any,
  ip: string,
  eventCount: number,
  recentEvents: Array<{ type: string; timestamp: number }>
): Promise<void> {
  const alertData = {
    type: 'webhook_security_alert',
    severity: 'high',
    source_ip: ip,
    event_count: eventCount,
    recent_events: recentEvents.slice(-5).map(e => ({
      type: e.type,
      timestamp: new Date(e.timestamp).toISOString(),
    })),
    timestamp: new Date().toISOString(),
  };

  logger.error('SECURITY ALERT: Multiple security events from IP', undefined, {
    ip,
    eventCount,
    recentEvents: recentEvents.length,
  });

  // Try to insert alert into alerts table if it exists
  try {
    await supabase
      .from('security_alerts')
      .insert(alertData);
  } catch (error) {
    // Table may not exist, just log
    logger.debug('Could not store security alert', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ============================================
// MAIN HANDLER
// ============================================

// Simple trace context extraction for Deno Edge Function
function extractTraceContext(headers: Headers): { traceId: string; spanId: string } | null {
  const traceparent = headers.get('traceparent');
  if (!traceparent) return null;
  
  const parts = traceparent.trim().split('-');
  if (parts.length !== 4 || parts[0] !== '00') return null;
  
  const traceId = parts[1]?.toLowerCase();
  const spanId = parts[2]?.toLowerCase();
  
  if (!traceId || !spanId || traceId.length !== 32 || spanId.length !== 16) return null;
  
  return { traceId, spanId };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  const reqLogger = logger.child({ requestId });
  const done = reqLogger.time('ticket-webhook-request');

  // Extract trace context from headers
  const traceContext = extractTraceContext(req.headers);
  if (traceContext) {
    reqLogger.debug('Trace context extracted', { 
      traceId: traceContext.traceId.substring(0, 8) + '...',
      spanId: traceContext.spanId.substring(0, 8) + '...',
    });
  }

  // Get client IP
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
    || req.headers.get('x-real-ip') 
    || 'unknown';

  // Check if IP is blocked due to security events
  if (shouldBlockIP(clientIp)) {
    reqLogger.warn('Request blocked due to security events', { ip: clientIp });
    return new Response(
      JSON.stringify({ error: 'Access denied due to security policy' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (req.method !== 'POST') {
    reqLogger.warn('Method not allowed', { method: req.method });
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Rate limiting
  if (!checkRateLimit(clientIp)) {
    recordSecurityEvent(clientIp, 'RATE_LIMIT_EXCEEDED', {});
    reqLogger.warn('Rate limit exceeded', { ip: clientIp });
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
      { 
        status: 429, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Retry-After': '60'
        } 
      }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get request body for signature verification
    const bodyText = await req.text();

    // ============================================
    // ENHANCED SIGNATURE VERIFICATION
    // ============================================
    const webhookSecret = Deno.env.get('TICKET_WEBHOOK_SECRET');
    const signature = req.headers.get('x-webhook-signature');
    const timestamp = req.headers.get('x-webhook-timestamp');

    const verificationResult = await verifyWebhookSignatureEnhanced(
      bodyText,
      signature,
      timestamp,
      webhookSecret || null,
      clientIp,
      supabase
    );

    if (!verificationResult.valid) {
      reqLogger.warn('Webhook signature verification failed', {
        error: verificationResult.error,
        message: verificationResult.message,
        ip: clientIp,
      });

      // Track webhook signature failure
      try {
        const errorFingerprint = `webhook_${verificationResult.error || 'unknown'}`.substring(0, 16);
        await supabase.from('error_events').insert({
          fingerprint: errorFingerprint,
          message: `Webhook signature verification failed: ${verificationResult.message}`,
          category: 'validation',
          severity: verificationResult.error === 'INVALID_SIGNATURE' ? 'high' : 'medium',
          service_name: 'maguey-gate-scanner',
          environment: Deno.env.get('ENVIRONMENT') || 'production',
          context: {
            error: verificationResult.error,
            timeDelta: verificationResult.timeDelta,
            traceId: traceContext?.traceId,
            requestId,
          },
          tags: {
            type: 'webhook_security',
            errorType: verificationResult.error || 'unknown',
            source: 'ticket-webhook',
          },
          handled: false,
          ip_address: clientIp,
          trace_id: traceContext?.traceId || null,
        }).catch(err => {
          // Don't fail webhook if error tracking fails
          console.error('Failed to track webhook error:', err);
        });
      } catch (err) {
        // Ignore error tracking failures
        console.error('Error tracking failed:', err);
      }

      // Check if we should send an alert
      if (shouldAlertOnIP(clientIp)) {
        const events = securityEvents.get(clientIp) || [];
        await sendSecurityAlert(supabase, clientIp, events.length, events);
      }

      // Map error to HTTP status
      const statusMap: Record<string, number> = {
        'MISSING_HEADERS': 400,
        'TIMESTAMP_EXPIRED': 401,
        'TIMESTAMP_FUTURE': 401,
        'INVALID_SIGNATURE': 401,
        'REPLAY_DETECTED': 409,
      };

      return new Response(
        JSON.stringify({ 
          error: 'Unauthorized', 
          code: verificationResult.error,
          message: verificationResult.message,
        }),
        { 
          status: statusMap[verificationResult.error || 'INVALID_SIGNATURE'] || 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Parse the body after verification
    const body = JSON.parse(bodyText);
    const tickets: TicketData[] = Array.isArray(body.tickets) ? body.tickets : [body];
    const ticketLogger = reqLogger.child({ 
      ticketCount: tickets.length,
      orderId: tickets[0]?.order_id || null,
    });

    ticketLogger.info('Processing ticket webhook');

    if (!tickets || tickets.length === 0) {
      ticketLogger.warn('No tickets provided');
      return new Response(
        JSON.stringify({ error: 'No tickets provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate required fields
    for (const ticket of tickets) {
      if (!ticket.ticket_id || !ticket.event_name || !ticket.ticket_type) {
        ticketLogger.warn('Missing required fields', { ticketId: ticket.ticket_id });
        return new Response(
          JSON.stringify({ error: 'Missing required fields: ticket_id, event_name, ticket_type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ============================================
    // IDEMPOTENCY CHECK: Prevent duplicate processing
    // ============================================
    const idempotencyKey = tickets[0].order_id 
      ? `ticket-${tickets[0].order_id}-${tickets.map(t => t.ticket_id).join('-')}`
      : `ticket-${await hashPayload(bodyText)}`;

    const { data: idempotencyCheck, error: idempotencyError } = await supabase.rpc(
      'check_webhook_idempotency',
      {
        p_idempotency_key: idempotencyKey,
        p_webhook_type: 'ticket'
      }
    );

    if (idempotencyError) {
      ticketLogger.warn('Idempotency check failed', { error: idempotencyError.message });
      // Continue processing if idempotency check fails (fail open)
    } else if (idempotencyCheck && idempotencyCheck.length > 0 && idempotencyCheck[0].is_duplicate) {
      const cached = idempotencyCheck[0];
      ticketLogger.info('Duplicate webhook detected, returning cached response');
      done();
      return new Response(
        JSON.stringify(cached.cached_response || { success: true, message: 'Already processed' }),
        { 
          status: cached.cached_status || 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const idempotencyRecordId = idempotencyCheck?.[0]?.record_id;

    // Insert tickets with trace context in metadata
    const ticketsToInsert = tickets.map(ticket => ({
      ticket_id: ticket.ticket_id,
      event_name: ticket.event_name,
      ticket_type: ticket.ticket_type,
      guest_name: ticket.guest_name || null,
      guest_email: ticket.guest_email || null,
      guest_phone: ticket.guest_phone || null,
      qr_code_data: ticket.qr_code_data || ticket.ticket_id,
      order_id: ticket.order_id || null,
      price_paid: ticket.price_paid || null,
      stripe_payment_id: ticket.stripe_payment_id || null,
      purchase_date: ticket.purchase_date || new Date().toISOString(),
      status: 'issued',
      is_used: false,
      metadata: {
        ...(ticket.metadata || {}),
        ...(traceContext ? { trace_id: traceContext.traceId } : {}),
      },
    }));

    ticketLogger.debug('Inserting tickets into database', {
      traceId: traceContext?.traceId?.substring(0, 8),
    });

    const { data: insertedTickets, error: insertError } = await supabase
      .from('tickets')
      .insert(ticketsToInsert)
      .select();

    if (insertError) {
      ticketLogger.error('Failed to insert tickets', insertError as Error, { 
        errorCode: insertError.code 
      });
      
      // Track webhook processing error
      try {
        const errorFingerprint = `webhook_insert_${insertError.code || 'unknown'}`.substring(0, 16);
        await supabase.from('error_events').insert({
          fingerprint: errorFingerprint,
          message: `Failed to insert tickets: ${insertError.message}`,
          stack: insertError.stack || undefined,
          category: insertError.code === '23505' ? 'validation' : 'database',
          severity: 'high',
          service_name: 'maguey-gate-scanner',
          environment: Deno.env.get('ENVIRONMENT') || 'production',
          context: {
            errorCode: insertError.code,
            ticketCount: tickets.length,
            orderId: tickets[0]?.order_id,
            traceId: traceContext?.traceId,
            requestId,
          },
          tags: {
            type: 'webhook_processing',
            errorCode: insertError.code || 'unknown',
            source: 'ticket-webhook',
          },
          handled: false,
          ip_address: clientIp,
          trace_id: traceContext?.traceId || null,
        }).catch(err => {
          // Don't fail webhook if error tracking fails
          console.error('Failed to track webhook error:', err);
        });
      } catch (err) {
        // Ignore error tracking failures
        console.error('Error tracking failed:', err);
      }
      
      // Update idempotency record with error response
      if (idempotencyRecordId) {
        const errorResponse = {
          error: insertError.code === '23505' ? 'Duplicate ticket_id' : 'Failed to create tickets',
          message: insertError.message,
          details: insertError
        };
        
        await supabase.rpc('update_webhook_idempotency', {
          p_record_id: idempotencyRecordId,
          p_response_data: errorResponse,
          p_response_status: insertError.code === '23505' ? 409 : 500,
          p_metadata: {
            error_code: insertError.code,
            ticket_count: tickets.length,
          }
        }).catch(err => {
          console.error('Failed to update idempotency record:', err);
        });
      }
      
      // Handle duplicate ticket_id error
      if (insertError.code === '23505') {
        return new Response(
          JSON.stringify({ 
            error: 'Duplicate ticket_id',
            message: 'One or more tickets already exist',
            details: insertError.message 
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          error: 'Failed to create tickets',
          message: insertError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response = {
      success: true,
      tickets_created: insertedTickets?.length || 0,
      tickets: insertedTickets,
    };

    // Update idempotency record with successful response
    if (idempotencyRecordId) {
      await supabase.rpc('update_webhook_idempotency', {
        p_record_id: idempotencyRecordId,
        p_response_data: response,
        p_response_status: 201,
        p_metadata: {
          ticket_count: insertedTickets?.length || 0,
          order_id: tickets[0].order_id || null,
        }
      }).catch(err => {
        ticketLogger.warn('Failed to update idempotency record', { error: err.message });
      });
    }

    ticketLogger.info('Tickets created successfully', { 
      ticketsCreated: insertedTickets?.length || 0 
    });
    done();

    return new Response(
      JSON.stringify(response),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    reqLogger.error('Webhook processing failed', error);
    
    // Track unhandled webhook errors
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
      const supabaseForError = createClient(supabaseUrl, supabaseServiceKey);
      
      const errorFingerprint = `webhook_unhandled_${error.name || 'Error'}`.substring(0, 16);
      await supabaseForError.from('error_events').insert({
        fingerprint: errorFingerprint,
        message: `Webhook processing failed: ${error.message}`,
        stack: error.stack || undefined,
        category: 'unknown',
        severity: 'high',
        service_name: 'maguey-gate-scanner',
        environment: Deno.env.get('ENVIRONMENT') || 'production',
        context: {
          errorName: error.name,
          requestId,
          traceId: traceContext?.traceId,
          clientIp,
        },
        tags: {
          type: 'webhook_unhandled',
          source: 'ticket-webhook',
        },
        handled: false,
        ip_address: clientIp,
        trace_id: traceContext?.traceId || null,
      }).catch(err => {
        // Don't fail if error tracking fails
        console.error('Failed to track webhook error:', err);
      });
    } catch (err) {
      // Ignore error tracking failures
      console.error('Error tracking failed:', err);
    }
    
    done();
    
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
