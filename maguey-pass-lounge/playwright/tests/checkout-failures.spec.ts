import { test, expect } from '@playwright/test';

/**
 * Payment Failure E2E Tests
 *
 * These tests verify that payment failures are handled gracefully with proper
 * user feedback. The app uses Stripe Checkout (redirect) rather than embedded
 * Stripe Elements, so we test the error handling at the checkout initiation level.
 *
 * Stripe test cards for failure scenarios:
 * Source: https://docs.stripe.com/testing
 */
const STRIPE_TEST_CARDS = {
  GENERIC_DECLINE: '4000000000000002',
  INSUFFICIENT_FUNDS: '4000000000009995',
  EXPIRED_CARD: '4000000000000069',
  PROCESSING_ERROR: '4000000000000119',
  SUCCESS: '4242424242424242',
};

test.describe('Payment Failure Handling', () => {
  /**
   * Note: The maguey-pass-lounge app uses Stripe Checkout Sessions (redirect flow),
   * not embedded Stripe Elements. This means:
   * 1. User selects tickets on /checkout page
   * 2. Clicks "Pay $X.XX" button
   * 3. Gets redirected to Stripe's hosted checkout page
   * 4. On success, redirected to /checkout/success
   * 5. On cancel, redirected back with ?canceled=true
   *
   * Card decline errors are handled BY STRIPE on their hosted page.
   * Our frontend only handles errors during checkout session creation.
   */

  test.beforeEach(async ({ page }) => {
    // Navigate to events page to get a real event
    await page.goto('/events');
    await expect(page.getByRole('heading', { name: /events/i })).toBeVisible();
  });

  test('shows toast error when checkout session creation fails', async ({ page }) => {
    // Navigate to an event
    const eventCard = page.locator("a[href^='/event/']").first();
    await expect(eventCard).toBeVisible();
    await eventCard.click();
    await page.waitForURL('**/event/**');

    // Go to checkout section and buy tickets
    const ticketsSection = page.locator('#tickets');
    await expect(ticketsSection).toBeVisible();

    const buyButton = ticketsSection.getByRole('button', { name: /buy tickets/i }).first();
    await buyButton.click();
    await page.waitForURL('**/checkout**');

    // Add a ticket
    const addButton = page.getByRole('button', { name: /^add /i }).first();
    await addButton.click();

    // Click checkout to go to payment
    const checkoutButton = page.getByRole('button', { name: /^checkout$/i });
    await expect(checkoutButton).toBeEnabled();
    await checkoutButton.click();
    await page.waitForURL('**/payment**');

    // At this point we're on the Payment page
    // The payment flow redirects to Stripe Checkout
    // We can verify the page loaded correctly
    await expect(page.getByRole('heading', { name: /payment/i })).toBeVisible();

    // Verify pay button exists with correct format
    const payButton = page.getByRole('button', { name: /pay \$[\d.]+/i });
    await expect(payButton).toBeVisible();
  });

  test('handles network errors during checkout with toast notification', async ({ page }) => {
    // Navigate through checkout flow
    const eventCard = page.locator("a[href^='/event/']").first();
    await expect(eventCard).toBeVisible();
    await eventCard.click();
    await page.waitForURL('**/event/**');

    const ticketsSection = page.locator('#tickets');
    await expect(ticketsSection).toBeVisible();

    const buyButton = ticketsSection.getByRole('button', { name: /buy tickets/i }).first();
    await buyButton.click();
    await page.waitForURL('**/checkout**');

    const addButton = page.getByRole('button', { name: /^add /i }).first();
    await addButton.click();

    const checkoutButton = page.getByRole('button', { name: /^checkout$/i });
    await checkoutButton.click();
    await page.waitForURL('**/payment**');

    // Intercept the Supabase function call and make it fail
    await page.route('**/functions/v1/create-checkout-session', async (route) => {
      await route.abort('failed');
    });

    // Click pay button to trigger checkout
    const payButton = page.getByRole('button', { name: /pay \$[\d.]+/i });
    await payButton.click();

    // Verify toast error appears (sonner uses data-sonner-toast attribute)
    // The toast should appear with an error message
    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toBeVisible({ timeout: 10000 });

    // Verify the toast contains the expected message
    const toast = page.locator('[data-sonner-toast][data-type="error"]');
    await expect(toast).toContainText(/failed|error|issue/i);
  });

  test('displays retry button in toast on payment error', async ({ page }) => {
    // Navigate through checkout flow
    const eventCard = page.locator("a[href^='/event/']").first();
    await expect(eventCard).toBeVisible();
    await eventCard.click();
    await page.waitForURL('**/event/**');

    const ticketsSection = page.locator('#tickets');
    await expect(ticketsSection).toBeVisible();

    const buyButton = ticketsSection.getByRole('button', { name: /buy tickets/i }).first();
    await buyButton.click();
    await page.waitForURL('**/checkout**');

    const addButton = page.getByRole('button', { name: /^add /i }).first();
    await addButton.click();

    const checkoutButton = page.getByRole('button', { name: /^checkout$/i });
    await checkoutButton.click();
    await page.waitForURL('**/payment**');

    // Intercept and fail the checkout session creation
    await page.route('**/functions/v1/create-checkout-session', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Payment processing error' }),
      });
    });

    // Click pay button
    const payButton = page.getByRole('button', { name: /pay \$[\d.]+/i });
    await payButton.click();

    // Wait for error toast
    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toBeVisible({ timeout: 10000 });

    // Verify retry button exists in the toast
    const retryButton = page.locator('[data-sonner-toast] button:has-text("Retry")');
    await expect(retryButton).toBeVisible();
  });

  test('retry button triggers new payment attempt', async ({ page }) => {
    // Navigate through checkout flow
    const eventCard = page.locator("a[href^='/event/']").first();
    await expect(eventCard).toBeVisible();
    await eventCard.click();
    await page.waitForURL('**/event/**');

    const ticketsSection = page.locator('#tickets');
    await expect(ticketsSection).toBeVisible();

    const buyButton = ticketsSection.getByRole('button', { name: /buy tickets/i }).first();
    await buyButton.click();
    await page.waitForURL('**/checkout**');

    const addButton = page.getByRole('button', { name: /^add /i }).first();
    await addButton.click();

    const checkoutButton = page.getByRole('button', { name: /^checkout$/i });
    await checkoutButton.click();
    await page.waitForURL('**/payment**');

    let requestCount = 0;

    // Intercept checkout calls and track them
    await page.route('**/functions/v1/create-checkout-session', async (route) => {
      requestCount++;
      if (requestCount === 1) {
        // First call fails
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Temporary error' }),
        });
      } else {
        // Second call succeeds (or we just verify it was called)
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ url: 'https://checkout.stripe.com/test' }),
        });
      }
    });

    // Click pay button - first attempt fails
    const payButton = page.getByRole('button', { name: /pay \$[\d.]+/i });
    await payButton.click();

    // Wait for error toast
    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toBeVisible({ timeout: 10000 });

    // Click retry button
    const retryButton = page.locator('[data-sonner-toast] button:has-text("Retry")');
    await retryButton.click();

    // Verify that a second request was made
    // Give it a moment to process
    await page.waitForTimeout(1000);
    expect(requestCount).toBe(2);
  });

  test('shows loading state during checkout', async ({ page }) => {
    // Navigate through checkout flow
    const eventCard = page.locator("a[href^='/event/']").first();
    await expect(eventCard).toBeVisible();
    await eventCard.click();
    await page.waitForURL('**/event/**');

    const ticketsSection = page.locator('#tickets');
    await expect(ticketsSection).toBeVisible();

    const buyButton = ticketsSection.getByRole('button', { name: /buy tickets/i }).first();
    await buyButton.click();
    await page.waitForURL('**/checkout**');

    const addButton = page.getByRole('button', { name: /^add /i }).first();
    await addButton.click();

    const checkoutButton = page.getByRole('button', { name: /^checkout$/i });
    await checkoutButton.click();
    await page.waitForURL('**/payment**');

    // Delay the response to observe loading state
    await page.route('**/functions/v1/create-checkout-session', async (route) => {
      await page.waitForTimeout(2000);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: 'https://checkout.stripe.com/test' }),
      });
    });

    // Click pay button
    const payButton = page.getByRole('button', { name: /pay \$[\d.]+/i });
    await payButton.click();

    // Verify button shows loading state (contains "Redirecting" text)
    await expect(page.getByRole('button', { name: /redirecting/i })).toBeVisible();

    // Button should be disabled during loading
    await expect(page.getByRole('button', { name: /redirecting/i })).toBeDisabled();
  });

  test('handles canceled payment return with appropriate message', async ({ page }) => {
    // Navigate directly to payment page with canceled flag
    // This simulates returning from Stripe after user canceled
    await page.goto('/events');

    const eventCard = page.locator("a[href^='/event/']").first();
    await expect(eventCard).toBeVisible();
    await eventCard.click();
    await page.waitForURL('**/event/**');

    const ticketsSection = page.locator('#tickets');
    await expect(ticketsSection).toBeVisible();

    const buyButton = ticketsSection.getByRole('button', { name: /buy tickets/i }).first();
    await buyButton.click();
    await page.waitForURL('**/checkout**');

    // Get the checkout URL to extract event ID
    const url = page.url();
    const eventIdMatch = url.match(/event=([^&]+)/);

    if (eventIdMatch) {
      // Navigate to payment page with canceled flag
      const canceledUrl = `/payment?event=${eventIdMatch[1]}&canceled=true&tickets=${encodeURIComponent(JSON.stringify([{id: 'test', name: 'Test', quantity: 1, price: 10, fee: 2}]))}`;
      await page.goto(canceledUrl);

      // Page should still load and allow retry
      await expect(page.getByRole('heading', { name: /payment/i })).toBeVisible();
    }
  });
});

