/**
 * VIP Email Delivery E2E Test
 *
 * Tests the complete VIP email delivery flow:
 * 1. Complete VIP checkout (triggers email)
 * 2. Poll email_queue for VIP confirmation email
 * 3. Verify email delivered via Resend webhook
 * 4. Verify email_delivery_status shows successful delivery
 */

import { test, expect } from '../fixtures/vip-seed';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Get Supabase client with service role for database access
 */
function getSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

/**
 * Test email address used for VIP checkouts
 */
const TEST_EMAIL = '[email protected]';

test.describe('VIP Email Delivery', () => {
  test('VIP confirmation email delivered after checkout', async ({ page, vipTestData }) => {
    const {
      eventId,
      tableNumber,
      tablePrice,
      ticketTierPrice,
    } = vipTestData;

    const supabase = getSupabaseClient();
    const expectedTotal = (tablePrice + ticketTierPrice).toFixed(2);

    // =====================================================
    // 1. Complete VIP checkout flow
    // =====================================================
    await page.goto(`/events/${eventId}/vip-tables`);

    // Wait for page to load - should show VIP Tables heading
    await expect(page.locator('text=VIP').first()).toBeVisible({ timeout: 15000 });

    // Wait for tables to load and select our test table
    const tableButton = page.locator(`button:has-text("${tableNumber}")`).first();
    await expect(tableButton).toBeVisible({ timeout: 10000 });
    await tableButton.click();

    // Wait for the bottom panel and click Reserve
    const reserveButton = page.getByRole('button', { name: /reserve this table/i });
    await expect(reserveButton).toBeVisible({ timeout: 5000 });
    await reserveButton.click();

    // Should navigate to VIP booking form
    await page.waitForURL(`**/vip-booking**`, { timeout: 10000 });
    await expect(page.getByText(/complete your reservation/i)).toBeVisible({ timeout: 10000 });

    // Fill host contact information
    await page.getByPlaceholder('John').fill('Email');
    await page.getByPlaceholder('Doe').fill('TestHost');
    await page.getByPlaceholder('you@email.com').fill(TEST_EMAIL);
    await page.getByPlaceholder('(555) 123-4567').fill('555-999-8888');

    // Entry ticket should already be auto-selected
    const ticketRadio = page.locator('input[type="radio"][name="ticketTier"]').first();
    await expect(ticketRadio).toBeChecked({ timeout: 5000 });

    // Agree to terms
    const termsCheckbox = page.locator('input[type="checkbox"][name="agreedToTerms"]');
    await termsCheckbox.check();

    // Continue to payment
    const continueButton = page.getByRole('button', { name: /continue to payment/i });
    await expect(continueButton).toBeEnabled({ timeout: 5000 });
    await continueButton.click();

    // Wait for Stripe Payment Element
    await expect(page.locator('text=Payment Details')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000); // Give Stripe time to load

    // Fill Stripe test card
    try {
      await page.waitForSelector('iframe[name*="stripe"]', { timeout: 10000 });
      const payButton = page.getByRole('button', { name: new RegExp(`pay.*${expectedTotal}`, 'i') });
      await page.waitForTimeout(3000);

      const cardNumberFrame = page.frameLocator('iframe[name*="__privateStripeFrame"]').nth(0);
      const cardInput = cardNumberFrame.locator('[name="number"], [placeholder*="card number"], input').first();
      if (await cardInput.isVisible({ timeout: 5000 })) {
        await cardInput.fill('4242424242424242');
      }

      const expiryFrame = page.frameLocator('iframe[name*="__privateStripeFrame"]').nth(1);
      const expiryInput = expiryFrame.locator('input').first();
      if (await expiryInput.isVisible({ timeout: 2000 })) {
        await expiryInput.fill('1230');
      }

      const cvcFrame = page.frameLocator('iframe[name*="__privateStripeFrame"]').nth(2);
      const cvcInput = cvcFrame.locator('input').first();
      if (await cvcInput.isVisible({ timeout: 2000 })) {
        await cvcInput.fill('123');
      }

      await payButton.click();
    } catch (stripeError) {
      // Try alternative Stripe input method
      console.log('Trying alternative Stripe input method...');
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
      const payButton = page.getByRole('button', { name: /pay/i });
      if (await payButton.isVisible()) {
        await payButton.click();
      }
    }

    // =====================================================
    // 2. Wait for confirmation
    // =====================================================
    await expect(
      page.getByRole('heading', { name: /reservation confirmed/i })
    ).toBeVisible({ timeout: 45000 });

    console.log('[Email Test] VIP checkout completed, waiting for email...');

    // =====================================================
    // 3. Poll email_queue for VIP confirmation email
    // =====================================================
    let emailEntry: {
      id: string;
      resend_email_id: string | null;
      status: string;
      email_type: string;
      recipient_email: string;
      subject: string;
    } | null = null;

    // Poll for up to 30 seconds for email to be queued and sent
    for (let i = 0; i < 30; i++) {
      const { data } = await supabase
        .from('email_queue')
        .select('id, resend_email_id, status, email_type, recipient_email, subject')
        .eq('email_type', 'vip_confirmation')
        .eq('recipient_email', TEST_EMAIL)
        .order('created_at', { ascending: false })
        .limit(1);

      if (data?.[0]?.resend_email_id) {
        emailEntry = data[0];
        break;
      }
      await page.waitForTimeout(1000);
    }

    expect(emailEntry).toBeTruthy();
    expect(emailEntry!.status).toMatch(/sent|delivered/);
    expect(emailEntry!.email_type).toBe('vip_confirmation');
    expect(emailEntry!.recipient_email).toBe(TEST_EMAIL);

    console.log(`[Email Test] Email entry found: ${emailEntry!.id}, status: ${emailEntry!.status}`);
    console.log(`[Email Test] Resend email ID: ${emailEntry!.resend_email_id}`);

    // =====================================================
    // 4. Wait for delivery webhook (up to 60 seconds)
    // =====================================================
    let delivered = false;
    for (let i = 0; i < 60; i++) {
      const { data } = await supabase
        .from('email_delivery_status')
        .select('event_type')
        .eq('resend_email_id', emailEntry!.resend_email_id!)
        .eq('event_type', 'email.delivered')
        .maybeSingle();

      if (data) {
        delivered = true;
        console.log(`[Email Test] Delivery confirmed after ${i + 1} seconds`);
        break;
      }
      await page.waitForTimeout(1000);
    }

    expect(delivered).toBe(true);

    // =====================================================
    // 5. Cleanup: Delete the test reservation
    // =====================================================
    const { data: reservations } = await supabase
      .from('vip_reservations')
      .select('id')
      .eq('purchaser_email', TEST_EMAIL)
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (reservations?.[0]) {
      await supabase
        .from('vip_reservations')
        .delete()
        .eq('id', reservations[0].id);
      console.log(`[Email Test] Cleaned up test reservation: ${reservations[0].id}`);
    }

    console.log('[Email Test] VIP email delivery test completed successfully');
  });

  test('email queue entry contains correct content fields', async ({ page, vipTestData }) => {
    const {
      eventId,
      tableNumber,
      tablePrice,
      ticketTierPrice,
    } = vipTestData;

    const supabase = getSupabaseClient();
    const expectedTotal = (tablePrice + ticketTierPrice).toFixed(2);

    // Complete VIP checkout (abbreviated version)
    await page.goto(`/events/${eventId}/vip-tables`);
    await expect(page.locator('text=VIP').first()).toBeVisible({ timeout: 15000 });

    const tableButton = page.locator(`button:has-text("${tableNumber}")`).first();
    await expect(tableButton).toBeVisible({ timeout: 10000 });
    await tableButton.click();

    const reserveButton = page.getByRole('button', { name: /reserve this table/i });
    await expect(reserveButton).toBeVisible({ timeout: 5000 });
    await reserveButton.click();

    await page.waitForURL(`**/vip-booking**`, { timeout: 10000 });
    await expect(page.getByText(/complete your reservation/i)).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder('John').fill('Content');
    await page.getByPlaceholder('Doe').fill('TestHost');
    await page.getByPlaceholder('you@email.com').fill(TEST_EMAIL);
    await page.getByPlaceholder('(555) 123-4567').fill('555-888-7777');

    const ticketRadio = page.locator('input[type="radio"][name="ticketTier"]').first();
    await expect(ticketRadio).toBeChecked({ timeout: 5000 });

    const termsCheckbox = page.locator('input[type="checkbox"][name="agreedToTerms"]');
    await termsCheckbox.check();

    const continueButton = page.getByRole('button', { name: /continue to payment/i });
    await continueButton.click();

    await expect(page.locator('text=Payment Details')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // Fill Stripe card
    try {
      await page.waitForSelector('iframe[name*="stripe"]', { timeout: 10000 });
      await page.waitForTimeout(3000);

      const cardNumberFrame = page.frameLocator('iframe[name*="__privateStripeFrame"]').nth(0);
      await cardNumberFrame.locator('input').first().fill('4242424242424242');

      const expiryFrame = page.frameLocator('iframe[name*="__privateStripeFrame"]').nth(1);
      await expiryFrame.locator('input').first().fill('1230');

      const cvcFrame = page.frameLocator('iframe[name*="__privateStripeFrame"]').nth(2);
      await cvcFrame.locator('input').first().fill('123');

      await page.getByRole('button', { name: new RegExp(`pay.*${expectedTotal}`, 'i') }).click();
    } catch {
      await page.getByRole('button', { name: /pay/i }).click();
    }

    await expect(
      page.getByRole('heading', { name: /reservation confirmed/i })
    ).toBeVisible({ timeout: 45000 });

    // Get email entry with all content fields
    let emailEntry: {
      id: string;
      email_type: string;
      recipient_email: string;
      subject: string;
      html_body: string;
      resend_email_id: string | null;
      status: string;
    } | null = null;

    for (let i = 0; i < 30; i++) {
      const { data } = await supabase
        .from('email_queue')
        .select('id, email_type, recipient_email, subject, html_body, resend_email_id, status')
        .eq('email_type', 'vip_confirmation')
        .eq('recipient_email', TEST_EMAIL)
        .order('created_at', { ascending: false })
        .limit(1);

      if (data?.[0]?.resend_email_id) {
        emailEntry = data[0];
        break;
      }
      await page.waitForTimeout(1000);
    }

    expect(emailEntry).toBeTruthy();

    // Verify email content fields
    expect(emailEntry!.recipient_email).toBe(TEST_EMAIL);
    expect(emailEntry!.email_type).toBe('vip_confirmation');
    expect(emailEntry!.subject).toBeTruthy();
    expect(emailEntry!.subject.length).toBeGreaterThan(0);

    // Subject should contain VIP-related keywords
    const subjectLower = emailEntry!.subject.toLowerCase();
    expect(
      subjectLower.includes('vip') ||
      subjectLower.includes('reservation') ||
      subjectLower.includes('table') ||
      subjectLower.includes('confirmed')
    ).toBe(true);

    // Verify html_body contains key elements
    expect(emailEntry!.html_body).toBeTruthy();
    const htmlLower = emailEntry!.html_body.toLowerCase();

    // Should contain QR code reference
    expect(
      htmlLower.includes('qr') ||
      htmlLower.includes('check-in') ||
      htmlLower.includes('scan')
    ).toBe(true);

    console.log(`[Email Content Test] Subject: ${emailEntry!.subject}`);
    console.log(`[Email Content Test] HTML body length: ${emailEntry!.html_body.length} characters`);

    // Cleanup
    const { data: reservations } = await supabase
      .from('vip_reservations')
      .select('id')
      .eq('purchaser_email', TEST_EMAIL)
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (reservations?.[0]) {
      await supabase
        .from('vip_reservations')
        .delete()
        .eq('id', reservations[0].id);
    }
  });

  test('email queue processes VIP confirmation within 2 minutes', async ({ page, vipTestData }) => {
    const {
      eventId,
      tableNumber,
      tablePrice,
      ticketTierPrice,
    } = vipTestData;

    const supabase = getSupabaseClient();
    const expectedTotal = (tablePrice + ticketTierPrice).toFixed(2);

    // Complete VIP checkout
    await page.goto(`/events/${eventId}/vip-tables`);
    await expect(page.locator('text=VIP').first()).toBeVisible({ timeout: 15000 });

    const tableButton = page.locator(`button:has-text("${tableNumber}")`).first();
    await expect(tableButton).toBeVisible({ timeout: 10000 });
    await tableButton.click();

    const reserveButton = page.getByRole('button', { name: /reserve this table/i });
    await expect(reserveButton).toBeVisible({ timeout: 5000 });
    await reserveButton.click();

    await page.waitForURL(`**/vip-booking**`, { timeout: 10000 });
    await expect(page.getByText(/complete your reservation/i)).toBeVisible({ timeout: 10000 });

    await page.getByPlaceholder('John').fill('Timing');
    await page.getByPlaceholder('Doe').fill('TestHost');
    await page.getByPlaceholder('you@email.com').fill(TEST_EMAIL);
    await page.getByPlaceholder('(555) 123-4567').fill('555-777-6666');

    const ticketRadio = page.locator('input[type="radio"][name="ticketTier"]').first();
    await expect(ticketRadio).toBeChecked({ timeout: 5000 });

    const termsCheckbox = page.locator('input[type="checkbox"][name="agreedToTerms"]');
    await termsCheckbox.check();

    const continueButton = page.getByRole('button', { name: /continue to payment/i });
    await continueButton.click();

    await expect(page.locator('text=Payment Details')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // Fill Stripe card
    try {
      await page.waitForSelector('iframe[name*="stripe"]', { timeout: 10000 });
      await page.waitForTimeout(3000);

      const cardNumberFrame = page.frameLocator('iframe[name*="__privateStripeFrame"]').nth(0);
      await cardNumberFrame.locator('input').first().fill('4242424242424242');

      const expiryFrame = page.frameLocator('iframe[name*="__privateStripeFrame"]').nth(1);
      await expiryFrame.locator('input').first().fill('1230');

      const cvcFrame = page.frameLocator('iframe[name*="__privateStripeFrame"]').nth(2);
      await cvcFrame.locator('input').first().fill('123');

      await page.getByRole('button', { name: new RegExp(`pay.*${expectedTotal}`, 'i') }).click();
    } catch {
      await page.getByRole('button', { name: /pay/i }).click();
    }

    await expect(
      page.getByRole('heading', { name: /reservation confirmed/i })
    ).toBeVisible({ timeout: 45000 });

    // Get email entry with timestamps
    let emailEntry: {
      id: string;
      created_at: string;
      updated_at: string;
      status: string;
      resend_email_id: string | null;
    } | null = null;

    for (let i = 0; i < 30; i++) {
      const { data } = await supabase
        .from('email_queue')
        .select('id, created_at, updated_at, status, resend_email_id')
        .eq('email_type', 'vip_confirmation')
        .eq('recipient_email', TEST_EMAIL)
        .order('created_at', { ascending: false })
        .limit(1);

      if (data?.[0]?.resend_email_id && data[0].status !== 'pending') {
        emailEntry = data[0];
        break;
      }
      await page.waitForTimeout(1000);
    }

    expect(emailEntry).toBeTruthy();
    expect(emailEntry!.status).toMatch(/sent|delivered/);

    // Verify processing time
    const createdAt = new Date(emailEntry!.created_at);
    const updatedAt = new Date(emailEntry!.updated_at);
    const processingTimeMs = updatedAt.getTime() - createdAt.getTime();
    const processingTimeSec = processingTimeMs / 1000;

    // Should process within 2 minutes (120 seconds)
    expect(processingTimeSec).toBeLessThan(120);

    console.log(`[Email Timing Test] Email processed in ${processingTimeSec.toFixed(1)}s`);
    console.log(`[Email Timing Test] Created: ${emailEntry!.created_at}`);
    console.log(`[Email Timing Test] Updated: ${emailEntry!.updated_at}`);

    // Cleanup
    const { data: reservations } = await supabase
      .from('vip_reservations')
      .select('id')
      .eq('purchaser_email', TEST_EMAIL)
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (reservations?.[0]) {
      await supabase
        .from('vip_reservations')
        .delete()
        .eq('id', reservations[0].id);
    }
  });
});
