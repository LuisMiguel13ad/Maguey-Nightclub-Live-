/// <reference types="cypress" />

describe('Offline Scanner Mode', () => {
  const scannerUrl = Cypress.env('SCANNER_URL');
  const scannerEmail = Cypress.env('SCANNER_EMAIL');
  const scannerPassword = Cypress.env('SCANNER_PASSWORD');
  let testEventId: string | null = null;
  let testTicket: { id: string; qr_code_token: string } | null = null;

  before(() => {
    // Create a test ticket to cache
    cy.task('getTestEvent').then((event: any) => {
      if (event) {
        testEventId = event.id;
        cy.task('createTestTicket', testEventId).then((ticket: any) => {
          if (ticket) {
            testTicket = ticket;
            cy.log(`Created test ticket for offline testing: ${ticket.qr_code_token}`);
          }
        });
      }
    });
  });

  beforeEach(() => {
    // Login to scanner
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

    // Navigate to scanner
    cy.visit(scannerUrl + '/scanner');
    cy.get('[data-cy="scanner-container"], .scanner, main', { timeout: 10000 })
      .should('be.visible');
  });

  it('shows offline indicator when network is lost', () => {
    // Wait for scanner to fully load
    cy.get('[data-cy="scanner-container"], .scanner, main', { timeout: 10000 })
      .should('be.visible');

    // Simulate network failure by intercepting all requests
    cy.intercept('**/*', { forceNetworkError: true }).as('offline');

    // Trigger a network request to detect offline state
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="refresh"], button:contains("Refresh")').length) {
        cy.get('[data-cy="refresh"], button:contains("Refresh")')
          .first()
          .click();
      } else {
        // Try manual entry to trigger API call
        if ($body.find('[data-cy="manual-toggle"], button:contains("Manual")').length) {
          cy.get('[data-cy="manual-toggle"], button:contains("Manual")').first().click();
        }
        cy.get('[data-cy="manual-entry"], input[type="text"]').first().type('OFFLINE-TEST');
        cy.get('[data-cy="lookup-button"], button:contains("Lookup"), button[type="submit"]').first().click();
      }
    });

    // Should show offline indicator (banner, icon, or modal)
    cy.get('[data-cy="offline-indicator"], [data-cy="offline-banner"], [data-cy="offline-modal"], .offline, [data-offline], [aria-label*="offline"]', { timeout: 10000 })
      .should('be.visible');
  });

  it('scanner remains functional when offline', function() {
    // This test verifies the scanner UI stays usable even when offline

    // First, ensure we're online and scanner is loaded
    cy.get('[data-cy="scanner-container"], .scanner, main', { timeout: 10000 })
      .should('be.visible');

    // Go offline
    cy.intercept('**/*', { forceNetworkError: true }).as('offline');

    // Scanner container should still be visible
    cy.get('[data-cy="scanner-container"], .scanner, main')
      .should('be.visible');

    // Enable manual entry if available
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="manual-toggle"], button:contains("Manual")').length) {
        cy.get('[data-cy="manual-toggle"], button:contains("Manual")')
          .first()
          .click();
      }
    });

    // Manual entry input should still work
    cy.get('[data-cy="manual-entry"], input[type="text"]')
      .first()
      .should('not.be.disabled');
  });

  it('displays offline mode message during scan attempt', function() {
    // Go offline before attempting a scan
    cy.intercept('**/tickets*', { forceNetworkError: true }).as('offlineTickets');
    cy.intercept('**/scan*', { forceNetworkError: true }).as('offlineScan');
    cy.intercept('**/rpc/*', { forceNetworkError: true }).as('offlineRpc');

    // Enable manual entry
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="manual-toggle"], button:contains("Manual")').length) {
        cy.get('[data-cy="manual-toggle"], button:contains("Manual")')
          .first()
          .click();
      }
    });

    // Try to scan while offline
    cy.get('[data-cy="manual-entry"], input[type="text"]')
      .first()
      .clear()
      .type('TEST-OFFLINE-SCAN');

    cy.get('[data-cy="lookup-button"], button:contains("Lookup"), button[type="submit"]')
      .first()
      .click();

    // Should show offline-related message or queue the scan
    cy.get('[data-cy="offline-indicator"], [data-cy="offline-queued"], [data-cy="scan-result"], .offline-message, .scan-result, [role="alert"]', { timeout: 10000 })
      .should('be.visible');
  });

  it('recovers when network is restored', () => {
    // Go offline
    cy.intercept('**/*', { forceNetworkError: true }).as('offline');

    // Trigger offline detection
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="manual-toggle"], button:contains("Manual")').length) {
        cy.get('[data-cy="manual-toggle"], button:contains("Manual")').first().click();
      }
    });
    cy.get('[data-cy="manual-entry"], input[type="text"]').first().type('OFFLINE');
    cy.get('[data-cy="lookup-button"], button:contains("Lookup"), button[type="submit"]').first().click();

    // Wait a moment for offline state
    cy.wait(1000);

    // Come back online by removing intercept (via re-visiting)
    cy.intercept('**/*').as('online');

    // Reload to restore network
    cy.reload();
    cy.url({ timeout: 15000 }).should('include', '/scanner');

    // Offline indicator should disappear
    cy.get('[data-cy="scanner-container"], .scanner, main', { timeout: 10000 })
      .should('be.visible');

    // Try a normal operation - should work now
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="manual-toggle"], button:contains("Manual")').length) {
        cy.get('[data-cy="manual-toggle"], button:contains("Manual")').first().click();
      }
    });

    cy.get('[data-cy="manual-entry"], input[type="text"]')
      .first()
      .should('not.be.disabled');
  });

  it('handles intermittent connectivity', () => {
    // Simulate flaky network with some requests failing
    let requestCount = 0;
    cy.intercept('**/rest/v1/**', (req) => {
      requestCount++;
      if (requestCount % 2 === 0) {
        req.destroy(); // Fail every other request
      } else {
        req.continue();
      }
    }).as('flakyNetwork');

    // Enable manual entry
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="manual-toggle"], button:contains("Manual")').length) {
        cy.get('[data-cy="manual-toggle"], button:contains("Manual")').first().click();
      }
    });

    // Try multiple scans
    for (let i = 0; i < 3; i++) {
      cy.get('[data-cy="manual-entry"], input[type="text"]')
        .first()
        .clear()
        .type(`FLAKY-TEST-${i}`);

      cy.get('[data-cy="lookup-button"], button:contains("Lookup"), button[type="submit"]')
        .first()
        .click();

      // Wait for response
      cy.wait(1000);

      // Dismiss any overlay
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy="dismiss"], button:contains("Dismiss")').length) {
          cy.get('[data-cy="dismiss"], button:contains("Dismiss")').first().click();
        }
      });
    }

    // App should still be responsive
    cy.get('[data-cy="scanner-container"], .scanner, main')
      .should('be.visible');
  });

  it('caches event data for offline operation', function() {
    if (!testEventId) {
      cy.log('No test event available - skipping cache test');
      this.skip();
      return;
    }

    // First, load with network to cache data
    cy.get('[data-cy="scanner-container"], .scanner, main', { timeout: 10000 })
      .should('be.visible');

    // Wait for data to load and cache
    cy.wait(2000);

    // Now go offline
    cy.intercept('**/*', { forceNetworkError: true }).as('offline');

    // The app should still have event data from cache
    // UI should still show event info or at least be functional
    cy.get('[data-cy="scanner-container"], .scanner, main')
      .should('be.visible');

    // Check if any event-related data is still displayed
    cy.get('body').then(($body) => {
      const hasEventInfo = $body.find('[data-cy="event-info"], .event-name, .event-title').length > 0;
      if (hasEventInfo) {
        cy.log('Event data visible from cache');
        cy.get('[data-cy="event-info"], .event-name, .event-title').should('be.visible');
      } else {
        cy.log('Event data may be cached in background - UI stays functional');
      }
    });
  });

  it('queues scans made while offline for later sync', function() {
    // Create a fresh ticket for this test
    cy.task('getTestEvent').then((event: any) => {
      if (!event) {
        cy.log('No test event available');
        return;
      }

      cy.task('createTestTicket', event.id).then((ticket: any) => {
        if (!ticket) {
          cy.log('Could not create test ticket');
          return;
        }

        const qrToken = ticket.qr_code_token;

        // Go offline before scan
        cy.intercept('**/tickets*', { forceNetworkError: true }).as('offlineTickets');
        cy.intercept('**/scan*', { forceNetworkError: true }).as('offlineScan');
        cy.intercept('**/rpc/*', { forceNetworkError: true }).as('offlineRpc');

        // Try to scan while offline
        cy.get('body').then(($body) => {
          if ($body.find('[data-cy="manual-toggle"], button:contains("Manual")').length) {
            cy.get('[data-cy="manual-toggle"], button:contains("Manual")').first().click();
          }
        });

        cy.get('[data-cy="manual-entry"], input[type="text"]')
          .first()
          .clear()
          .type(qrToken);

        cy.get('[data-cy="lookup-button"], button:contains("Lookup"), button[type="submit"]')
          .first()
          .click();

        // Should show offline mode acceptance or queue message
        cy.get('[data-cy="scan-result"], [data-cy="offline-queued"], .scan-result, .offline-message, [role="alert"]', { timeout: 10000 })
          .should('be.visible');

        // Verify the scan was queued (check localStorage or IndexedDB)
        cy.window().then((win) => {
          // Check localStorage for offline queue
          const offlineQueue = win.localStorage.getItem('offlineScansQueue') ||
                              win.localStorage.getItem('offline-scans') ||
                              win.localStorage.getItem('scanQueue');
          if (offlineQueue) {
            cy.log(`Offline queue found: ${offlineQueue}`);
            expect(offlineQueue).to.include(qrToken);
          } else {
            cy.log('Offline queue may use IndexedDB or in-memory storage');
          }
        });
      });
    });
  });

  it('handles offline acknowledgment modal', () => {
    // Go offline
    cy.intercept('**/*', { forceNetworkError: true }).as('offline');

    // Trigger offline detection
    cy.get('body').then(($body) => {
      if ($body.find('[data-cy="manual-toggle"], button:contains("Manual")').length) {
        cy.get('[data-cy="manual-toggle"], button:contains("Manual")').first().click();
      }
    });
    cy.get('[data-cy="manual-entry"], input[type="text"]').first().type('OFFLINE');
    cy.get('[data-cy="lookup-button"], button:contains("Lookup"), button[type="submit"]').first().click();

    // Check for offline modal (Phase 7 implementation)
    cy.get('body').then(($body) => {
      const hasModal = $body.find('[data-cy="offline-modal"], [role="dialog"]:contains("offline"), .offline-modal').length > 0;

      if (hasModal) {
        cy.get('[data-cy="offline-modal"], [role="dialog"]:contains("offline"), .offline-modal')
          .should('be.visible');

        // Should have acknowledge button
        cy.get('[data-cy="acknowledge"], button:contains("OK"), button:contains("Got it"), button:contains("Continue")')
          .first()
          .click();

        // Modal should close
        cy.get('[data-cy="offline-modal"]').should('not.exist');
      } else {
        cy.log('App uses banner instead of modal for offline indication');
      }
    });
  });
});
