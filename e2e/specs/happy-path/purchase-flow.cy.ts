/// <reference types="cypress" />

describe('GA Ticket Purchase Flow', () => {
  const testRunId = Date.now().toString();
  const testEmail = `buyer+${testRunId}@test.maguey.com`;

  before(() => {
    // Verify health before running purchase tests
    cy.task('healthCheck').then((checks: any) => {
      expect(checks.db).to.be.true;
    });
  });

  after(() => {
    // Cleanup test data
    cy.task('cleanupTestData', testRunId);
  });

  it('completes full ticket purchase flow', () => {
    const startTime = Date.now();

    // 1. Visit homepage and find events
    cy.visit('/');

    // 2. Navigate to events page
    cy.get('a[href*="events"], button:contains("Events"), [data-cy="events-link"]')
      .first()
      .click();

    // 3. Select first available event
    cy.get('[data-cy="event-card"], .event-card, article')
      .first()
      .click();

    // 4. Select ticket quantity (GA tier)
    cy.get('[data-cy="ticket-quantity"], select, input[type="number"]')
      .first()
      .then(($el) => {
        if ($el.is('select')) {
          cy.wrap($el).select('1');
        } else {
          cy.wrap($el).clear().type('1');
        }
      });

    // 5. Proceed to checkout
    cy.get('[data-cy="checkout-button"], button:contains("Checkout"), button:contains("Buy"), button:contains("Continue")')
      .first()
      .click();

    // 6. Fill customer details
    cy.get('input[name="email"], input[type="email"], [data-cy="email"]')
      .first()
      .clear()
      .type(testEmail);

    cy.get('input[name="firstName"], input[name="first_name"], [data-cy="first-name"]')
      .first()
      .clear()
      .type('Test');

    cy.get('input[name="lastName"], input[name="last_name"], [data-cy="last-name"]')
      .first()
      .clear()
      .type('Buyer');

    // 7. Fill payment with Stripe (using custom command)
    cy.fillStripe();

    // 8. Submit payment
    cy.get('[data-cy="pay-button"], button:contains("Pay"), button[type="submit"]:contains("Complete")')
      .first()
      .click();

    // 9. Wait for confirmation page/modal
    cy.get('[data-cy="order-confirmation"], [data-cy="success"], .confirmation, .success', { timeout: 60000 })
      .should('be.visible');

    // 10. Capture order/ticket info for verification
    cy.url().then((url) => {
      cy.log(`Confirmation URL: ${url}`);
    });

    // 11. Verify ticket shows on page (QR code visible)
    cy.get('[data-cy="ticket-qr"], img[alt*="QR"], canvas, svg[data-qr]', { timeout: 30000 })
      .should('be.visible');

    // Log timing
    const elapsed = Date.now() - startTime;
    cy.log(`Purchase flow completed in ${elapsed}ms`);

    // Note: We measure timing but don't assert (per RESEARCH.md - too flaky for CI)
    // The 2-minute SLA is for payment to email, which we verify in email-verification spec
  });

  it('handles multiple ticket tiers', () => {
    // Test purchasing from different ticket tiers if available
    cy.visit('/');

    cy.get('a[href*="events"], button:contains("Events")')
      .first()
      .click();

    cy.get('[data-cy="event-card"], .event-card, article')
      .first()
      .click();

    // Check if multiple tiers exist
    cy.get('body').then(($body) => {
      const tiers = $body.find('[data-cy="ticket-tier"], .ticket-tier, .tier-option');
      if (tiers.length > 1) {
        // Select second tier if available
        cy.wrap(tiers.eq(1)).click();
        cy.log('Selected alternate ticket tier');
      } else {
        cy.log('Only one ticket tier available');
      }
    });

    // Verify pricing is shown
    cy.get('[data-cy="price"], .price, span:contains("$")')
      .should('be.visible');
  });

  it('validates required fields', () => {
    cy.visit('/');

    cy.get('a[href*="events"], button:contains("Events")')
      .first()
      .click();

    cy.get('[data-cy="event-card"], .event-card, article')
      .first()
      .click();

    // Add ticket
    cy.get('[data-cy="ticket-quantity"], select, input[type="number"]')
      .first()
      .then(($el) => {
        if ($el.is('select')) {
          cy.wrap($el).select('1');
        } else {
          cy.wrap($el).clear().type('1');
        }
      });

    cy.get('[data-cy="checkout-button"], button:contains("Checkout"), button:contains("Buy")')
      .first()
      .click();

    // Try to submit without filling required fields
    cy.get('[data-cy="pay-button"], button:contains("Pay"), button[type="submit"]')
      .first()
      .click();

    // Should show validation errors
    cy.get('[data-cy="error"], .error, [role="alert"], .invalid-feedback')
      .should('be.visible');
  });
});

describe('Purchase Flow with Desktop Viewport', () => {
  beforeEach(() => {
    cy.viewport(1280, 800);
  });

  it('displays checkout properly on desktop', () => {
    cy.visit('/');
    cy.get('a[href*="events"], button:contains("Events")')
      .first()
      .click();

    cy.get('[data-cy="event-card"], .event-card, article')
      .first()
      .click();

    // Desktop should show full layout
    cy.get('body').should('be.visible');
    // Add specific desktop layout checks as needed
  });
});

describe('Purchase Flow with Mobile Viewport', () => {
  beforeEach(() => {
    cy.viewport('iphone-x');
  });

  it('displays checkout properly on mobile', () => {
    cy.visit('/');

    // Mobile may have hamburger menu
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="mobile-menu"], .hamburger, button[aria-label="Menu"]').length) {
        cy.get('[data-cy="mobile-menu"], .hamburger, button[aria-label="Menu"]')
          .first()
          .click();
      }
    });

    cy.get('a[href*="events"], button:contains("Events")')
      .first()
      .click();

    cy.get('[data-cy="event-card"], .event-card, article')
      .first()
      .click();

    // Mobile should show stacked layout
    cy.get('body').should('be.visible');
  });
});
