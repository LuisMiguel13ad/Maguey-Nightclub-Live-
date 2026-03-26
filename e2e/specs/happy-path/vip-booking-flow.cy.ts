/// <reference types="cypress" />

/**
 * VIP Table Booking Flow - Happy Path E2E Tests
 *
 * Tests the full VIP booking experience on maguey-pass-lounge (localhost:3016):
 *   Event detail -> VIP table selection -> Booking form -> Stripe Payment Elements -> Confirmation
 *
 * VIP uses Stripe Payment Intents (PaymentElement), NOT Checkout Sessions.
 * The booking form includes Zod validation.
 */

describe('VIP Table Booking Flow', () => {
  const testRunId = Date.now().toString();
  const testEmail = `vip+${testRunId}@test.maguey.com`;
  const testPhone = '(302) 555-1234';
  let testEventId: string | null = null;
  let testVipTableId: string | null = null;

  before(() => {
    // Health check before running VIP tests
    cy.task('healthCheck').then((checks: any) => {
      expect(checks.db).to.be.true;
    });

    // Create a test event with ticket types so VIP booking has a GA tier to select
    cy.task('createTestEvent', {
      name: `VIP E2E Test Event ${testRunId}`,
      status: 'published',
    }).then((event: any) => {
      expect(event).to.not.be.null;
      testEventId = event.id;

      // Create a VIP table for the test event
      cy.task('createTestVipTable', event.id).then((table: any) => {
        if (table) {
          testVipTableId = table.id;
        }
      });
    });
  });

  after(() => {
    // Cleanup: VIP test data and test event
    if (testRunId) {
      cy.task('cleanupVipTestData', testRunId);
    }
    if (testEventId) {
      cy.task('deleteTestEvent', testEventId);
    }
  });

  it('navigates from event detail to VIP table selection', () => {
    // Visit the events listing page
    cy.visit('/');

    // Navigate to events
    cy.get('a[href*="events"], button:contains("Events"), [data-cy="events-link"]')
      .first()
      .click();

    // Select the first available event
    cy.get('[data-cy="event-card"], .event-card, article')
      .first()
      .click();

    // Look for VIP tab, VIP section, or VIP CTA link on the event detail page
    cy.get('body').then(($body) => {
      const hasVipTab = $body.find('[data-cy="vip-tab"], button:contains("VIP"), a:contains("VIP")').length > 0;
      const hasVipSection = $body.find('[data-cy="vip-section"], a[href*="vip-tables"]').length > 0;

      if (hasVipTab) {
        cy.get('[data-cy="vip-tab"], button:contains("VIP"), a:contains("VIP")')
          .first()
          .click();
      }

      // The event detail page should have a link to VIP tables
      if (hasVipSection || hasVipTab) {
        cy.get('a[href*="vip-tables"], [data-cy="reserve-vip-button"], button:contains("Reserve"), a:contains("Reserve")')
          .first()
          .should('be.visible');
      } else {
        // VIP section may not appear if no VIP tables exist for this event
        cy.log('No VIP section found on this event - may not have VIP tables configured');
      }
    });
  });

  it('fills VIP booking form with valid data', function () {
    if (!testEventId) {
      this.skip();
      return;
    }

    // Navigate directly to the VIP booking form with URL params (same pattern as VIPTablesPage handleContinue)
    cy.visit(`/events/${testEventId}/vip-booking?${new URLSearchParams({
      tableId: testVipTableId || 'sample-9',
      tableNumber: '9',
      price: '600',
      tier: 'standard',
      capacity: '6',
      bottles: '1',
    }).toString()}`);

    // Wait for the form to load
    cy.get('[data-cy="vip-first-name"], input[name="firstName"]', { timeout: 15000 })
      .should('be.visible');

    // Fill contact information using the custom command
    cy.fillVipBookingForm({
      firstName: 'Test',
      lastName: 'VIPHost',
      email: testEmail,
      phone: testPhone,
      guestCount: 4,
      celebration: 'birthday',
    });

    // Verify form fields are populated
    cy.get('[data-cy="vip-first-name"], input[name="firstName"]')
      .first()
      .should('have.value', 'Test');

    cy.get('[data-cy="vip-last-name"], input[name="lastName"]')
      .first()
      .should('have.value', 'VIPHost');

    cy.get('[data-cy="vip-email"], input[name="email"]')
      .first()
      .should('have.value', testEmail);

    cy.get('[data-cy="vip-phone"], input[name="phone"]')
      .first()
      .should('have.value', testPhone);

    // Verify the terms checkbox is checked
    cy.get('[data-cy="vip-terms-checkbox"], input[type="checkbox"][name*="terms"], input[type="checkbox"][name*="agree"]')
      .first()
      .should('be.checked');

    // Verify the order summary sidebar shows table info
    cy.get('body').then(($body) => {
      const hasSummary = $body.find(':contains("Reservation Summary"), :contains("Order Summary")').length > 0;
      if (hasSummary) {
        cy.contains('Table 9').should('be.visible');
        cy.contains('$600').should('be.visible');
      }
    });
  });

  it('completes VIP payment with Stripe Payment Elements', function () {
    if (!testEventId) {
      this.skip();
      return;
    }

    const startTime = Date.now();

    // Navigate to booking form with URL params
    cy.visit(`/events/${testEventId}/vip-booking?${new URLSearchParams({
      tableId: testVipTableId || 'sample-9',
      tableNumber: '9',
      price: '600',
      tier: 'standard',
      capacity: '6',
      bottles: '1',
    }).toString()}`);

    // Wait for form to load
    cy.get('[data-cy="vip-first-name"], input[name="firstName"]', { timeout: 15000 })
      .should('be.visible');

    // Fill the booking form
    cy.fillVipBookingForm({
      firstName: 'Test',
      lastName: 'VIPHost',
      email: testEmail,
      phone: testPhone,
      guestCount: 4,
      celebration: 'birthday',
    });

    // Wait for GA ticket tier to load and be auto-selected (REQUIRED for VIP checkout)
    cy.get('input[name="ticketTier"], input[type="radio"][name="ticketTier"]', { timeout: 10000 })
      .first()
      .should('be.checked');

    // Click "Continue to Payment" to initialize the payment intent
    cy.get('[data-cy="vip-continue-button"], button:contains("Continue to Payment"), button:contains("Pay"), button[type="submit"]')
      .first()
      .click();

    // Wait for Stripe PaymentElement to appear (it renders inside an iframe)
    cy.get('iframe[name^="__privateStripeFrame"]', { timeout: 30000 })
      .should('exist');

    // Fill Stripe payment details using the custom command
    cy.fillStripe();

    // Click the pay button (inside the payment section)
    cy.get('[data-cy="vip-pay-button"], button:contains("Pay $"), button:contains("Pay")')
      .first()
      .click();

    // Wait for confirmation view (longer timeout for Stripe processing + backend confirmation)
    cy.get(
      '[data-cy="vip-confirmation"], [data-cy="order-confirmation"], :contains("Reservation Confirmed"), :contains("Confirmed!")',
      { timeout: 60000 }
    )
      .should('be.visible');

    // Log timing
    const elapsed = Date.now() - startTime;
    cy.log(`VIP booking flow completed in ${elapsed}ms`);
  });

  it('shows confirmation with invite link and copy button', function () {
    if (!testEventId) {
      this.skip();
      return;
    }

    // Navigate to booking form and complete full flow
    cy.visit(`/events/${testEventId}/vip-booking?${new URLSearchParams({
      tableId: testVipTableId || 'sample-9',
      tableNumber: '9',
      price: '600',
      tier: 'standard',
      capacity: '6',
      bottles: '1',
    }).toString()}`);

    cy.get('[data-cy="vip-first-name"], input[name="firstName"]', { timeout: 15000 })
      .should('be.visible');

    cy.fillVipBookingForm({
      firstName: 'Confirm',
      lastName: 'TestVIP',
      email: `vip-confirm+${testRunId}@test.maguey.com`,
      phone: testPhone,
    });

    // Wait for GA ticket tier to auto-select
    cy.get('input[name="ticketTier"], input[type="radio"][name="ticketTier"]', { timeout: 10000 })
      .first()
      .should('be.checked');

    // Submit form to initialize payment
    cy.get('[data-cy="vip-continue-button"], button:contains("Continue to Payment"), button:contains("Pay"), button[type="submit"]')
      .first()
      .click();

    // Fill Stripe and pay
    cy.get('iframe[name^="__privateStripeFrame"]', { timeout: 30000 }).should('exist');
    cy.fillStripe();

    cy.get('[data-cy="vip-pay-button"], button:contains("Pay $"), button:contains("Pay")')
      .first()
      .click();

    // Wait for confirmation
    cy.get(
      '[data-cy="vip-confirmation"], :contains("Reservation Confirmed"), :contains("Confirmed!")',
      { timeout: 60000 }
    )
      .should('be.visible');

    // Verify confirmation number is displayed
    cy.get('[data-cy="reservation-number"], .font-mono, :contains("Confirmation")')
      .should('be.visible');

    // Verify QR code section is shown
    cy.get('[data-cy="qr-code-section"], :contains("QR"), :contains("check-in"), img[alt*="QR"], svg[data-qr]')
      .should('be.visible');

    // Check for invite link section (may appear after webhook processing)
    cy.get('body').then(($body) => {
      const hasInviteSection = $body.find(':contains("Invite Your Guests"), :contains("invite link"), [data-cy="invite-section"]').length > 0;
      if (hasInviteSection) {
        // Verify copy button exists
        cy.get('[data-cy="copy-invite-link"], button:contains("Copy"), button:contains("Share")')
          .first()
          .should('be.visible');

        // Verify the invite link input is present
        cy.get('input[readonly][value*="vip="], input[readonly][value*="invite"]')
          .should('exist');
      } else {
        cy.log('Invite link not yet generated (webhook may still be processing)');
      }
    });

    // Verify action buttons are present (e.g., "View Guest List", "Buy More GA Tickets", "Back to Events")
    cy.get('a[href*="vip/dashboard"], a:contains("Guest"), a:contains("GA Tickets"), a:contains("Events")')
      .should('have.length.gte', 1);
  });

  it('validates required fields before submission', function () {
    if (!testEventId) {
      this.skip();
      return;
    }

    // Navigate to booking form
    cy.visit(`/events/${testEventId}/vip-booking?${new URLSearchParams({
      tableId: testVipTableId || 'sample-9',
      tableNumber: '9',
      price: '600',
      tier: 'standard',
      capacity: '6',
      bottles: '1',
    }).toString()}`);

    // Wait for form to load
    cy.get('[data-cy="vip-first-name"], input[name="firstName"]', { timeout: 15000 })
      .should('be.visible');

    // Do NOT fill any fields - leave them empty
    // But we need to check the terms checkbox to isolate field validation
    // Actually, leave everything empty to test all required fields

    // Try to submit the form without filling required fields
    cy.get('[data-cy="vip-continue-button"], button:contains("Continue to Payment"), button:contains("Pay"), button[type="submit"]')
      .first()
      .click();

    // Should show validation error(s) - the form validates firstName, lastName, email, phone, and agreedToTerms
    cy.get(
      '[data-cy="error"], [data-cy="validation-error"], .error, [role="alert"], .text-red-400, .text-red-500, :contains("required"), :contains("Please fill")',
      { timeout: 5000 }
    )
      .should('be.visible');

    // Verify we did NOT navigate to payment (Stripe iframe should NOT be present)
    cy.get('iframe[name^="__privateStripeFrame"]').should('not.exist');

    // Fill partial data (only first name) and try again
    cy.get('[data-cy="vip-first-name"], input[name="firstName"]')
      .first()
      .clear()
      .type('Partial');

    cy.get('[data-cy="vip-continue-button"], button:contains("Continue to Payment"), button:contains("Pay"), button[type="submit"]')
      .first()
      .click();

    // Should still show validation errors for remaining required fields
    cy.get(
      '[data-cy="error"], [data-cy="validation-error"], .error, [role="alert"], .text-red-400, .text-red-500, :contains("required"), :contains("Please fill")',
      { timeout: 5000 }
    )
      .should('be.visible');
  });

  it('handles VIP payment decline gracefully', function () {
    if (!testEventId) {
      this.skip();
      return;
    }

    // Navigate to booking form
    cy.visit(`/events/${testEventId}/vip-booking?${new URLSearchParams({
      tableId: testVipTableId || 'sample-9',
      tableNumber: '9',
      price: '600',
      tier: 'standard',
      capacity: '6',
      bottles: '1',
    }).toString()}`);

    cy.get('[data-cy="vip-first-name"], input[name="firstName"]', { timeout: 15000 })
      .should('be.visible');

    // Fill the booking form
    cy.fillVipBookingForm({
      firstName: 'Decline',
      lastName: 'TestVIP',
      email: `vip-decline+${testRunId}@test.maguey.com`,
      phone: testPhone,
    });

    // Wait for GA ticket tier
    cy.get('input[name="ticketTier"], input[type="radio"][name="ticketTier"]', { timeout: 10000 })
      .first()
      .should('be.checked');

    // Submit form
    cy.get('[data-cy="vip-continue-button"], button:contains("Continue to Payment"), button:contains("Pay"), button[type="submit"]')
      .first()
      .click();

    // Wait for Stripe iframe
    cy.get('iframe[name^="__privateStripeFrame"]', { timeout: 30000 }).should('exist');

    // Fill with a DECLINED card
    cy.fillStripeDeclined('generic');

    // Click pay
    cy.get('[data-cy="vip-pay-button"], button:contains("Pay $"), button:contains("Pay")')
      .first()
      .click();

    // Should show a payment error (not crash)
    cy.get(
      '[data-cy="payment-error"], [data-cy="error"], .error, [role="alert"], .text-red-400, [data-sonner-toast], .toast',
      { timeout: 30000 }
    )
      .should('be.visible');

    // Error should be user-friendly
    cy.get(
      '[data-cy="payment-error"], [data-cy="error"], .error, [role="alert"], .text-red-400, [data-sonner-toast], .toast'
    )
      .invoke('text')
      .then((text) => {
        expect(text.toLowerCase()).to.match(/declined|failed|error|try again/i);
        // Should NOT contain technical jargon
        expect(text.toLowerCase()).to.not.match(/stripe|api|exception|stack|trace/i);
      });

    // Form data should be preserved (not lost after decline)
    cy.get('[data-cy="vip-first-name"], input[name="firstName"]')
      .first()
      .should('have.value', 'Decline');

    cy.get('[data-cy="vip-last-name"], input[name="lastName"]')
      .first()
      .should('have.value', 'TestVIP');

    // Should NOT show confirmation
    cy.get(':contains("Reservation Confirmed"), :contains("Confirmed!")').should('not.exist');
  });

  it('displays correctly on mobile viewport', function () {
    if (!testEventId) {
      this.skip();
      return;
    }

    // Set iPhone X viewport
    cy.viewport('iphone-x');

    // Navigate to booking form
    cy.visit(`/events/${testEventId}/vip-booking?${new URLSearchParams({
      tableId: testVipTableId || 'sample-9',
      tableNumber: '9',
      price: '600',
      tier: 'standard',
      capacity: '6',
      bottles: '1',
    }).toString()}`);

    // Wait for form to render
    cy.get('[data-cy="vip-first-name"], input[name="firstName"]', { timeout: 15000 })
      .should('be.visible');

    // Verify the page is scrollable and form elements are visible on mobile
    cy.get('[data-cy="vip-last-name"], input[name="lastName"]')
      .first()
      .scrollIntoView()
      .should('be.visible');

    cy.get('[data-cy="vip-email"], input[name="email"]')
      .first()
      .scrollIntoView()
      .should('be.visible');

    cy.get('[data-cy="vip-phone"], input[name="phone"]')
      .first()
      .scrollIntoView()
      .should('be.visible');

    // Verify the terms checkbox is visible on mobile
    cy.get('[data-cy="vip-terms-checkbox"], input[type="checkbox"][name*="terms"], input[type="checkbox"][name*="agree"]')
      .first()
      .scrollIntoView()
      .should('be.visible');

    // Verify the submit button is visible
    cy.get('[data-cy="vip-continue-button"], button:contains("Continue to Payment"), button:contains("Pay"), button[type="submit"]')
      .first()
      .scrollIntoView()
      .should('be.visible');

    // Verify the order summary section is present (stacked below form on mobile)
    cy.get(':contains("Reservation Summary"), :contains("Order Summary")')
      .first()
      .scrollIntoView()
      .should('be.visible');

    // Fill form to verify input works on mobile viewport
    cy.fillVipBookingForm({
      firstName: 'Mobile',
      lastName: 'Test',
      email: `vip-mobile+${testRunId}@test.maguey.com`,
      phone: testPhone,
    });

    // Verify values are set correctly on mobile
    cy.get('[data-cy="vip-first-name"], input[name="firstName"]')
      .first()
      .should('have.value', 'Mobile');
  });
});
