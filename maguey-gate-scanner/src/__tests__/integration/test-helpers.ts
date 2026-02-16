/**
 * Integration Test Helpers
 * 
 * Utility functions for creating test scenarios, simulating scans,
 * and checking database state during integration tests.
 */

import { supabase, type Ticket } from '../../lib/supabase';
import { scanTicket, lookupTicketByQR, type ScanResult, type TicketWithRelations } from '../../lib/scanner-service';
import { createLogger } from '../../lib/logger';
import crypto from 'crypto';

const logger = createLogger({ module: 'integration-test-helpers' });

// ============================================
// QR CODE HELPERS
// ============================================

export interface TicketWithQR {
  ticket: Ticket;
  qrToken: string;
  qrSignature: string;
}

/**
 * Generate a valid QR signature for a ticket token
 * 
 * @param qrToken - QR token to sign
 * @param secret - Signing secret (optional, uses env var if not provided)
 * @returns HMAC signature
 */
export async function generateValidQRSignature(
  qrToken: string,
  secret?: string
): Promise<string> {
  const signingSecret = secret ||
    process.env.VITE_QR_SIGNING_SECRET ||
    import.meta.env?.VITE_QR_SIGNING_SECRET ||
    'test-qr-signing-secret-for-integration-tests';

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(qrToken));
  return btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
}

/**
 * Create a test ticket with valid QR code
 * 
 * @param eventId - Event ID
 * @param options - Optional ticket configuration
 * @returns Ticket with QR code
 */