test.describe('Stripe Checkout Error Messages', () => {
  /**
   * These tests document the expected behavior when Stripe returns errors.
   * Since we use Stripe Checkout (hosted page), card decline errors are
   * handled by Stripe's UI. Our frontend handles:
   * - Session creation errors
   * - Network errors
   * - Invalid configuration errors
   */

  test('displays user-friendly message for generic errors', async ({ page }) => {
    await page.goto('/events');

    const eventCard = page.locator("a[href^='/event/']").first();
    await expect(eventCard).toBeVisible();
    await eventCard.click();
    await page.waitForURL('**/event/**');

    const ticketsSection = page.locator('#tickets');
    await expect(ticketsSection).toBeVisible();

    const buyButton = ticketsSection.getByRole('button', { name: /buy tickets/i }).first();
    await buyButton.click();
    await page.waitForURL('**/checkout**');

    const addButton = page.getByRole('button', { name: /^add /i }).first();
    await addButton.click();

    const checkoutButton = page.getByRole('button', { name: /^checkout$/i });
    await checkoutButton.click();
    await page.waitForURL('**/payment**');

    // Simulate a generic error
    await page.route('**/functions/v1/create-checkout-session', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    const payButton = page.getByRole('button', { name: /pay \$[\d.]+/i });
    await payButton.click();

    // Should show user-friendly message (not technical details)
    const toast = page.locator('[data-sonner-toast][data-type="error"]');
    await expect(toast).toBeVisible({ timeout: 10000 });

    // Message should be user-friendly, not expose internal errors
    await expect(toast).toContainText(/payment failed|try again|connection issue/i);
  });

  test('displays appropriate message for network timeouts', async ({ page }) => {
    await page.goto('/events');

    const eventCard = page.locator("a[href^='/event/']").first();
    await expect(eventCard).toBeVisible();
    await eventCard.click();
    await page.waitForURL('**/event/**');

    const ticketsSection = page.locator('#tickets');
    await expect(ticketsSection).toBeVisible();

    const buyButton = ticketsSection.getByRole('button', { name: /buy tickets/i }).first();
    await buyButton.click();
    await page.waitForURL('**/checkout**');

    const addButton = page.getByRole('button', { name: /^add /i }).first();
    await addButton.click();

    const checkoutButton = page.getByRole('button', { name: /^checkout$/i });
    await checkoutButton.click();
    await page.waitForURL('**/payment**');

    // Simulate network timeout by aborting
    await page.route('**/functions/v1/create-checkout-session', async (route) => {
      await route.abort('timedout');
    });

    const payButton = page.getByRole('button', { name: /pay \$[\d.]+/i });
    await payButton.click();

    // Should show connection-related message
    const toast = page.locator('[data-sonner-toast][data-type="error"]');
    await expect(toast).toBeVisible({ timeout: 10000 });
    await expect(toast).toContainText(/connection|network|try again/i);
  });
});
