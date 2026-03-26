/// <reference types="cypress" />

/**
 * Role-Based Access Control Tests
 *
 * Tests role enforcement on gate-scanner (localhost:3015).
 * ProtectedRoute component at src/components/layout/ProtectedRoute.tsx:
 *   - Unauthenticated users: redirected to /auth (with state.from preserved)
 *   - Wrong role: renders <Unauthorized /> (403 page with data-cy="unauthorized-page")
 *   - Employees: scanner access only
 *   - Owners: full dashboard access
 *
 * The 403 page has:
 *   data-cy="unauthorized-page", data-cy="unauthorized-back-button"
 *   Role-aware navigation (Back to Scanner for employees, Back to Dashboard for owners)
 *   Sign Out button
 */

describe('Role Enforcement on Gate Scanner', () => {
  const scannerUrl = Cypress.env('SCANNER_URL');
  const employeeEmail = Cypress.env('SCANNER_EMAIL');
  const employeePassword = Cypress.env('SCANNER_PASSWORD');
  const ownerEmail = Cypress.env('OWNER_EMAIL');
  const ownerPassword = Cypress.env('OWNER_PASSWORD');

  describe('Employee role restrictions', () => {
    it('employee cannot access /dashboard', () => {
      cy.origin(scannerUrl, { args: { employeeEmail, employeePassword } }, ({ employeeEmail, employeePassword }) => {
        // Login as employee
        cy.visit('/auth');
        cy.get('input[type="email"], input[name="email"], [data-cy="email"]')
          .clear()
          .type(employeeEmail);
        cy.get('input[type="password"], input[name="password"], [data-cy="password"]')
          .clear()
          .type(employeePassword);
        cy.get('button[type="submit"], [data-cy="login-button"]')
          .click();
        cy.url({ timeout: 15000 }).should('not.contain', '/auth');

        // Attempt to visit owner dashboard
        cy.visit('/dashboard');

        // Should see 403 page or be redirected
        cy.get('[data-cy="unauthorized-page"], h1:contains("403")', { timeout: 10000 })
          .should('be.visible');

        cy.get('[data-cy="unauthorized-page"]').within(() => {
          cy.contains('Access Denied').should('be.visible');
        });
      });
    });

    it('employee cannot access /events management', () => {
      cy.origin(scannerUrl, { args: { employeeEmail, employeePassword } }, ({ employeeEmail, employeePassword }) => {
        cy.visit('/auth');
        cy.get('input[type="email"], input[name="email"], [data-cy="email"]')
          .clear()
          .type(employeeEmail);
        cy.get('input[type="password"], input[name="password"], [data-cy="password"]')
          .clear()
          .type(employeePassword);
        cy.get('button[type="submit"], [data-cy="login-button"]')
          .click();
        cy.url({ timeout: 15000 }).should('not.contain', '/auth');

        // Attempt to visit event management
        cy.visit('/events');

        // Should see 403 page
        cy.get('[data-cy="unauthorized-page"], h1:contains("403")', { timeout: 10000 })
          .should('be.visible');
      });
    });

    it('employee cannot access /team', () => {
      cy.origin(scannerUrl, { args: { employeeEmail, employeePassword } }, ({ employeeEmail, employeePassword }) => {
        cy.visit('/auth');
        cy.get('input[type="email"], input[name="email"], [data-cy="email"]')
          .clear()
          .type(employeeEmail);
        cy.get('input[type="password"], input[name="password"], [data-cy="password"]')
          .clear()
          .type(employeePassword);
        cy.get('button[type="submit"], [data-cy="login-button"]')
          .click();
        cy.url({ timeout: 15000 }).should('not.contain', '/auth');

        // Attempt to visit team page
        cy.visit('/team');

        // Should see 403 page
        cy.get('[data-cy="unauthorized-page"], h1:contains("403")', { timeout: 10000 })
          .should('be.visible');
      });
    });

    it('employee cannot access /analytics', () => {
      cy.origin(scannerUrl, { args: { employeeEmail, employeePassword } }, ({ employeeEmail, employeePassword }) => {
        cy.visit('/auth');
        cy.get('input[type="email"], input[name="email"], [data-cy="email"]')
          .clear()
          .type(employeeEmail);
        cy.get('input[type="password"], input[name="password"], [data-cy="password"]')
          .clear()
          .type(employeePassword);
        cy.get('button[type="submit"], [data-cy="login-button"]')
          .click();
        cy.url({ timeout: 15000 }).should('not.contain', '/auth');

        // Attempt to visit analytics
        cy.visit('/analytics');

        // Should see 403 page
        cy.get('[data-cy="unauthorized-page"], h1:contains("403")', { timeout: 10000 })
          .should('be.visible');
      });
    });

    it('employee CAN access /scanner', () => {
      cy.origin(scannerUrl, { args: { employeeEmail, employeePassword } }, ({ employeeEmail, employeePassword }) => {
        cy.visit('/auth');
        cy.get('input[type="email"], input[name="email"], [data-cy="email"]')
          .clear()
          .type(employeeEmail);
        cy.get('input[type="password"], input[name="password"], [data-cy="password"]')
          .clear()
          .type(employeePassword);
        cy.get('button[type="submit"], [data-cy="login-button"]')
          .click();
        cy.url({ timeout: 15000 }).should('not.contain', '/auth');

        // Visit scanner page
        cy.visit('/scanner');

        // Should NOT see 403 page
        cy.get('[data-cy="unauthorized-page"]').should('not.exist');

        // Scanner should load
        cy.get('[data-cy="scanner-container"], .scanner, main', { timeout: 10000 })
          .should('be.visible');

        // Should be on the /scanner route
        cy.url().should('include', '/scanner');
      });
    });

    it('employee CAN access /scan/vip', () => {
      cy.origin(scannerUrl, { args: { employeeEmail, employeePassword } }, ({ employeeEmail, employeePassword }) => {
        cy.visit('/auth');
        cy.get('input[type="email"], input[name="email"], [data-cy="email"]')
          .clear()
          .type(employeeEmail);
        cy.get('input[type="password"], input[name="password"], [data-cy="password"]')
          .clear()
          .type(employeePassword);
        cy.get('button[type="submit"], [data-cy="login-button"]')
          .click();
        cy.url({ timeout: 15000 }).should('not.contain', '/auth');

        // Visit VIP scanner page
        cy.visit('/scan/vip');

        // Should NOT see 403 page
        cy.get('[data-cy="unauthorized-page"]').should('not.exist');

        // VIP scanner should load (or at minimum, not be blocked)
        cy.get('body').then(($body) => {
          const has403 = $body.find('[data-cy="unauthorized-page"], h1:contains("403")').length > 0;
          expect(has403).to.be.false;
          cy.log('Employee can access /scan/vip');
        });
      });
    });
  });

  describe('Unauthenticated access', () => {
    it('unauthenticated user redirected from protected routes', () => {
      cy.origin(scannerUrl, () => {
        // Clear any existing session
        cy.clearCookies();
        cy.clearLocalStorage();

        // Visit protected route without logging in
        cy.visit('/dashboard');

        // Should be redirected to /auth
        cy.url({ timeout: 15000 }).should('include', '/auth');

        // Also test another protected route
        cy.visit('/scanner');
        cy.url({ timeout: 15000 }).should('include', '/auth');

        // Test team page
        cy.visit('/team');
        cy.url({ timeout: 15000 }).should('include', '/auth');
      });
    });
  });

  describe('403 page behavior', () => {
    it('403 page shows correct navigation options', () => {
      cy.origin(scannerUrl, { args: { employeeEmail, employeePassword } }, ({ employeeEmail, employeePassword }) => {
        // Login as employee to trigger 403 on owner routes
        cy.visit('/auth');
        cy.get('input[type="email"], input[name="email"], [data-cy="email"]')
          .clear()
          .type(employeeEmail);
        cy.get('input[type="password"], input[name="password"], [data-cy="password"]')
          .clear()
          .type(employeePassword);
        cy.get('button[type="submit"], [data-cy="login-button"]')
          .click();
        cy.url({ timeout: 15000 }).should('not.contain', '/auth');

        // Trigger 403 by visiting owner-only route
        cy.visit('/dashboard');

        // Verify 403 page renders
        cy.get('[data-cy="unauthorized-page"]', { timeout: 10000 })
          .should('be.visible');

        // Should have "Back to Scanner" button (employee role gets scanner nav)
        cy.get('[data-cy="unauthorized-back-button"], button:contains("Back to Scanner"), button:contains("Back")')
          .should('be.visible');

        // Should have Sign Out button
        cy.get('button:contains("Sign Out"), button:contains("Log Out"), button:contains("Logout")')
          .should('be.visible');

        // Verify the back button navigates correctly
        cy.get('[data-cy="unauthorized-back-button"], button:contains("Back to Scanner"), button:contains("Back")')
          .first()
          .click();

        // Should navigate to scanner (not remain on 403)
        cy.url({ timeout: 10000 }).should('include', '/scanner');
        cy.get('[data-cy="unauthorized-page"]').should('not.exist');
      });
    });
  });
});
