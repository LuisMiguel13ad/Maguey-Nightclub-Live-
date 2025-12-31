/**
 * Integration Test Setup
 * 
 * Provides database setup, seeding, and cleanup utilities for integration tests.
 * Uses a test schema or isolated test data to avoid affecting production.
 */

import { supabase, type Event, type TicketType, type Order } from '../lib/supabase';
import { createLogger } from '../lib/logger';
import type { SupabaseClient } from '@supabase/supabase-js';

const logger = createLogger({ module: 'integration-test-setup' });

// Test data markers to identify test records
const TEST_PREFIX = 'test_';
const TEST_EVENT_PREFIX = `${TEST_PREFIX}event_`;
const TEST_ORDER_PREFIX = `${TEST_PREFIX}order_`;

// Track created test IDs for cleanup
const createdEventIds: string[] = [];
const createdOrderIds: string[] = [];
const createdTicketTypeIds: string[] = [];

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
      .from('events')
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
    // Delete test orders and their tickets (cascade should handle tickets)
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
    
    // Delete test events (cascade should handle ticket types, but we delete them first)
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
    // (e.g., from failed tests)
    const timestamp = Date.now();
    const oldTestMarker = `${TEST_PREFIX}${timestamp - 86400000}`; // 24 hours ago
    
    // Clean up old test events
    const { error: cleanupEventsError } = await supabase
      .from('events')
      .delete()
      .like('id', `${TEST_EVENT_PREFIX}%`);
    
    if (cleanupEventsError) {
      logger.warn('Error cleaning up old test events', { error: cleanupEventsError });
    }
    
    // Reset tracking arrays
    createdEventIds.length = 0;
    createdOrderIds.length = 0;
    createdTicketTypeIds.length = 0;
    
    logger.info('Test database cleanup complete');
  } catch (error) {
    logger.error('Failed to cleanup test database', { error });
    // Don't throw - cleanup failures shouldn't fail tests
  }
}

/**
 * Seed a test event with ticket types
 * 
 * @param options - Optional event configuration
 * @returns Created event and ticket types
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
    ticketTypes?: Array<{
      name: string;
      price: number;
      fee?: number;
      totalInventory?: number;
      limitPerOrder?: number;
    }>;
  } = {}
): Promise<{ event: Event; ticketTypes: TicketType[] }> {
  const timestamp = Date.now();
  const eventId = generateUUID();
  
  const eventData = {
    id: eventId,
    name: options.name || `Test Event ${timestamp}`,
    description: 'Test event for integration tests',
    image_url: null,
    genre: 'test',
    venue_name: 'Test Venue',
    venue_address: '123 Test St',
    city: 'Test City',
    event_date: options.eventDate || new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
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
  
  // Create ticket types
  const ticketTypesData = (options.ticketTypes || [
    { name: 'General Admission', price: 50, fee: 5, totalInventory: 100 },
    { name: 'VIP', price: 100, fee: 10, totalInventory: 50 },
  ]).map((tt, index) => ({
    id: generateUUID(),
    event_id: eventId,
    code: `TEST_${index}`,
    name: tt.name,
    price: tt.price,
    fee: tt.fee || 0,
    limit_per_order: tt.limitPerOrder || 10,
    total_inventory: tt.totalInventory ?? null,
    tickets_sold: 0,
    description: `Test ticket type: ${tt.name}`,
    category: 'general' as const,
    section_name: null,
    section_description: null,
    display_order: index,
  }));
  
  const { data: ticketTypes, error: ticketTypesError } = await supabase
    .from('ticket_types')
    .insert(ticketTypesData)
    .select();
  
  if (ticketTypesError || !ticketTypes) {
    // Clean up event if ticket types fail
    await supabase.from('events').delete().eq('id', eventId);
    throw new Error(`Failed to create test ticket types: ${ticketTypesError?.message || 'Unknown error'}`);
  }
  
  ticketTypes.forEach(tt => createdTicketTypeIds.push(tt.id));
  
  logger.debug('Test event seeded', { eventId, ticketTypeCount: ticketTypes.length });
  
  return { event, ticketTypes };
}

/**
 * Seed a test order (for testing order retrieval, updates, etc.)
 * 
 * @param eventId - Event ID to associate order with
 * @param options - Optional order configuration
 * @returns Created order
 */
export async function seedTestOrder(
  eventId: string,
  options: {
    purchaserEmail?: string;
    purchaserName?: string;
    status?: string;
    total?: number;
  } = {}
): Promise<Order> {
  const timestamp = Date.now();
  const orderId = generateUUID();
  
  const orderData = {
    id: orderId,
    user_id: null,
    purchaser_email: options.purchaserEmail || `test_${timestamp}@example.com`,
    purchaser_name: options.purchaserName || 'Test Purchaser',
    event_id: eventId,
    subtotal: options.total ? options.total * 0.9 : 100,
    fees_total: options.total ? options.total * 0.1 : 10,
    total: options.total || 110,
    payment_provider: 'stripe',
    payment_reference: `test_payment_${timestamp}`,
    status: options.status || 'pending',
  };
  
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert(orderData)
    .select()
    .single();
  
  if (orderError || !order) {
    throw new Error(`Failed to create test order: ${orderError?.message || 'Unknown error'}`);
  }
  
  createdOrderIds.push(orderId);
  
  logger.debug('Test order seeded', { orderId, eventId });
  
  return order;
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
  createdOrderIds.length = 0;
  createdTicketTypeIds.length = 0;
}

/**
 * Get all tracked test IDs (for debugging)
 */
export function getTrackedTestIds(): {
  eventIds: string[];
  orderIds: string[];
  ticketTypeIds: string[];
} {
  return {
    eventIds: [...createdEventIds],
    orderIds: [...createdOrderIds],
    ticketTypeIds: [...createdTicketTypeIds],
  };
}
