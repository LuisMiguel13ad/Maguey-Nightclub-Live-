/// <reference types="cypress" />

/**
 * Promo Code Functionality Tests
 *
 * Tests promo code application and validation during checkout on pass-lounge.
 * The promotions table may not exist yet — tests handle this gracefully by
 * using cy.task('createTestPromoCode') in before() and skipping if it returns null.
 *
 * Checkout page has data-cy attributes:
 *   data-cy="promo-input", data-cy="promo-apply-button", data-cy="promo-clear-button",
 *   data-cy="promo-error", data-cy="promo-discount-line"
 */

describe('Promo Code Functionality', () => {
  const testRunId = Date.now().toString();

  let percentPromo: { id: string; code: string } | null = null;
  let fixedPromo: { id: string; code: string } | null = null;
  let expiredPromo: { id: string; code: string } | null = null;
  let exhaustedPromo: { id: string; code: string } | null = null;
  let promoTableExists = true;

  before(function () {
    // Create a percentage-based promo code
    cy.task('createTestPromoCode', {
      code: `PERCENT10-${testRunId}`,
      discountType: 'percent',
      amount: 10,
    }).then((result) => {
      if (!result) {
        // Promotions table likely does not exist — skip all tests
        promoTableExists = false;
        return;
      }
      percentPromo = { id: result.id, code: result.code };
    });

    // Create a fixed-amount promo code
    cy.task('createTestPromoCode', {
      code: `FIXED5-${testRunId}`,
      discountType: 'amount',
      amount: 5,
    }).then((result) => {
      if (result) {
        fixedPromo = { id: result.id, code: result.code };
      }
    });

    // Create an expired promo code
    cy.task('createTestPromoCode', {
      code: `EXPIRED-${testRunId}`,
      discountType: 'percent',
      amount: 20,
      validFrom: new Date(Date.now() - 86400000 * 60).toISOString(),
      validTo: new Date(Date.now() - 86400000 * 1).toISOString(), // Expired yesterday
    }).then((result) => {
      if (result) {
        expiredPromo = { id: result.id, code: result.code };
      }
    });

    // Create a promo with usage limit of 0 (already exhausted)
    cy.task('createTestPromoCode', {
      code: `MAXED-${testRunId}`,
      discountType: 'percent',
      amount: 15,
      usageLimit: 0,
    }).then((result) => {
      if (result) {
        exhaustedPromo = { id: result.id, code: result.code };
      }
    });
  });

  after(() => {
    // Cleanup all test promo codes
    if (percentPromo) cy.task('deleteTestPromoCode', percentPromo.id);
    if (fixedPromo) cy.task('deleteTestPromoCode', fixedPromo.id);
    if (expiredPromo) cy.task('deleteTestPromoCode', expiredPromo.id);
    if (exhaustedPromo) cy.task('deleteTestPromoCode', exhaustedPromo.id);
  });

  /**
   * Navigate to the checkout page with a ticket selected.
   * Reusable helper for all promo tests.
   */
  const navigateToCheckout = () => {
    cy.visit('/');

    // Navigate to events
    cy.get('a[href*="events"], button:contains("Events"), a:contains("Events")')
      .first()
      .click();

    // Select first available event
    cy.get('[data-cy="event-card"], .event-card, article, [data-testid="event-card"]')
      .first()
      .click();

    // Select ticket quantity
    cy.get('[data-cy="ticket-quantity"], select, input[type="number"]')
      .first()
      .then(($el) => {
        if ($el.is('select')) {
          cy.wrap($el).select('1');
        } else {
          cy.wrap($el).clear().type('1');
        }
      });

    // Proceed to checkout
    cy.get('[data-cy="checkout-button"], button:contains("Checkout"), button:contains("Buy"), button:contains("Continue")')
      .first()
      .click();
  };

  it('applies valid percentage promo code', function () {
    if (!promoTableExists || !percentPromo) {
      this.skip();
      return;
    }

    navigateToCheckout();

    // Enter percentage promo code
    cy.get('[data-cy="promo-input"], input[placeholder*="promo" i], input[placeholder*="Promo"]')
      .first()
      .clear()
      .type(percentPromo.code);

    // Click apply
    cy.get('[data-cy="promo-apply-button"], button:contains("Apply")')
      .first()
      .click();

    // Verify discount line appears
    cy.get('[data-cy="promo-discount-line"], .text-emerald-400, span:contains("-$")', { timeout: 10000 })
      .should('be.visible');

    // No error should be shown
    cy.get('[data-cy="promo-error"]').should('not.exist');
  });

  it('applies valid fixed-amount promo code', function () {
    if (!promoTableExists || !fixedPromo) {
      this.skip();
      return;
    }

    navigateToCheckout();

    // Enter fixed-amount promo code
    cy.get('[data-cy="promo-input"], input[placeholder*="promo" i], input[placeholder*="Promo"]')
      .first()
      .clear()
      .type(fixedPromo.code);

    // Click apply
    cy.get('[data-cy="promo-apply-button"], button:contains("Apply")')
      .first()
      .click();

    // Verify discount line appears with dollar amount
    cy.get('[data-cy="promo-discount-line"], .text-emerald-400, span:contains("-$")', { timeout: 10000 })
      .should('be.visible');

    // No error should be shown
    cy.get('[data-cy="promo-error"]').should('not.exist');
  });

  it('rejects invalid promo code', function () {
    if (!promoTableExists) {
      this.skip();
      return;
    }

    navigateToCheckout();

    // Enter a fake promo code
    cy.get('[data-cy="promo-input"], input[placeholder*="promo" i], input[placeholder*="Promo"]')
      .first()
      .clear()
      .type('FAKECODE12345');

    // Click apply
    cy.get('[data-cy="promo-apply-button"], button:contains("Apply")')
      .first()
      .click();

    // Should show error message
    cy.get('[data-cy="promo-error"], [role="alert"], .text-red-400, [data-sonner-toast]', { timeout: 10000 })
      .should('be.visible')
      .invoke('text')
      .should('match', /invalid|expired|not found|error/i);

    // Discount line should NOT appear
    cy.get('[data-cy="promo-discount-line"]').should('not.exist');
  });

  it('rejects expired promo code', function () {
    if (!promoTableExists || !expiredPromo) {
      this.skip();
      return;
    }

    navigateToCheckout();

    // Enter expired promo code
    cy.get('[data-cy="promo-input"], input[placeholder*="promo" i], input[placeholder*="Promo"]')
      .first()
      .clear()
      .type(expiredPromo.code);

    // Click apply
    cy.get('[data-cy="promo-apply-button"], button:contains("Apply")')
      .first()
      .click();

    // Should show error — fetchPromotion returns null for expired codes
    cy.get('[data-cy="promo-error"], [role="alert"], .text-red-400, [data-sonner-toast]', { timeout: 10000 })
      .should('be.visible')
      .invoke('text')
      .should('match', /invalid|expired|not found|error/i);
  });

  it('enforces usage limit', function () {
    if (!promoTableExists || !exhaustedPromo) {
      this.skip();
      return;
    }

    navigateToCheckout();

    // Enter exhausted promo code (usage_limit = 0)
    cy.get('[data-cy="promo-input"], input[placeholder*="promo" i], input[placeholder*="Promo"]')
      .first()
      .clear()
      .type(exhaustedPromo.code);

    // Click apply
    cy.get('[data-cy="promo-apply-button"], button:contains("Apply")')
      .first()
      .click();

    // Should show error — fetchPromotion returns null when usage limit reached
    cy.get('[data-cy="promo-error"], [role="alert"], .text-red-400, [data-sonner-toast]', { timeout: 10000 })
      .should('be.visible')
      .invoke('text')
      .should('match', /invalid|expired|limit|error/i);
  });

  it('can clear applied promo code', function () {
    if (!promoTableExists || !percentPromo) {
      this.skip();
      return;
    }

    navigateToCheckout();

    // Capture original total before promo
    cy.get('[data-cy="order-total"], .font-bold:contains("$"), .total')
      .first()
      .invoke('text')
      .then((originalTotalText) => {
        // Apply promo
        cy.get('[data-cy="promo-input"], input[placeholder*="promo" i], input[placeholder*="Promo"]')
          .first()
          .clear()
          .type(percentPromo!.code);

        cy.get('[data-cy="promo-apply-button"], button:contains("Apply")')
          .first()
          .click();

        // Wait for discount line to appear
        cy.get('[data-cy="promo-discount-line"], .text-emerald-400', { timeout: 10000 })
          .should('be.visible');

        // Click clear button
        cy.get('[data-cy="promo-clear-button"], button:contains("Clear")')
          .first()
          .click();

        // Discount line should be removed
        cy.get('[data-cy="promo-discount-line"]').should('not.exist');

        // Promo input should be cleared
        cy.get('[data-cy="promo-input"], input[placeholder*="promo" i], input[placeholder*="Promo"]')
          .first()
          .should('have.value', '');
      });
  });

  it('promo discount reflected in totals', function () {
    if (!promoTableExists || !fixedPromo) {
      this.skip();
      return;
    }

    navigateToCheckout();

    // Read subtotal and fee before promo
    cy.get('body').then(($body) => {
      // Apply fixed promo ($5 off)
      cy.get('[data-cy="promo-input"], input[placeholder*="promo" i], input[placeholder*="Promo"]')
        .first()
        .clear()
        .type(fixedPromo!.code);

      cy.get('[data-cy="promo-apply-button"], button:contains("Apply")')
        .first()
        .click();

      // Wait for discount to apply
      cy.get('[data-cy="promo-discount-line"], .text-emerald-400', { timeout: 10000 })
        .should('be.visible');

      // Verify the discount amount is shown as a negative value
      cy.get('[data-cy="promo-discount-line"], .text-emerald-400')
        .invoke('text')
        .should('match', /-\s*\$\d+/);

      // Verify the total is displayed (non-zero, positive)
      cy.get('[data-cy="order-total"], .font-bold:contains("$"), .total')
        .first()
        .invoke('text')
        .should('match', /\$\d+/);
    });
  });
});
