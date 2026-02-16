/**
 * VIP Checkout E2E Test
 *
 * Tests the complete VIP table checkout flow:
 * 1. Navigate to VIP tables page for event
 * 2. Select an available VIP table
 * 3. Fill host information form
 * 4. Complete Stripe test payment
 * 5. Verify confirmation page with guest passes
 * 6. Verify database state (reservation confirmed)
 */

import { test, expect } from '../fixtures/vip-seed';
import { createClient } from '@supabase/supabase-js';

test.describe('VIP Checkout Flow', () => {
  test('completes VIP table checkout with Stripe test payment', async ({ page, vipTestData }) => {
    const {
      eventId,
      tableId,
      tableNumber,
      tablePrice,
      tableTier,
      tableCapacity,
      ticketTierPrice,
    } = vipTestData;

    // Calculate expected total (VIP table + GA ticket)
    const expectedTotal = (tablePrice + ticketTierPrice).toFixed(2);

    // 1. Navigate to VIP tables page for the test event
    await page.goto(`/events/${eventId}/vip-tables`);

    // Wait for page to load - should show VIP Tables heading
    await expect(page.locator('text=VIP').first()).toBeVisible({ timeout: 15000 });

    // 2. Wait for tables to load and select our test table
    // Look for the table button with our table number
    const tableButton = page.locator(`button:has-text("${tableNumber}")`).first();
    await expect(tableButton).toBeVisible({ timeout: 10000 });

    // Click to select the table
    await tableButton.click();

    // Wait for the bottom panel to appear showing "Reserve This Table"
    const reserveButton = page.getByRole('button', { name: /reserve this table/i });
    await expect(reserveButton).toBeVisible({ timeout: 5000 });

    // Click to proceed to booking form
    await reserveButton.click();

    // 3. Should navigate to VIP booking form
    await page.waitForURL(`**/vip-booking**`, { timeout: 10000 });

    // Wait for booking form to load
    await expect(page.getByText(/complete your reservation/i)).toBeVisible({ timeout: 10000 });

    // Fill host contact information
    await page.getByPlaceholder('John').fill('E2E');
    await page.getByPlaceholder('Doe').fill('TestHost');
    await page.getByPlaceholder('you@email.com').fill('[email protected]');
    await page.getByPlaceholder('(555) 123-4567').fill('555-123-4567');

    // Entry ticket should already be auto-selected (first tier)
    // Verify the ticket tier is selected
    const ticketRadio = page.locator('input[type="radio"][name="ticketTier"]').first();
    await expect(ticketRadio).toBeChecked({ timeout: 5000 });

    // Agree to terms and conditions
    const termsCheckbox = page.locator('input[type="checkbox"][name="agreedToTerms"]');
    await termsCheckbox.check();

    // Click "Continue to Payment" button
    const continueButton = page.getByRole('button', { name: /continue to payment/i });
    await expect(continueButton).toBeEnabled({ timeout: 5000 });
    await continueButton.click();

    // 4. Wait for Stripe Payment Element to load
    // The payment form should appear (embedded in the same page)
    await expect(page.locator('text=Payment Details')).toBeVisible({ timeout: 15000 });

    // Wait for Stripe iframe to load
    const stripeFrame = page.frameLocator('iframe[name*="__privateStripeFrame"]').first();

    // Fill card number in Stripe iframe
    // Note: Stripe Elements uses iframes, so we need to interact with them
    await page.waitForTimeout(2000); // Give Stripe time to fully load

    // Try to fill the card number field in the Stripe iframe
    // Stripe's PaymentElement has multiple frames, we need to find the card input
    try {
      // Wait for any Stripe iframe to be available
      await page.waitForSelector('iframe[name*="stripe"]', { timeout: 10000 });

      // Fill card details using Stripe test card
      // Since Stripe uses complex iframe structure, we'll wait for the Pay button to be ready
      const payButton = page.getByRole('button', { name: new RegExp(`pay.*${expectedTotal}`, 'i') });

      // Wait a bit for Stripe to initialize
      await page.waitForTimeout(3000);

      // The Stripe Payment Element should be interactive now
      // Fill the card number field
      const cardNumberFrame = page.frameLocator('iframe[name*="__privateStripeFrame"]').nth(0);
      const cardInput = cardNumberFrame.locator('[name="number"], [placeholder*="card number"], input').first();

      if (await cardInput.isVisible({ timeout: 5000 })) {
        await cardInput.fill('4242424242424242');
      }

      // Fill expiry
      const expiryFrame = page.frameLocator('iframe[name*="__privateStripeFrame"]').nth(1);
      const expiryInput = expiryFrame.locator('input').first();
      if (await expiryInput.isVisible({ timeout: 2000 })) {
        await expiryInput.fill('1230');
      }

      // Fill CVC
      const cvcFrame = page.frameLocator('iframe[name*="__privateStripeFrame"]').nth(2);
      const cvcInput = cvcFrame.locator('input').first();
      if (await cvcInput.isVisible({ timeout: 2000 })) {
        await cvcInput.fill('123');
      }

      // Click the pay button
      await payButton.click();
    } catch (stripeError) {
      // If the above approach fails, try a more general approach
      console.log('Trying alternative Stripe input method...');

      // Look for any input fields in Stripe frames
      const frames = page.frames();
      for (const frame of frames) {
        if (frame.url().includes('stripe')) {
          const inputs = await frame.locator('input').all();
          for (const input of inputs) {
            const placeholder = await input.getAttribute('placeholder');
            const name = await input.getAttribute('name');

            if (placeholder?.includes('number') || name?.includes('number')) {
              await input.fill('4242424242424242');
            } else if (placeholder?.includes('MM') || name?.includes('expiry')) {
              await input.fill('1230');
            } else if (placeholder?.includes('CVC') || name?.includes('cvc')) {
              await input.fill('123');
            }
          }
        }
      }

      // Try clicking pay button
      const payButton = page.getByRole('button', { name: /pay/i });
      if (await payButton.isVisible()) {
        await payButton.click();
      }
    }

    // 5. Wait for payment confirmation
    // The page should show "Reservation Confirmed!" after successful payment
    await expect(
      page.getByRole('heading', { name: /reservation confirmed/i })
    ).toBeVisible({ timeout: 45000 }); // Stripe can take time

    // Verify confirmation details are displayed
    await expect(page.getByText(/confirmation/i)).toBeVisible();
    await expect(page.getByText(/e2e testhost/i)).toBeVisible();

    // Verify QR code section is displayed
    await expect(page.getByText(/show this at check-in/i)).toBeVisible();

    // 6. Verify database state - reservation should be confirmed
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceRoleKey) {
      const supabase = createClient(supabaseUrl, serviceRoleKey);

      // Query for the reservation created by this checkout
      const { data: reservations, error: queryError } = await supabase
        .from('vip_reservations')
        .select('id, status, checked_in_guests, event_id, table_id, purchaser_email')
        .eq('purchaser_email', '[email protected]')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (queryError) {
        console.error('Database query error:', queryError);
      }

      // Verify reservation exists and is confirmed
      expect(reservations).toBeTruthy();
      expect(reservations?.length).toBeGreaterThan(0);

      const reservation = reservations![0];
      expect(reservation.status).toBe('confirmed');
      expect(reservation.checked_in_guests).toBe(0);
      expect(reservation.event_id).toBe(eventId);

      console.log(`[VIP Test] Verified reservation ${reservation.id} is confirmed`);

      // Check for guest passes
      const { data: guestPasses, error: passError } = await supabase
        .from('vip_guest_passes')
        .select('id, pass_type, status, qr_code_token')
        .eq('reservation_id', reservation.id);

      if (passError) {
        console.error('Guest passes query error:', passError);
      }

      // Should have at least 1 guest pass (the host pass)
      expect(guestPasses).toBeTruthy();
      expect(guestPasses?.length).toBeGreaterThanOrEqual(1);

      // Host pass should exist
      const hostPass = guestPasses?.find(p => p.pass_type === 'host');
      expect(hostPass).toBeTruthy();
      expect(hostPass?.status).toBe('active');
      expect(hostPass?.qr_code_token).toBeTruthy();

      console.log(`[VIP Test] Verified ${guestPasses?.length} guest passes created`);

      // Cleanup: Delete the test reservation (to not pollute database)
      // The guest passes will cascade delete
      await supabase
        .from('vip_reservations')
        .delete()
        .eq('id', reservation.id);

      console.log(`[VIP Test] Cleaned up test reservation`);
    } else {
      console.warn('[VIP Test] Skipping database verification - missing env vars');
    }
  });
});
