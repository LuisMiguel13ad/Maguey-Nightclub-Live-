/**
 * VIP E2E Test Fixture
 *
 * Worker-scoped fixture that creates isolated test data for VIP checkout E2E tests.
 * Creates a test event with VIP tables, cleaned up automatically after tests complete.
 */

import { test as base } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

/**
 * VIP test data fixture type
 */
export type VipFixtures = {
  vipTestData: {
    eventId: string;
    tableId: string;
    tableNumber: string;
    tablePrice: number;
    tableTier: string;
    tableCapacity: number;
    ticketTierId: string;
    ticketTierPrice: number;
  };
};

/**
 * Extended test with VIP fixtures
 */
export const test = base.extend<{}, VipFixtures>({
  vipTestData: [async ({}, use) => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Generate unique test identifiers to avoid conflicts
    const testId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const eventName = `VIP E2E Test Event ${testId}`;

    // Create test event (future date to ensure it's active)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14); // 2 weeks from now
    const eventDate = futureDate.toISOString().split('T')[0];

    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert({
        name: eventName,
        event_date: eventDate,
        event_time: '22:00:00',
        venue_name: 'VIP Test Venue',
        venue_address: '123 Test Street',
        city: 'Test City',
        description: 'E2E test event for VIP checkout',
        vip_enabled: true,
        status: 'published',
      })
      .select()
      .single();

    if (eventError || !event) {
      throw new Error(`Failed to create test event: ${eventError?.message || 'Unknown error'}`);
    }

    // Create GA ticket tier for unified checkout (VIP requires GA ticket)
    const { data: ticketTier, error: ticketError } = await supabase
      .from('ticket_types')
      .insert({
        event_id: event.id,
        name: 'General Admission',
        description: 'Standard entry ticket',
        price: 25.00,
        quantity_available: 100,
        is_active: true,
      })
      .select()
      .single();

    if (ticketError || !ticketTier) {
      // Cleanup event on failure
      await supabase.from('events').delete().eq('id', event.id);
      throw new Error(`Failed to create ticket tier: ${ticketError?.message || 'Unknown error'}`);
    }

    // Create VIP table for this event
    const tableNumber = Math.floor(Math.random() * 100) + 100; // Random table number 100-199
    const { data: table, error: tableError } = await supabase
      .from('event_vip_tables')
      .insert({
        event_id: event.id,
        table_number: tableNumber,
        table_name: `Premium Test Table ${tableNumber}`,
        tier: 'premium',
        price: 750,
        guest_capacity: 8,
        bottle_service_description: '2 premium bottles included',
        floor_section: 'Test Section',
        position_description: 'Test Position',
        is_active: true,
        is_available: true,
        sort_order: 1,
      })
      .select()
      .single();

    if (tableError || !table) {
      // Cleanup on failure
      await supabase.from('ticket_types').delete().eq('id', ticketTier.id);
      await supabase.from('events').delete().eq('id', event.id);
      throw new Error(`Failed to create VIP table: ${tableError?.message || 'Unknown error'}`);
    }

    console.log(`[VIP Fixture] Created test event: ${event.id}`);
    console.log(`[VIP Fixture] Created VIP table: ${table.id} (Table ${tableNumber})`);
    console.log(`[VIP Fixture] Created ticket tier: ${ticketTier.id}`);

    // Provide fixture data to tests
    await use({
      eventId: event.id,
      tableId: table.id,
      tableNumber: String(tableNumber),
      tablePrice: table.price,
      tableTier: table.tier,
      tableCapacity: table.guest_capacity,
      ticketTierId: ticketTier.id,
      ticketTierPrice: ticketTier.price,
    });

    // Cleanup: Delete test data (cascade deletes related records)
    console.log(`[VIP Fixture] Cleaning up test event: ${event.id}`);

    // Delete in order to respect foreign key constraints
    // Note: vip_reservations, vip_guest_passes will cascade from event deletion
    await supabase.from('event_vip_tables').delete().eq('id', table.id);
    await supabase.from('ticket_types').delete().eq('id', ticketTier.id);
    await supabase.from('events').delete().eq('id', event.id);

    console.log('[VIP Fixture] Cleanup complete');
  }, { scope: 'worker' }],
});

export { expect } from '@playwright/test';
