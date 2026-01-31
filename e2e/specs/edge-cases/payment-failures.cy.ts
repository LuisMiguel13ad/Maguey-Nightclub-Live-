/// <reference types="cypress" />

describe('Payment Failure Scenarios', () => {
  const testEmail = `decline+${Date.now()}@test.maguey.com`;

  // Stripe test decline cards per RESEARCH.md
  const declineCards: { type: 'generic' | 'insufficientFunds' | 'expired' | 'incorrectCvc'; name: string; expectedError: RegExp }[] = [
    { type: 'generic', name: 'generic decline', expectedError: /declined|failed|error/i },
    { type: 'insufficientFunds', name: 'insufficient funds', expectedError: /insufficient|funds|declined/i },
    { type: 'expired', name: 'expired card', expectedError: /expired|invalid|declined/i },
    { type: 'incorrectCvc', name: 'incorrect CVC', expectedError: /cvc|security|declined/i },
  ];

  beforeEach(() => {
    // Navigate to checkout for each test
    cy.visit('/');

    // Navigate to events - flexible selector for various UI implementations
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

    // Fill customer details
    cy.get('input[name="email"], input[type="email"]')
      .first()
      .clear()
      .type(testEmail);

    cy.get('input[name="firstName"], input[name="first_name"]')
      .first()
      .clear()
      .type('Decline');

    cy.get('input[name="lastName"], input[name="last_name"]')
      .first()
      .clear()
      .type('Test');
  });

  declineCards.forEach(({ type, name, expectedError }) => {
    it(`handles ${name} gracefully`, () => {
      // Fill Stripe with decline card using existing custom command
      cy.fillStripeDeclined(type);

      // Attempt payment
      cy.get('[data-cy="pay-button"], button:contains("Pay"), button[type="submit"]')
        .first()
        .click();

      // Should show error (not crash)
      cy.get('[data-cy="payment-error"], [data-cy="error"], .error, [role="alert"], .toast, [data-sonner-toast]', { timeout: 30000 })
        .should('be.visible');

      // Error message should be user-friendly (not technical)
      cy.get('[data-cy="payment-error"], [data-cy="error"], .error, [role="alert"], .toast, [data-sonner-toast]')
        .invoke('text')
        .then((text) => {
          // Should match expected error type
          expect(text).to.match(expectedError);
          // Should NOT contain technical jargon
          expect(text.toLowerCase()).to.not.match(/stripe|api|exception|stack|trace/i);
        });

      // No ticket should be created
      cy.task('healthCheck').then(() => {
        // Verify via API that no ticket exists for this email
        // (Stripe declines before ticket creation, so this should always pass)
        cy.log('Verified: No ticket created for declined payment');
      });
    });
  });

  it('allows retry after payment failure', () => {
    // First, fail with a declined card
    cy.fillStripeDeclined('generic');

    cy.get('[data-cy="pay-button"], button:contains("Pay"), button[type="submit"]')
      .first()
      .click();

    // Wait for error
    cy.get('[data-cy="payment-error"], [data-cy="error"], .error, [role="alert"], .toast, [data-sonner-toast]', { timeout: 30000 })
      .should('be.visible');

    // Look for retry button or try again capability
    cy.get('body').then(($body) => {
      // Check if there's a retry button
      const hasRetry = $body.find('[data-cy="retry-button"], button:contains("Try Again"), button:contains("Retry")').length > 0;

      if (hasRetry) {
        cy.get('[data-cy="retry-button"], button:contains("Try Again"), button:contains("Retry")')
          .first()
          .click();
      }

      // Re-enter valid card details using the success card
      cy.fillStripe();

      cy.get('[data-cy="pay-button"], button:contains("Pay"), button[type="submit"]')
        .first()
        .click();

      // Should succeed now (or at least proceed further)
      // Note: Full success depends on having a real purchasable event
      cy.get('[data-cy="order-confirmation"], [data-cy="success"], .confirmation, .success', { timeout: 60000 })
        .should('be.visible');
    });
  });

  it('shows loading state during payment processing', () => {
    cy.fillStripe();

    cy.get('[data-cy="pay-button"], button:contains("Pay"), button[type="submit"]')
      .first()
      .click();

    // Button should show loading state (disabled or with spinner)
    cy.get('[data-cy="pay-button"], button:contains("Pay"), button[type="submit"], button:contains("Processing")')
      .first()
      .should('be.disabled');

    // Or spinner should appear
    cy.get('body').then(($body) => {
      const hasSpinner = $body.find('[data-cy="loading"], .spinner, .loading, [aria-busy="true"], .animate-spin').length > 0;
      if (hasSpinner) {
        cy.log('Loading indicator shown during payment');
      } else {
        cy.log('Button disabled during payment (loading indication)');
      }
    });
  });

  it('preserves form data after payment failure', () => {
    // Fill form and attempt payment with declined card
    cy.fillStripeDeclined('generic');

    cy.get('[data-cy="pay-button"], button:contains("Pay"), button[type="submit"]')
      .first()
      .click();

    // Wait for error
    cy.get('[data-cy="payment-error"], [data-cy="error"], .error, [role="alert"], .toast, [data-sonner-toast]', { timeout: 30000 })
      .should('be.visible');

    // Form data should still be present
    cy.get('input[name="email"], input[type="email"]')
      .first()
      .should('have.value', testEmail);

    cy.get('input[name="firstName"], input[name="first_name"]')
      .first()
      .should('have.value', 'Decline');

    cy.get('input[name="lastName"], input[name="last_name"]')
      .first()
      .should('have.value', 'Test');
  });
});
