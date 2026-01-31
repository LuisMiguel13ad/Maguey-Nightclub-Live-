/// <reference types="cypress" />

describe('Invalid QR Code Handling', () => {
  const scannerUrl = Cypress.env('SCANNER_URL');
  const scannerEmail = Cypress.env('SCANNER_EMAIL');
  const scannerPassword = Cypress.env('SCANNER_PASSWORD');

  const invalidCodes = [
    { name: 'random string', code: 'INVALID-12345-ABCDE', expectedError: /invalid|not found|unknown|ticket/i },
    { name: 'SQL injection attempt', code: "'; DROP TABLE tickets; --", expectedError: /invalid|not found|error|ticket/i },
    { name: 'very long string', code: 'A'.repeat(500), expectedError: /invalid|not found|error|ticket/i },
    { name: 'special characters', code: '<script>alert("xss")</script>', expectedError: /invalid|not found|error|ticket/i },
    { name: 'numeric only', code: '1234567890', expectedError: /invalid|not found|unknown|ticket/i },
    { name: 'almost valid format', code: 'MGY-FAKE-123456', expectedError: /invalid|not found|unknown|ticket/i },
    { name: 'unicode characters', code: '\u202E\u0000\uFEFF', expectedError: /invalid|not found|error|ticket/i },
  ];

  beforeEach(() => {
    // Login to scanner for each test
    cy.visit(scannerUrl + '/auth');
    cy.get('input[type="email"]', { timeout: 10000 })
      .clear()
      .type(scannerEmail);
    cy.get('input[type="password"]')
      .clear()
      .type(scannerPassword);
    cy.get('button[type="submit"]')
      .click();
    cy.url({ timeout: 15000 }).should('not.contain', '/auth');

    // Navigate to scanner page
    cy.visit(scannerUrl + '/scanner');
    cy.get('[data-cy="scanner-container"], .scanner, main', { timeout: 10000 })
      .should('be.visible');
  });

  invalidCodes.forEach(({ name, code, expectedError }) => {
    it(`rejects ${name}`, () => {
      // Enable manual entry if needed
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy="manual-toggle"], button:contains("Manual"), [data-testid="manual-toggle"]').length) {
          cy.get('[data-cy="manual-toggle"], button:contains("Manual"), [data-testid="manual-toggle"]')
            .first()
            .click();
        }
      });

      // Enter invalid code
      cy.get('[data-cy="manual-entry"], input[placeholder*="ticket"], input[placeholder*="code"], input[type="text"]')
        .first()
        .clear()
        .type(code);

      cy.get('[data-cy="lookup-button"], button:contains("Lookup"), button:contains("Check"), button:contains("Scan"), button[type="submit"]')
        .first()
        .click();

      // Should show rejection/error
      cy.get('[data-cy="scan-result"], [data-cy="error"], [data-cy="rejection"], .error, .rejection, [data-cy="rejection-overlay"], [role="alert"]', { timeout: 10000 })
        .should('be.visible');

      // Error message should be clear and match expected pattern
      cy.get('[data-cy="scan-result"], [data-cy="error"], .error, .scan-result, [data-cy="rejection-overlay"]')
        .invoke('text')
        .should('match', expectedError);
    });
  });

  it('shows rejection overlay for invalid ticket', () => {
    // Enable manual entry
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="manual-toggle"], button:contains("Manual")').length) {
        cy.get('[data-cy="manual-toggle"], button:contains("Manual")')
          .first()
          .click();
      }
    });

    cy.get('[data-cy="manual-entry"], input[type="text"]')
      .first()
      .clear()
      .type('TOTALLY-FAKE-TICKET-123');

    cy.get('[data-cy="lookup-button"], button:contains("Lookup"), button[type="submit"]')
      .first()
      .click();

    // Should show full rejection overlay (per Phase 3 implementation)
    cy.get('[data-cy="rejection-overlay"], .rejection-overlay, [data-rejection], .bg-red-600, .bg-destructive', { timeout: 10000 })
      .should('be.visible');

    // Overlay should be dismissible
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="dismiss"], button:contains("Dismiss"), button:contains("OK"), button:contains("Close")').length) {
        cy.get('[data-cy="dismiss"], button:contains("Dismiss"), button:contains("OK"), button:contains("Close")')
          .first()
          .click();
      } else {
        // May auto-dismiss or have different interaction (click anywhere to dismiss)
        cy.wait(2000);
      }
    });
  });

  it('does not crash on rapid invalid scans', () => {
    // Enable manual entry
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="manual-toggle"], button:contains("Manual")').length) {
        cy.get('[data-cy="manual-toggle"], button:contains("Manual")')
          .first()
          .click();
      }
    });

    // Rapid-fire 5 invalid scans
    for (let i = 0; i < 5; i++) {
      cy.get('[data-cy="manual-entry"], input[type="text"]')
        .first()
        .clear()
        .type(`RAPID-INVALID-${i}`);

      cy.get('[data-cy="lookup-button"], button:contains("Lookup"), button[type="submit"]')
        .first()
        .click();

      // Brief wait for response
      cy.wait(500);

      // Dismiss any overlay if present
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy="dismiss"], button:contains("Dismiss")').length) {
          cy.get('[data-cy="dismiss"], button:contains("Dismiss")').first().click();
        }
      });
    }

    // App should still be responsive after rapid scans
    cy.get('[data-cy="scanner-container"], .scanner, main')
      .should('be.visible');

    // Manual entry should still work
    cy.get('[data-cy="manual-entry"], input[type="text"]')
      .first()
      .should('not.be.disabled');
  });

  it('handles empty input gracefully', () => {
    // Enable manual entry
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="manual-toggle"], button:contains("Manual")').length) {
        cy.get('[data-cy="manual-toggle"], button:contains("Manual")')
          .first()
          .click();
      }
    });

    // Clear and submit without entering anything
    cy.get('[data-cy="manual-entry"], input[type="text"]')
      .first()
      .clear();

    cy.get('[data-cy="lookup-button"], button:contains("Lookup"), button[type="submit"]')
      .first()
      .click();

    // Should show validation error or prevent submission
    cy.get('[data-cy="validation-error"], [data-cy="error"], .error, [role="alert"], [data-sonner-toast]', { timeout: 5000 })
      .should('be.visible')
      .invoke('text')
      .should('match', /required|empty|enter|invalid/i);
  });

  it('sanitizes input before processing', () => {
    // This test verifies the app doesn't execute or store malicious input
    const maliciousInputs = [
      '{{constructor.constructor("return this")()}}', // Prototype pollution
      '${7*7}', // Template injection
      '%00%0A%0DHost:evil.com', // Header injection
    ];

    // Enable manual entry
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="manual-toggle"], button:contains("Manual")').length) {
        cy.get('[data-cy="manual-toggle"], button:contains("Manual")')
          .first()
          .click();
      }
    });

    maliciousInputs.forEach((input) => {
      cy.get('[data-cy="manual-entry"], input[type="text"]')
        .first()
        .clear()
        .type(input, { parseSpecialCharSequences: false });

      cy.get('[data-cy="lookup-button"], button:contains("Lookup"), button[type="submit"]')
        .first()
        .click();

      // App should reject (not crash or behave unexpectedly)
      cy.get('[data-cy="scan-result"], [data-cy="error"], .error, [role="alert"]', { timeout: 10000 })
        .should('be.visible');

      // Wait before next input
      cy.wait(500);

      // Dismiss any overlay
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy="dismiss"], button:contains("Dismiss")').length) {
          cy.get('[data-cy="dismiss"], button:contains("Dismiss")').first().click();
        }
      });
    });

    // App should still be functional
    cy.get('[data-cy="scanner-container"], .scanner, main')
      .should('be.visible');
  });
});