export async function createTestTicketWithQR(
  eventId: string,
  options: {
    status?: string;
    attendeeName?: string;
    qrToken?: string;
  } = {}
): Promise<TicketWithQR> {
  const timestamp = Date.now();
  const qrToken = options.qrToken || `qr_test_${timestamp}_${Math.random().toString(36).substring(7)}`;
  const qrSignature = await generateValidQRSignature(qrToken);
  
  // Create order first
  const orderId = `test_order_${timestamp}`;
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      id: orderId,
      user_id: null,
      purchaser_email: `test_${timestamp}@example.com`,
      purchaser_name: 'Test Purchaser',
      event_id: eventId,
      subtotal: 100,
      fees_total: 10,
      total: 110,
      payment_provider: 'test',
      payment_reference: `test_payment_${timestamp}`,
      status: 'paid',
    })
    .select()
    .single();
  
  if (orderError || !order) {
    throw new Error(`Failed to create test order: ${orderError?.message || 'Unknown error'}`);
  }
  
  // Get or create ticket type
  const { data: ticketType } = await supabase
    .from('ticket_types')
    .select('id')
    .eq('event_id', eventId)
    .limit(1)
    .single();
  
  let ticketTypeId = ticketType?.id;
  
  if (!ticketTypeId) {
    const { data: newTicketType, error: ticketTypeError } = await supabase
      .from('ticket_types')
      .insert({
        event_id: eventId,
        code: 'TEST',
        name: 'Test Ticket Type',
        price: 100,
        fee: 10,
        limit_per_order: 10,
        total_inventory: 1000,
        tickets_sold: 0,
        description: 'Test ticket type',
        category: 'general',
        display_order: 0,
      })
      .select('id')
      .single();
    
    if (ticketTypeError || !newTicketType) {
      throw new Error(`Failed to create test ticket type: ${ticketTypeError?.message || 'Unknown error'}`);
    }
    
    ticketTypeId = newTicketType.id;
  }
  
  // Create ticket
  const ticketId = `test_ticket_${timestamp}`;
  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .insert({
      id: ticketId,
      order_id: orderId,
      event_id: eventId,
      ticket_type_id: ticketTypeId,
      attendee_name: options.attendeeName || 'Test Attendee',
      attendee_email: null,
      qr_token: qrToken,
      qr_signature: qrSignature,
      nfc_tag_id: null,
      nfc_signature: null,
      status: options.status || 'issued',
      scanned_at: null,
      issued_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (ticketError || !ticket) {
    throw new Error(`Failed to create test ticket: ${ticketError?.message || 'Unknown error'}`);
  }
  
  return {
    ticket,
    qrToken,
    qrSignature,
  };
}

// ============================================
// SCAN SIMULATION HELPERS
// ============================================

/**
 * Simulate a scan request
 * 
 * @param qrToken - QR token to scan
 * @param scannerId - Optional scanner ID
 * @returns Scan result
 */
export async function simulateScan(
  qrToken: string,
  scannerId?: string
): Promise<ScanResult> {
  // First lookup ticket by QR token
  const ticket = await lookupTicketByQR(qrToken);
  
  if (!ticket) {
    return {
      success: false,
      error: 'Ticket not found',
    };
  }
  
  // Perform scan
  const result = await scanTicket(
    ticket.id,
    scannerId,
    'single', // re-entry mode
    undefined, // scan start time
    'qr' // scan method
  );
  
  return result;
}

/**
 * Simulate concurrent scans of the same ticket
 * 
 * @param qrToken - QR token to scan
 * @param count - Number of concurrent scans
 * @returns Array of scan results
 */
export async function simulateConcurrentScans(
  qrToken: string,
  count: number
): Promise<ScanResult[]> {
  // First lookup ticket by QR token
  const ticket = await lookupTicketByQR(qrToken);
  
  if (!ticket) {
    return Array(count).fill({
      success: false,
      error: 'Ticket not found',
    });
  }
  
  // Create concurrent scan requests
  const requests = Array.from({ length: count }, () =>
    scanTicket(ticket.id, undefined, 'single', undefined, 'qr')
  );
  
  return Promise.all(requests);
}

// ============================================
// WEBHOOK HELPERS
// ============================================

/**
 * Create a signed webhook request
 * 
 * @param body - Request body object
 * @param secret - Webhook secret
 * @returns Headers and body string
 */
export async function createSignedWebhookRequest(
  body: object,
  secret: string
): Promise<{ headers: Headers; body: string }> {
  const bodyString = JSON.stringify(body);
  
  // Use the request-signing module to create headers
  const { createSignatureHeaders } = await import('../../lib/request-signing');
  const headersObj = await createSignatureHeaders(bodyString, secret);
  
  const headers = new Headers({
    'Content-Type': 'application/json',
    ...headersObj,
  });
  
  return {
    headers,
    body: bodyString,
  };
}

// ============================================
// SCAN LOG HELPERS
// ============================================

export interface ScanLog {
  id: string;
  ticket_id: string;
  scan_result: string;
  scanned_at: string;
  scanned_by: string | null;
  scan_duration_ms: number | null;
  scan_method: string | null;
  metadata: Record<string, any> | null;
}

/**
 * Get scan history for a ticket
 * 
 * @param ticketId - Ticket ID
 * @returns Array of scan logs
 */
export async function getTicketScanHistory(ticketId: string): Promise<ScanLog[]> {
  const { data: scanLogs, error } = await supabase
    .from('scan_logs')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('scanned_at', { ascending: false });
  
  if (error) {
    throw new Error(`Failed to fetch scan history: ${error.message}`);
  }
  
  return (scanLogs || []) as ScanLog[];
}

/**
 * Get latest scan log for a ticket
 * 
 * @param ticketId - Ticket ID
 * @returns Latest scan log or null
 */
export async function getLatestScanLog(ticketId: string): Promise<ScanLog | null> {
  const { data: scanLog, error } = await supabase
    .from('scan_logs')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('scanned_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      // No rows found
      return null;
    }
    throw new Error(`Failed to fetch latest scan log: ${error.message}`);
  }
  
  return scanLog as ScanLog;
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate that a ticket has been scanned
 * 
 * @param ticketId - Ticket ID
 * @returns True if ticket is scanned
 */
export async function isTicketScanned(ticketId: string): Promise<boolean> {
  const { data: ticket, error } = await supabase
    .from('tickets')
    .select('status, scanned_at')
    .eq('id', ticketId)
    .single();
  
  if (error || !ticket) {
    return false;
  }
  
  return ticket.status === 'scanned' && ticket.scanned_at !== null;
}

/**
 * Validate QR signature
 * 
 * @param qrToken - QR token
 * @param signature - Signature to validate
 * @param secret - Optional signing secret
 * @returns True if signature is valid
 */
export async function validateQRSignature(
  qrToken: string,
  signature: string,
  secret?: string
): Promise<boolean> {
  const expectedSignature = await generateValidQRSignature(qrToken, secret);
  return signature === expectedSignature;
}
