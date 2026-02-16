/// <reference types="cypress" />

describe('Gate Scanner Flow', () => {
  const testRunId = Date.now().toString();
  let testTicket: { id: string; qr_code_token: string } | null = null;
  let testEventId: string | null = null;

  before(() => {
    // Get a test event
    cy.task('getTestEvent').then((event: any) => {
      expect(event).to.not.be.null;
      testEventId = event.id;

      // Create a test ticket for scanning
      cy.task('createTestTicket', testEventId).then((ticket: any) => {
        if (ticket) {
          testTicket = ticket;
          cy.log(`Created test ticket: ${ticket.qr_code_token}`);
        }
      });
    });
  });

  after(() => {
    cy.task('cleanupTestData', testRunId);
  });

  it('scans valid QR code at gate', function() {
    if (!testTicket) {
      this.skip(); // Skip if no test ticket was created
      return;
    }

    const scannerUrl = Cypress.env('SCANNER_URL');
    const scannerEmail = Cypress.env('SCANNER_EMAIL');
    const scannerPassword = Cypress.env('SCANNER_PASSWORD');

    // Navigate to scanner app (cross-origin)
    cy.origin(scannerUrl, { args: { scannerEmail, scannerPassword, qrToken: testTicket.qr_code_token } }, ({ scannerEmail, scannerPassword, qrToken }) => {
      // Login to scanner
      cy.visit('/auth');
      cy.get('input[type="email"], input[name="email"], [data-cy="email"]')
        .clear()
        .type(scannerEmail);
      cy.get('input[type="password"], input[name="password"], [data-cy="password"]')
        .clear()
        .type(scannerPassword);
      cy.get('button[type="submit"], [data-cy="login-button"]')
        .click();

      // Wait for redirect to scanner/dashboard
      cy.url().should('not.contain', '/auth', { timeout: 15000 });

      // Navigate to scanner page if not already there
      cy.visit('/scanner');

      // Wait for scanner to load
      cy.get('[data-cy="scanner-container"], .scanner, main', { timeout: 10000 })
        .should('be.visible');

      // Use manual ticket entry (simulates QR scan)
      // Look for manual entry toggle or input
      cy.get('body').then(($body) => {
        // Click manual entry toggle if present
        if ($body.find('[data-cy="manual-toggle"], button:contains("Manual")').length) {
          cy.get('[data-cy="manual-toggle"], button:contains("Manual")')
            .first()
            .click();
        }
      });

      // Enter ticket token
      cy.get('[data-cy="manual-entry"], input[placeholder*="ticket"], input[placeholder*="QR"], input[name="ticketId"], input[type="text"]')
        .first()
        .clear()
        .type(qrToken);

      // Submit lookup
      cy.get('[data-cy="lookup-button"], button:contains("Lookup"), button:contains("Check"), button:contains("Submit"), button[type="submit"]')
        .first()
        .click();

      // Wait for result
      cy.get('[data-cy="scan-result"], [data-cy="ticket-status"], .scan-result, .status', { timeout: 10000 })
        .should('be.visible');

      // Should show valid/success
      cy.get('[data-cy="scan-result"], [data-cy="ticket-status"], .scan-result')
        .invoke('text')
        .should('match', /valid|success|check.?in/i);

      // Click check-in button if present
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy="check-in-button"], button:contains("Check In"), button:contains("Admit")').length) {
          cy.get('[data-cy="check-in-button"], button:contains("Check In"), button:contains("Admit")')
            .first()
            .click();

          // Verify check-in success
          cy.get('[data-cy="success-message"], [data-cy="check-in-success"], .success', { timeout: 5000 })
            .should('be.visible');
        }
      });
    });

    // Verify ticket status in database
    cy.task('verifyTicketScanned', testTicket!.id).then((result: any) => {
      if (result.data) {
        expect(result.data.status).to.match(/checked_in|used|scanned/i);
        cy.log(`Ticket status: ${result.data.status}`);
      }
    });
  });

  it('shows already-used error on second scan', function() {
    if (!testTicket) {
      this.skip();
      return;
    }

    const scannerUrl = Cypress.env('SCANNER_URL');
    const scannerEmail = Cypress.env('SCANNER_EMAIL');
    const scannerPassword = Cypress.env('SCANNER_PASSWORD');

    // Try to scan the same ticket again
    cy.origin(scannerUrl, { args: { scannerEmail, scannerPassword, qrToken: testTicket.qr_code_token } }, ({ scannerEmail, scannerPassword, qrToken }) => {
      cy.visit('/auth');
      cy.get('input[type="email"], input[name="email"]')
        .clear()
        .type(scannerEmail);
      cy.get('input[type="password"], input[name="password"]')
        .clear()
        .type(scannerPassword);
      cy.get('button[type="submit"]')
        .click();

      cy.url().should('not.contain', '/auth', { timeout: 15000 });
      cy.visit('/scanner');

      // Manual entry
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy="manual-toggle"], button:contains("Manual")').length) {
          cy.get('[data-cy="manual-toggle"], button:contains("Manual")')
            .first()
            .click();
        }
      });

      cy.get('[data-cy="manual-entry"], input[placeholder*="ticket"], input[type="text"]')
        .first()
        .clear()
        .type(qrToken);

      cy.get('[data-cy="lookup-button"], button:contains("Lookup"), button:contains("Check"), button[type="submit"]')
        .first()
        .click();

      // Should show already used/error
      cy.get('[data-cy="scan-result"], [data-cy="error"], .scan-result, .error', { timeout: 10000 })
        .invoke('text')
        .should('match', /already|used|scanned|checked|error/i);
    });
  });
});

describe('Scanner Mobile Viewport', () => {
  it('works on mobile device size', () => {
    cy.viewport('iphone-x');

    const scannerUrl = Cypress.env('SCANNER_URL');
    const scannerEmail = Cypress.env('SCANNER_EMAIL');
    const scannerPassword = Cypress.env('SCANNER_PASSWORD');

    cy.origin(scannerUrl, { args: { scannerEmail, scannerPassword } }, ({ scannerEmail, scannerPassword }) => {
      cy.visit('/auth');
      cy.get('input[type="email"]')
        .clear()
        .type(scannerEmail);
      cy.get('input[type="password"]')
        .clear()
        .type(scannerPassword);
      cy.get('button[type="submit"]')
        .click();

      cy.url().should('not.contain', '/auth', { timeout: 15000 });
      cy.visit('/scanner');

      // Scanner should be usable on mobile
      cy.get('[data-cy="scanner-container"], .scanner, main')
        .should('be.visible');
    });
  });
});
