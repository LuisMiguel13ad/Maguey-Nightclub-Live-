/// <reference types="cypress" />

describe('VIP Guest Pass Scan Flow', () => {
  const testRunId = Date.now().toString();
  const testEmail = `vip+${testRunId}@test.maguey.com`;

  let testEvent: { id: string; name: string } | null = null;
  let testTable: { id: string; table_number: number; tier: string } | null = null;
  let testVipData: {
    reservation: {
      id: string;
      purchaser_name: string;
      table_number: number;
      qr_code_token: string;
    };
    passes: Array<{
      id: string;
      qr_token: string;
      pass_number: number;
      pass_type: string;
      status: string;
    }>;
  } | null = null;

  before(() => {
    // Get a published event for testing
    cy.task('getTestEvent').then((event: any) => {
      expect(event, 'A published event must exist for VIP scan tests').to.not.be.null;
      testEvent = event;

      // Create a VIP table for the event
      cy.task('createTestVipTable', event.id).then((table: any) => {
        expect(table, 'VIP table creation must succeed').to.not.be.null;
        testTable = table;

        // Create a VIP reservation with guest passes
        cy.task('createTestVipReservation', {
          eventId: event.id,
          tableId: table.id,
          email: testEmail,
        }).then((vipData: any) => {
          expect(vipData, 'VIP reservation creation must succeed').to.not.be.null;
          expect(vipData.passes.length).to.be.greaterThan(0);
          testVipData = vipData;
          cy.log(`Created VIP reservation: ${vipData.reservation.id}`);
          cy.log(`Guest passes created: ${vipData.passes.length}`);
          cy.log(`First pass qr_token: ${vipData.passes[0].qr_token}`);
        });
      });
    });
  });

  after(() => {
    // Clean up all VIP test data using the testRunId pattern
    cy.task('cleanupVipTestData', testRunId);
  });

  it('scans valid VIP guest pass QR code at gate', function () {
    if (!testVipData || !testEvent) {
      this.skip();
      return;
    }

    const scannerUrl = Cypress.env('SCANNER_URL');
    const scannerEmail = Cypress.env('SCANNER_EMAIL');
    const scannerPassword = Cypress.env('SCANNER_PASSWORD');
    const qrToken = testVipData.passes[0].qr_token;
    const eventId = testEvent.id;

    cy.origin(
      scannerUrl,
      { args: { scannerEmail, scannerPassword, qrToken, eventId } },
      ({ scannerEmail, scannerPassword, qrToken, eventId }) => {
        // Login to scanner app
        cy.visit('/auth');
        cy.get('input[type="email"], input[name="email"], [data-cy="email"]')
          .clear()
          .type(scannerEmail);
        cy.get('input[type="password"], input[name="password"], [data-cy="password"]')
          .clear()
          .type(scannerPassword);
        cy.get('button[type="submit"], [data-cy="login-button"]')
          .click();

        // Wait for auth redirect
        cy.url().should('not.contain', '/auth', { timeout: 15000 });

        // Navigate to VIP scanner with event and QR token via URL params
        cy.visit(`/scan/vip?event=${eventId}&qr=${encodeURIComponent(qrToken)}`);

        // Wait for scanner page to load
        cy.get('[data-cy="vip-scanner-container"], [data-cy="scanner-container"], .space-y-4, main', { timeout: 15000 })
          .should('be.visible');

        // Wait for scan result to appear (auto-processed via URL param in dev/test mode)
        cy.get('[data-cy="scan-result"], [data-cy="vip-result"], .rounded-3xl, [class*="bg-gradient-to-b"]', { timeout: 15000 })
          .should('be.visible');

        // Verify success: should show VIP ENTRY GRANTED or valid status
        cy.get('body')
          .invoke('text')
          .should('match', /vip.*entry.*granted|checked in successfully|re-entry granted|vip.*table.*guest/i);
      }
    );
  });

  it('allows VIP guest re-entry on second scan', function () {
    if (!testVipData || !testEvent) {
      this.skip();
      return;
    }

    const scannerUrl = Cypress.env('SCANNER_URL');
    const scannerEmail = Cypress.env('SCANNER_EMAIL');
    const scannerPassword = Cypress.env('SCANNER_PASSWORD');
    // Use the same pass that was already scanned in the previous test
    const qrToken = testVipData.passes[0].qr_token;
    const eventId = testEvent.id;

    cy.origin(
      scannerUrl,
      { args: { scannerEmail, scannerPassword, qrToken, eventId } },
      ({ scannerEmail, scannerPassword, qrToken, eventId }) => {
        // Login to scanner app
        cy.visit('/auth');
        cy.get('input[type="email"], input[name="email"], [data-cy="email"]')
          .clear()
          .type(scannerEmail);
        cy.get('input[type="password"], input[name="password"], [data-cy="password"]')
          .clear()
          .type(scannerPassword);
        cy.get('button[type="submit"], [data-cy="login-button"]')
          .click();

        cy.url().should('not.contain', '/auth', { timeout: 15000 });

        // Scan the same VIP pass again
        cy.visit(`/scan/vip?event=${eventId}&qr=${encodeURIComponent(qrToken)}`);

        cy.get('[data-cy="vip-scanner-container"], [data-cy="scanner-container"], .space-y-4, main', { timeout: 15000 })
          .should('be.visible');

        // Wait for scan result
        cy.get('[data-cy="scan-result"], [data-cy="vip-result"], .rounded-3xl, [class*="bg-gradient-to-b"]', { timeout: 15000 })
          .should('be.visible');

        // VIP guests CAN re-enter -- should show re-entry granted OR valid entry
        // Must NOT show "INVALID PASS" rejection (unlike GA tickets which reject second scans)
        cy.get('body')
          .invoke('text')
          .should('match', /re-entry granted|entry granted|checked in|already checked in/i);

        // Ensure it is NOT a hard rejection
        cy.get('body')
          .invoke('text')
          .should('not.match', /invalid pass|not found|counterfeit/i);
      }
    );
  });

  it('rejects invalid VIP guest pass', function () {
    if (!testEvent) {
      this.skip();
      return;
    }

    const scannerUrl = Cypress.env('SCANNER_URL');
    const scannerEmail = Cypress.env('SCANNER_EMAIL');
    const scannerPassword = Cypress.env('SCANNER_PASSWORD');
    const fakeToken = `FAKE-VIP-${Date.now()}-INVALID`;
    const eventId = testEvent.id;

    cy.origin(
      scannerUrl,
      { args: { scannerEmail, scannerPassword, fakeToken, eventId } },
      ({ scannerEmail, scannerPassword, fakeToken, eventId }) => {
        // Login to scanner app
        cy.visit('/auth');
        cy.get('input[type="email"], input[name="email"], [data-cy="email"]')
          .clear()
          .type(scannerEmail);
        cy.get('input[type="password"], input[name="password"], [data-cy="password"]')
          .clear()
          .type(scannerPassword);
        cy.get('button[type="submit"], [data-cy="login-button"]')
          .click();

        cy.url().should('not.contain', '/auth', { timeout: 15000 });

        // Navigate to VIP scanner with fake token
        cy.visit(`/scan/vip?event=${eventId}&qr=${encodeURIComponent(fakeToken)}`);

        cy.get('[data-cy="vip-scanner-container"], [data-cy="scanner-container"], .space-y-4, main', { timeout: 15000 })
          .should('be.visible');

        // Wait for scan result
        cy.get('[data-cy="scan-result"], [data-cy="vip-result"], .rounded-3xl, [class*="bg-gradient-to-b"]', { timeout: 15000 })
          .should('be.visible');

        // Should show rejection: INVALID PASS or error
        cy.get('body')
          .invoke('text')
          .should('match', /invalid|not found|error|counterfeit|security/i);
      }
    );
  });

  it('shows VIP reservation details on successful scan', function () {
    if (!testVipData || !testEvent) {
      this.skip();
      return;
    }

    const scannerUrl = Cypress.env('SCANNER_URL');
    const scannerEmail = Cypress.env('SCANNER_EMAIL');
    const scannerPassword = Cypress.env('SCANNER_PASSWORD');
    // Use a different guest pass (pass 2) so it hasn't been scanned yet
    const pass = testVipData.passes.length > 1 ? testVipData.passes[1] : testVipData.passes[0];
    const qrToken = pass.qr_token;
    const eventId = testEvent.id;
    const tableNumber = testVipData.reservation.table_number;
    const purchaserName = testVipData.reservation.purchaser_name;

    cy.origin(
      scannerUrl,
      { args: { scannerEmail, scannerPassword, qrToken, eventId, tableNumber, purchaserName } },
      ({ scannerEmail, scannerPassword, qrToken, eventId, tableNumber, purchaserName }) => {
        // Login to scanner app
        cy.visit('/auth');
        cy.get('input[type="email"], input[name="email"], [data-cy="email"]')
          .clear()
          .type(scannerEmail);
        cy.get('input[type="password"], input[name="password"], [data-cy="password"]')
          .clear()
          .type(scannerPassword);
        cy.get('button[type="submit"], [data-cy="login-button"]')
          .click();

        cy.url().should('not.contain', '/auth', { timeout: 15000 });

        // Navigate to VIP scanner with pass token
        cy.visit(`/scan/vip?event=${eventId}&qr=${encodeURIComponent(qrToken)}`);

        cy.get('[data-cy="vip-scanner-container"], [data-cy="scanner-container"], .space-y-4, main', { timeout: 15000 })
          .should('be.visible');

        // Wait for scan result with reservation details
        cy.get('[data-cy="scan-result"], [data-cy="vip-result"], .rounded-3xl, [class*="bg-gradient-to-b"]', { timeout: 15000 })
          .should('be.visible');

        // Verify VIP TABLE GUEST banner is shown
        cy.get('body')
          .invoke('text')
          .should('match', /vip.*table.*guest|vip.*linked.*guest/i);

        // Verify tier label is displayed (STANDARD, PREMIUM, or REGULAR)
        cy.get('body')
          .invoke('text')
          .should('match', /standard|premium|regular/i);

        // Verify purchaser name is displayed ("Reserved By" section)
        cy.get('body')
          .invoke('text')
          .should('include', purchaserName);

        // Verify "Scan Next Pass" or "Try Again" button is present
        cy.get('button')
          .filter(':visible')
          .invoke('text')
          .should('match', /scan next|try again/i);
      }
    );
  });

  it('works on mobile device viewport', function () {
    if (!testVipData || !testEvent) {
      this.skip();
      return;
    }

    cy.viewport('iphone-x');

    const scannerUrl = Cypress.env('SCANNER_URL');
    const scannerEmail = Cypress.env('SCANNER_EMAIL');
    const scannerPassword = Cypress.env('SCANNER_PASSWORD');
    // Use a different pass (pass 3) or reuse pass 1 (re-entry is allowed)
    const pass = testVipData.passes.length > 2 ? testVipData.passes[2] : testVipData.passes[0];
    const qrToken = pass.qr_token;
    const eventId = testEvent.id;

    cy.origin(
      scannerUrl,
      { args: { scannerEmail, scannerPassword, qrToken, eventId } },
      ({ scannerEmail, scannerPassword, qrToken, eventId }) => {
        // Set mobile viewport inside origin block as well
        cy.viewport('iphone-x');

        // Login to scanner app
        cy.visit('/auth');
        cy.get('input[type="email"], input[name="email"], [data-cy="email"]')
          .clear()
          .type(scannerEmail);
        cy.get('input[type="password"], input[name="password"], [data-cy="password"]')
          .clear()
          .type(scannerPassword);
        cy.get('button[type="submit"], [data-cy="login-button"]')
          .click();

        cy.url().should('not.contain', '/auth', { timeout: 15000 });

        // Navigate to VIP scanner
        cy.visit(`/scan/vip?event=${eventId}&qr=${encodeURIComponent(qrToken)}`);

        // VIP scanner page should be visible and usable on mobile
        cy.get('[data-cy="vip-scanner-container"], [data-cy="scanner-container"], .space-y-4, main', { timeout: 15000 })
          .should('be.visible');

        // Wait for scan result
        cy.get('[data-cy="scan-result"], [data-cy="vip-result"], .rounded-3xl, [class*="bg-gradient-to-b"]', { timeout: 15000 })
          .should('be.visible');

        // Result should be fully visible on mobile (not overflowing)
        cy.get('.rounded-3xl, [data-cy="vip-result"]')
          .first()
          .should('be.visible')
          .then(($el) => {
            const rect = $el[0].getBoundingClientRect();
            // Element should be within viewport width (375px for iPhone X)
            expect(rect.left).to.be.greaterThan(-1);
            expect(rect.right).to.be.lessThan(376);
          });

        // Verify the "Scan Next Pass" or "Try Again" button is accessible on mobile
        cy.get('button')
          .filter(':visible')
          .contains(/scan next|try again/i)
          .should('be.visible')
          .and('not.be.disabled');
      }
    );
  });
});
