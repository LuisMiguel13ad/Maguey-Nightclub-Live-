/**
 * VIP Floor Plan Realtime E2E Tests
 *
 * Tests Supabase Realtime subscription for VIP table availability updates.
 * Validates: "VIP floor plan shows table as booked immediately after confirmation"
 */

import { test, expect } from '../fixtures/vip-seed';
import { createClient } from '@supabase/supabase-js';

// Get Supabase config from environment
function getSupabaseClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

test.describe('VIP Floor Plan Realtime Updates', () => {
  test('floor plan updates when VIP table booked', async ({ page, vipTestData }) => {
    // Navigate to VIP tables page for the test event
    await page.goto(`/events/${vipTestData.eventId}/vip-tables`);

    // Wait for the floor plan to load
    await page.waitForLoadState('networkidle');

    // Wait for tables to be visible - look for the table buttons
    // The floor plan shows table numbers in buttons, look for our test table
    const tableSelector = `button:has-text("${vipTestData.tableNumber}")`;

    // Wait for our table to appear (may take a moment for data to load)
    await expect(page.locator(tableSelector).first()).toBeVisible({ timeout: 10000 });

    // Verify table is available initially (should NOT have 'RESERVED' text visible)
    // Available tables are clickable buttons, reserved tables show "RESERVED" text
    const tableButton = page.locator(tableSelector).first();
    await expect(tableButton).toBeVisible();

    // Verify the button is clickable (available state)
    await expect(tableButton).toBeEnabled();

    // Insert reservation directly via database to trigger realtime update
    const supabase = getSupabaseClient();

    // Create a VIP reservation for this table - this should trigger realtime update
    const { error: reservationError } = await supabase.from('vip_reservations').insert({
      event_id: vipTestData.eventId,
      event_vip_table_id: vipTestData.tableId,
      table_number: parseInt(vipTestData.tableNumber),
      status: 'confirmed',
      purchaser_name: 'Realtime Test User',
      purchaser_email: '[email protected]',
      purchaser_phone: '+15555550000',
      checked_in_guests: 0,
      stripe_payment_intent_id: `pi_test_realtime_${Date.now()}`,
      amount_paid_cents: vipTestData.tablePrice * 100,
      qr_code_token: `VIP-REALTIME-TEST-${Date.now()}`,
      package_snapshot: {
        guestCount: vipTestData.tableCapacity,
        tier: vipTestData.tableTier,
        tableName: `Table ${vipTestData.tableNumber}`,
      },
      disclaimer_accepted_at: new Date().toISOString(),
      refund_policy_accepted_at: new Date().toISOString(),
    });

    if (reservationError) {
      console.error('Reservation creation failed:', reservationError);
    }

    // Also update the table's is_available flag
    // This is what the app subscribes to for realtime updates
    const { error: updateError } = await supabase
      .from('event_vip_tables')
      .update({ is_available: false })
      .eq('id', vipTestData.tableId);

    if (updateError) {
      console.error('Table update failed:', updateError);
    }

    // Wait for realtime update to reflect in UI
    // The table should change from a clickable button to a disabled/reserved state
    // Look for the "RESERVED" text to appear where our table number was
    const reservedIndicator = page.locator(`text=RESERVED`).or(
      page.locator(`div:has-text("${vipTestData.tableNumber}") >> text=RESERVED`)
    );

    // Supabase Realtime typically delivers updates within 1-2 seconds
    // We give it up to 5 seconds as specified in the plan
    await expect(reservedIndicator.first()).toBeVisible({ timeout: 5000 });

    // Clean up: Delete the test reservation and restore table availability
    await supabase
      .from('vip_reservations')
      .delete()
      .eq('event_id', vipTestData.eventId)
      .eq('event_vip_table_id', vipTestData.tableId);

    await supabase
      .from('event_vip_tables')
      .update({ is_available: true })
      .eq('id', vipTestData.tableId);
  });

  test('floor plan shows table as available after reservation cancelled', async ({
    page,
    vipTestData,
  }) => {
    const supabase = getSupabaseClient();

    // First, create a reservation and mark table as unavailable
    const { data: reservation, error: createError } = await supabase
      .from('vip_reservations')
      .insert({
        event_id: vipTestData.eventId,
        event_vip_table_id: vipTestData.tableId,
        table_number: parseInt(vipTestData.tableNumber),
        status: 'confirmed',
        purchaser_name: 'Cancel Test User',
        purchaser_email: '[email protected]',
        purchaser_phone: '+15555550001',
        checked_in_guests: 0,
        stripe_payment_intent_id: `pi_test_cancel_${Date.now()}`,
        amount_paid_cents: vipTestData.tablePrice * 100,
        qr_code_token: `VIP-CANCEL-TEST-${Date.now()}`,
        package_snapshot: {
          guestCount: vipTestData.tableCapacity,
          tier: vipTestData.tableTier,
          tableName: `Table ${vipTestData.tableNumber}`,
        },
        disclaimer_accepted_at: new Date().toISOString(),
        refund_policy_accepted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (createError || !reservation) {
      console.error('Failed to create reservation for cancel test:', createError);
      test.skip();
      return;
    }

    // Mark table as unavailable
    await supabase.from('event_vip_tables').update({ is_available: false }).eq('id', vipTestData.tableId);

    // Navigate to VIP tables page
    await page.goto(`/events/${vipTestData.eventId}/vip-tables`);
    await page.waitForLoadState('networkidle');

    // Wait for floor plan to load and show table as reserved
    await page.waitForTimeout(1000); // Brief wait for initial render

    // Verify table shows as reserved initially
    const reservedIndicator = page.locator(`text=RESERVED`).first();
    await expect(reservedIndicator).toBeVisible({ timeout: 5000 });

    // Now "cancel" by updating table back to available (simulates cancellation flow)
    await supabase.from('event_vip_tables').update({ is_available: true }).eq('id', vipTestData.tableId);

    // Wait for realtime update - table should become available again
    const tableButton = page.locator(`button:has-text("${vipTestData.tableNumber}")`).first();

    // The table button should become visible/enabled again within 5 seconds
    await expect(tableButton).toBeVisible({ timeout: 5000 });
    await expect(tableButton).toBeEnabled();

    // Clean up
    await supabase.from('vip_reservations').delete().eq('id', reservation.id);
  });

  test('subscription reconnects and shows correct state after page reload', async ({
    page,
    vipTestData,
  }) => {
    const supabase = getSupabaseClient();

    // Navigate to VIP tables page
    await page.goto(`/events/${vipTestData.eventId}/vip-tables`);
    await page.waitForLoadState('networkidle');

    // Wait for table to appear as available
    const tableButton = page.locator(`button:has-text("${vipTestData.tableNumber}")`).first();
    await expect(tableButton).toBeVisible({ timeout: 10000 });
    await expect(tableButton).toBeEnabled();

    // While on the page, book the table via database
    const { data: reservation, error: createError } = await supabase
      .from('vip_reservations')
      .insert({
        event_id: vipTestData.eventId,
        event_vip_table_id: vipTestData.tableId,
        table_number: parseInt(vipTestData.tableNumber),
        status: 'confirmed',
        purchaser_name: 'Reconnect Test User',
        purchaser_email: '[email protected]',
        purchaser_phone: '+15555550002',
        checked_in_guests: 0,
        stripe_payment_intent_id: `pi_test_reconnect_${Date.now()}`,
        amount_paid_cents: vipTestData.tablePrice * 100,
        qr_code_token: `VIP-RECONNECT-TEST-${Date.now()}`,
        package_snapshot: {
          guestCount: vipTestData.tableCapacity,
          tier: vipTestData.tableTier,
          tableName: `Table ${vipTestData.tableNumber}`,
        },
        disclaimer_accepted_at: new Date().toISOString(),
        refund_policy_accepted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (createError || !reservation) {
      console.error('Failed to create reservation:', createError);
      test.skip();
      return;
    }

    // Update table availability
    await supabase.from('event_vip_tables').update({ is_available: false }).eq('id', vipTestData.tableId);

    // Wait for realtime update
    await expect(page.locator('text=RESERVED').first()).toBeVisible({ timeout: 5000 });

    // Reload the page - this tests subscription reconnection
    await page.reload();
    await page.waitForLoadState('networkidle');

    // After reload, table should still show as reserved (fetched from DB)
    await expect(page.locator('text=RESERVED').first()).toBeVisible({ timeout: 5000 });

    // Now restore table availability while on reloaded page
    await supabase.from('event_vip_tables').update({ is_available: true }).eq('id', vipTestData.tableId);

    // Realtime subscription should reconnect and show update
    await expect(tableButton).toBeVisible({ timeout: 5000 });
    await expect(tableButton).toBeEnabled();

    // Clean up
    await supabase.from('vip_reservations').delete().eq('id', reservation.id);
  });
});
