/// <reference types="cypress" />

describe('Owner Dashboard', () => {
  const scannerUrl = Cypress.env('SCANNER_URL');
  const ownerEmail = Cypress.env('OWNER_EMAIL');
  const ownerPassword = Cypress.env('OWNER_PASSWORD');

  /**
   * Helper: login as owner on the scanner app (cross-origin).
   * Navigates to /auth/owner, fills credentials, and waits for redirect.
   */
  const loginAsOwner = (args: { ownerEmail: string; ownerPassword: string }) => {
    cy.visit('/auth/owner');
    cy.get('input[type="email"], input[name="email"], [data-cy="email"]')
      .first()
      .clear()
      .type(args.ownerEmail);
    cy.get('input[type="password"], input[name="password"], [data-cy="password"]')
      .first()
      .clear()
      .type(args.ownerPassword);
    cy.get('button[type="submit"], [data-cy="login-button"]')
      .first()
      .click();

    // Wait for auth redirect to complete
    cy.url().should('not.contain', '/auth', { timeout: 15000 });
  };

  it('loads dashboard with revenue widgets', () => {
    cy.origin(scannerUrl, { args: { ownerEmail, ownerPassword } }, ({ ownerEmail, ownerPassword }) => {
      cy.visit('/auth/owner');
      cy.get('input[type="email"], input[name="email"], [data-cy="email"]')
        .first()
        .clear()
        .type(ownerEmail);
      cy.get('input[type="password"], input[name="password"], [data-cy="password"]')
        .first()
        .clear()
        .type(ownerPassword);
      cy.get('button[type="submit"], [data-cy="login-button"]')
        .first()
        .click();

      cy.url().should('not.contain', '/auth', { timeout: 15000 });

      cy.visit('/dashboard');

      // Verify the dashboard container loaded
      cy.get('[data-cy="dashboard-container"], .dashboard, main', { timeout: 15000 })
        .should('be.visible');

      // Verify revenue card is visible (hero section has "Week Revenue" and "Today's Revenue")
      cy.get('body').then(($body) => {
        const hasRevenue =
          $body.find('[data-cy="revenue-card"]').length > 0 ||
          $body.find('[class*="revenue"]').length > 0 ||
          $body.text().match(/Revenue/i);
        expect(hasRevenue).to.be.ok;
      });

      // Verify at least one currency amount is rendered (e.g. $0.00 or $1,234.56)
      cy.contains(/\$[\d,]+\.\d{2}/)
        .should('exist');
    });
  });

  it('displays check-in progress section', () => {
    cy.origin(scannerUrl, { args: { ownerEmail, ownerPassword } }, ({ ownerEmail, ownerPassword }) => {
      cy.visit('/auth/owner');
      cy.get('input[type="email"], input[name="email"], [data-cy="email"]')
        .first()
        .clear()
        .type(ownerEmail);
      cy.get('input[type="password"], input[name="password"], [data-cy="password"]')
        .first()
        .clear()
        .type(ownerPassword);
      cy.get('button[type="submit"], [data-cy="login-button"]')
        .first()
        .click();

      cy.url().should('not.contain', '/auth', { timeout: 15000 });
      cy.visit('/dashboard');

      // Wait for dashboard to finish loading
      cy.get('[data-cy="dashboard-container"], .dashboard, main', { timeout: 15000 })
        .should('be.visible');

      // CheckInProgress component should render
      // It renders a section with check-in / scan progress bars
      cy.get('body').then(($body) => {
        const hasCheckIn =
          $body.find('[data-cy="check-in-progress"]').length > 0 ||
          $body.text().match(/check.?in/i) ||
          $body.text().match(/scanned/i);
        expect(hasCheckIn).to.be.ok;
      });
    });
  });

  it('shows upcoming events card', () => {
    cy.origin(scannerUrl, { args: { ownerEmail, ownerPassword } }, ({ ownerEmail, ownerPassword }) => {
      cy.visit('/auth/owner');
      cy.get('input[type="email"], input[name="email"], [data-cy="email"]')
        .first()
        .clear()
        .type(ownerEmail);
      cy.get('input[type="password"], input[name="password"], [data-cy="password"]')
        .first()
        .clear()
        .type(ownerPassword);
      cy.get('button[type="submit"], [data-cy="login-button"]')
        .first()
        .click();

      cy.url().should('not.contain', '/auth', { timeout: 15000 });
      cy.visit('/dashboard');

      cy.get('[data-cy="dashboard-container"], .dashboard, main', { timeout: 15000 })
        .should('be.visible');

      // UpcomingEventsCard renders upcoming events
      cy.get('body').then(($body) => {
        const hasUpcoming =
          $body.find('[data-cy="upcoming-events"]').length > 0 ||
          $body.text().match(/upcoming/i) ||
          $body.text().match(/Manage events/i) ||
          $body.text().match(/on sale/i);
        expect(hasUpcoming).to.be.ok;
      });
    });
  });

  it('displays scanner heartbeat status', () => {
    cy.origin(scannerUrl, { args: { ownerEmail, ownerPassword } }, ({ ownerEmail, ownerPassword }) => {
      cy.visit('/auth/owner');
      cy.get('input[type="email"], input[name="email"], [data-cy="email"]')
        .first()
        .clear()
        .type(ownerEmail);
      cy.get('input[type="password"], input[name="password"], [data-cy="password"]')
        .first()
        .clear()
        .type(ownerPassword);
      cy.get('button[type="submit"], [data-cy="login-button"]')
        .first()
        .click();

      cy.url().should('not.contain', '/auth', { timeout: 15000 });
      cy.visit('/dashboard');

      cy.get('[data-cy="dashboard-container"], .dashboard, main', { timeout: 15000 })
        .should('be.visible');

      // Scanner Status section renders with online/offline count or "No active scanners"
      cy.get('body').then(($body) => {
        const hasScannerStatus =
          $body.find('[data-cy="scanner-status"]').length > 0 ||
          $body.text().match(/Scanner Status/i) ||
          $body.text().match(/No active scanners/i) ||
          $body.text().match(/online/i);
        expect(hasScannerStatus).to.be.ok;
      });
    });
  });

  it('shows email status widget', () => {
    cy.origin(scannerUrl, { args: { ownerEmail, ownerPassword } }, ({ ownerEmail, ownerPassword }) => {
      cy.visit('/auth/owner');
      cy.get('input[type="email"], input[name="email"], [data-cy="email"]')
        .first()
        .clear()
        .type(ownerEmail);
      cy.get('input[type="password"], input[name="password"], [data-cy="password"]')
        .first()
        .clear()
        .type(ownerPassword);
      cy.get('button[type="submit"], [data-cy="login-button"]')
        .first()
        .click();

      cy.url().should('not.contain', '/auth', { timeout: 15000 });
      cy.visit('/dashboard');

      cy.get('[data-cy="dashboard-container"], .dashboard, main', { timeout: 15000 })
        .should('be.visible');

      // Email Delivery section renders with delivered/pending/failed counts or "No recent emails"
      cy.get('body').then(($body) => {
        const hasEmailStatus =
          $body.find('[data-cy="email-status"]').length > 0 ||
          $body.text().match(/Email Delivery/i) ||
          $body.text().match(/No recent emails/i) ||
          $body.text().match(/delivered/i);
        expect(hasEmailStatus).to.be.ok;
      });
    });
  });

  it('sidebar navigation works between sections', () => {
    cy.origin(scannerUrl, { args: { ownerEmail, ownerPassword } }, ({ ownerEmail, ownerPassword }) => {
      cy.visit('/auth/owner');
      cy.get('input[type="email"], input[name="email"], [data-cy="email"]')
        .first()
        .clear()
        .type(ownerEmail);
      cy.get('input[type="password"], input[name="password"], [data-cy="password"]')
        .first()
        .clear()
        .type(ownerPassword);
      cy.get('button[type="submit"], [data-cy="login-button"]')
        .first()
        .click();

      cy.url().should('not.contain', '/auth', { timeout: 15000 });
      cy.visit('/dashboard');

      cy.get('[data-cy="dashboard-container"], .dashboard, main', { timeout: 15000 })
        .should('be.visible');

      // On mobile, sidebar may be hidden behind hamburger - handle both viewports
      cy.get('body').then(($body) => {
        // If mobile hamburger is visible, click to open sidebar
        const hamburger = $body.find('button[aria-label="Menu"], [data-cy="sidebar-toggle"]');
        if (hamburger.length && hamburger.is(':visible')) {
          cy.wrap(hamburger.first()).click();
        }
      });

      // Click Events in sidebar
      cy.get('[data-cy="sidebar-events"], a[href="/events"], button:contains("Events"), nav button:contains("Events")')
        .first()
        .click();

      // Should navigate to /events
      cy.url().should('include', '/events', { timeout: 10000 });

      // Open sidebar again if on mobile
      cy.get('body').then(($body) => {
        const hamburger = $body.find('button[aria-label="Menu"], [data-cy="sidebar-toggle"]');
        if (hamburger.length && hamburger.is(':visible')) {
          cy.wrap(hamburger.first()).click();
        }
      });

      // Click Dashboard in sidebar
      cy.get('[data-cy="sidebar-dashboard"], a[href="/dashboard"], button:contains("Dashboard"), nav button:contains("Dashboard")')
        .first()
        .click();

      // Should navigate back to /dashboard
      cy.url().should('include', '/dashboard', { timeout: 10000 });
    });
  });
});

