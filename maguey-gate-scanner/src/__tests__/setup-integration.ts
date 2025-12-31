/**
 * Integration Test Setup
 * 
 * Provides database setup, seeding, and cleanup utilities for integration tests.
 * Uses a test schema or isolated test data to avoid affecting production.
 */

import { supabase, type Ticket, type Event } from '../lib/supabase';
import { createLogger } from '../lib/logger';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import type { SupabaseClient } from '@supabase/supabase-js';

const logger = createLogger({ module: 'integration-test-setup' });

// Test data markers to identify test records
const TEST_PREFIX = 'test_';
const TEST_EVENT_PREFIX = `${TEST_PREFIX}event_`;
const TEST_TICKET_PREFIX = `${TEST_PREFIX}ticket_`;
const TEST_ORDER_PREFIX = `${TEST_PREFIX}order_`;

// Track created test IDs for cleanup
const createdEventIds: string[] = [];
const createdTicketIds: string[] = [];
const createdOrderIds: string[] = [];
const createdTicketTypeIds: string[] = [];

// QR signing secret for test tickets
const getQRSigningSecret = (): string => {
  return process.env.VITE_QR_SIGNING_SECRET || 
    import.meta.env?.VITE_QR_SIGNING_SECRET || 
    'test-qr-signing-secret-for-integration-tests';
};

/**
 * Generate a valid QR signature for a ticket token
 */
function generateQRSignature(qrToken: string): string {
  const secret = getQRSigningSecret();
  const keyBytes = utf8ToBytes(secret);
  const tokenBytes = utf8ToBytes(qrToken);
  return bytesToHex(hmac(sha256, keyBytes, tokenBytes));
}

/**
 * Setup test database
 * - Cleans up any leftover test data from previous runs
 * - Prepares database for integration tests
 */
export async function setupTestDatabase(): Promise<void> {
  logger.info('Setting up test database...');
  
  try {
    // Clean up any leftover test data first
    await cleanupTestDatabase();
    
    // Verify database connection
    const { error: healthError } = await supabase
      .from('tickets')
      .select('id')
      .limit(1);
    
    if (healthError) {
      throw new Error(`Database connection failed: ${healthError.message}`);
    }
    
    logger.info('Test database setup complete');
  } catch (error) {
    logger.error('Failed to setup test database', { error });
    throw error;
  }
}

/**
 * Cleanup test database
 * - Removes all test data created during test runs
 * - Should be called after all tests complete
 */
export async function cleanupTestDatabase(): Promise<void> {
  logger.info('Cleaning up test database...');
  
  try {
    // Delete test scan logs
    if (createdTicketIds.length > 0) {
      const { error: scanLogsError } = await supabase
        .from('scan_logs')
        .delete()
        .in('ticket_id', createdTicketIds);
      
      if (scanLogsError) {
        logger.warn('Error deleting test scan logs', { error: scanLogsError });
      }
    }
    
    // Delete test tickets
    if (createdTicketIds.length > 0) {
      const { error: ticketsError } = await supabase
        .from('tickets')
        .delete()
        .in('id', createdTicketIds);
      
      if (ticketsError) {
        logger.warn('Error deleting test tickets', { error: ticketsError });
      }
    }
    
    // Delete test orders
    if (createdOrderIds.length > 0) {
      const { error: ordersError } = await supabase
        .from('orders')
        .delete()
        .in('id', createdOrderIds);
      
      if (ordersError) {
        logger.warn('Error deleting test orders', { error: ordersError });
      }
    }
    
    // Delete test ticket types
    if (createdTicketTypeIds.length > 0) {
      const { error: ticketTypesError } = await supabase
        .from('ticket_types')
        .delete()
        .in('id', createdTicketTypeIds);
      
      if (ticketTypesError) {
        logger.warn('Error deleting test ticket types', { error: ticketTypesError });
      }
    }
    
    // Delete test events
    if (createdEventIds.length > 0) {
      const { error: eventsError } = await supabase
        .from('events')
        .delete()
        .in('id', createdEventIds);
      
      if (eventsError) {
        logger.warn('Error deleting test events', { error: eventsError });
      }
    }
    
    // Also clean up any test data that might have been created but not tracked
    const timestamp = Date.now();
    const oldTestMarker = `${TEST_PREFIX}${timestamp - 86400000}`; // 24 hours ago
    
    // Clean up old test events (skip - UUIDs don't support LIKE pattern matching)
    // Instead, we rely on tracking arrays for cleanup
    
    if (cleanupEventsError) {
      logger.warn('Error cleaning up old test events', { error: cleanupEventsError });
    }
    
    // Reset tracking arrays
    createdEventIds.length = 0;
    createdTicketIds.length = 0;
    createdOrderIds.length = 0;
    createdTicketTypeIds.length = 0;
    
    logger.info('Test database cleanup complete');
  } catch (error) {
    logger.error('Failed to cleanup test database', { error });
    // Don't throw - cleanup failures shouldn't fail tests
  }
}

/**
 * Seed a test event
 * 
 * @param options - Optional event configuration
 * @returns Created event
 */
/**
 * Generate a UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export async function seedTestEvent(
  options: {
    name?: string;
    eventDate?: string;
    eventTime?: string;
    status?: 'draft' | 'published' | 'archived';
    isActive?: boolean;
  } = {}
): Promise<Event> {
  const timestamp = Date.now();
  const eventId = generateUUID();
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().split('T')[0];
  
  const eventData = {
    id: eventId,
    name: options.name || `Test Event ${timestamp}`,
    description: 'Test event for integration tests',
    image_url: null,
    genre: 'test',
    venue_name: 'Test Venue',
    venue_address: '123 Test St',
    city: 'Test City',
    event_date: options.eventDate || defaultDate,
    event_time: options.eventTime || '20:00:00',
    status: options.status || 'published',
    is_active: options.isActive !== undefined ? options.isActive : true,
  };
  
  // Create event
  const { data: event, error: eventError } = await supabase
    .from('events')
    .insert(eventData)
    .select()
    .single();
  
  if (eventError || !event) {
    throw new Error(`Failed to create test event: ${eventError?.message || 'Unknown error'}`);
  }
  
  createdEventIds.push(eventId);
  
  logger.debug('Test event seeded', { eventId });
  
  return event;
}

/**
 * Seed a test ticket with valid QR code
 * 
 * @param eventId - Event ID to associate ticket with
 * @param options - Optional ticket configuration
 * @returns Created ticket with QR code
 */
export async function seedTestTicket(
  eventId: string,
  options: {
    status?: string;
    attendeeName?: string;
    attendeeEmail?: string;
    qrToken?: string;
    scannedAt?: string | null;
  } = {}
): Promise<Ticket & { qr_token: string; qr_signature: string }> {
  const timestamp = Date.now();
  const ticketId = generateUUID();
  const orderId = generateUUID();
  
  // Generate QR token if not provided
  const qrToken = options.qrToken || `qr_test_${timestamp}_${Math.random().toString(36).substring(7)}`;
  const qrSignature = generateQRSignature(qrToken);
  
  // First create a test order
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
  
  createdOrderIds.push(orderId);
  
  // Create a test ticket type if needed
  const { data: existingTicketType } = await supabase
    .from('ticket_types')
    .select('id')
    .eq('event_id', eventId)
    .limit(1)
    .single();
  
  let ticketTypeId = existingTicketType?.id;
  
  if (!ticketTypeId) {
    const { data: ticketType, error: ticketTypeError } = await supabase
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
    
    if (ticketTypeError || !ticketType) {
      throw new Error(`Failed to create test ticket type: ${ticketTypeError?.message || 'Unknown error'}`);
    }
    
    ticketTypeId = ticketType.id;
    createdTicketTypeIds.push(ticketTypeId);
  }
  
  // Create ticket
  const ticketData = {
    id: ticketId,
    order_id: orderId,
    event_id: eventId,
    ticket_type_id: ticketTypeId,
    attendee_name: options.attendeeName || 'Test Attendee',
    attendee_email: options.attendeeEmail || null,
    qr_token: qrToken,
    qr_signature: qrSignature,
    nfc_tag_id: null,
    nfc_signature: null,
    status: options.status || 'issued',
    scanned_at: options.scannedAt || null,
    issued_at: new Date().toISOString(),
  };
  
  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .insert(ticketData)
    .select()
    .single();
  
  if (ticketError || !ticket) {
    throw new Error(`Failed to create test ticket: ${ticketError?.message || 'Unknown error'}`);
  }
  
  createdTicketIds.push(ticketId);
  
  logger.debug('Test ticket seeded', { ticketId, qrToken: qrToken.substring(0, 20) + '...' });
  
  return {
    ...ticket,
    qr_token: qrToken,
    qr_signature: qrSignature,
  } as Ticket & { qr_token: string; qr_signature: string };
}

/**
 * Get a test Supabase client
 * Useful for testing with different client configurations
 */
export function getTestClient(): SupabaseClient<any> {
  return supabase;
}

/**
 * Wait for a condition to be true (useful for async operations)
 */
export async function waitFor(
  condition: () => Promise<boolean> | boolean,
  timeoutMs: number = 5000,
  intervalMs: number = 100
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  
  throw new Error(`Condition not met within ${timeoutMs}ms`);
}

/**
 * Reset all test data tracking
 * Useful for individual test cleanup
 */
export function resetTestTracking(): void {
  createdEventIds.length = 0;
  createdTicketIds.length = 0;
  createdOrderIds.length = 0;
  createdTicketTypeIds.length = 0;
}

/**
 * Get all tracked test IDs (for debugging)
 */
export function getTrackedTestIds(): {
  eventIds: string[];
  ticketIds: string[];
  orderIds: string[];
  ticketTypeIds: string[];
} {
  return {
    eventIds: [...createdEventIds],
    ticketIds: [...createdTicketIds],
    orderIds: [...createdOrderIds],
    ticketTypeIds: [...createdTicketTypeIds],
  };
}