describe('Owner Dashboard - Mobile Viewport', () => {
  beforeEach(() => {
    cy.viewport('iphone-x');
  });

  it('renders dashboard correctly on mobile', () => {
    const scannerUrl = Cypress.env('SCANNER_URL');
    const ownerEmail = Cypress.env('OWNER_EMAIL');
    const ownerPassword = Cypress.env('OWNER_PASSWORD');

    cy.origin(scannerUrl, { args: { ownerEmail, ownerPassword } }, ({ ownerEmail, ownerPassword }) => {
      cy.visit('/auth/owner');
      cy.get('input[type="email"], input[name="email"], [data-cy="email"]')
        .first()
        .clear()
        .type(ownerEmail);
      cy.get('input[type="password"], input[name="password"], [data-cy="password"]')
        .first()
        .clear()
        .type(ownerPassword);
      cy.get('button[type="submit"], [data-cy="login-button"]')
        .first()
        .click();

      cy.url().should('not.contain', '/auth', { timeout: 15000 });
      cy.visit('/dashboard');

      // Dashboard should be visible on mobile
      cy.get('[data-cy="dashboard-container"], .dashboard, main', { timeout: 15000 })
        .should('be.visible');

      // Revenue text should still be present
      cy.contains(/\$[\d,]+\.\d{2}/)
        .should('exist');
    });
  });
});
