/// <reference types="cypress" />

/**
 * Authentication Flows E2E Tests
 *
 * Tests login flows across both apps:
 * - maguey-gate-scanner (SCANNER_URL): owner login, employee login, role-based access
 * - maguey-pass-lounge (baseUrl): customer login
 */

describe('Authentication Flows', () => {
  const scannerUrl = Cypress.env('SCANNER_URL');
  const ownerEmail = Cypress.env('OWNER_EMAIL');
  const ownerPassword = Cypress.env('OWNER_PASSWORD');
  const scannerEmail = Cypress.env('SCANNER_EMAIL');
  const scannerPassword = Cypress.env('SCANNER_PASSWORD');

  describe('Gate Scanner - Owner Login', () => {
    it('owner can log in at /auth/owner', () => {
      cy.origin(
        scannerUrl,
        { args: { ownerEmail, ownerPassword } },
        ({ ownerEmail, ownerPassword }) => {
          cy.visit('/auth/owner');

          // Fill email
          cy.get('[data-cy="owner-email"], input[type="email"]')
            .first()
            .clear()
            .type(ownerEmail);

          // Fill password
          cy.get('[data-cy="owner-password"], input[type="password"]')
            .first()
            .clear()
            .type(ownerPassword);

          // Submit
          cy.get('[data-cy="owner-login-button"], button[type="submit"]')
            .first()
            .click();

          // Should redirect to /dashboard
          cy.url().should('include', '/dashboard', { timeout: 15000 });
        }
      );
    });

    it('shows password reset option', () => {
      cy.origin(scannerUrl, () => {
        cy.visit('/auth/owner');

        // Verify forgot password link/button is visible and clickable
        cy.get('[data-cy="owner-forgot-password"], button:contains("Forgot"), a:contains("Forgot")')
          .first()
          .should('be.visible')
          .click();

        // After clicking, password reset form or confirmation should appear
        cy.get('input[id="reset-email"], input[type="email"], [data-cy="reset-email"]')
          .should('be.visible');
      });
    });

    it('authenticated owner redirects away from auth', () => {
      cy.origin(
        scannerUrl,
        { args: { ownerEmail, ownerPassword } },
        ({ ownerEmail, ownerPassword }) => {
          // First, log in
          cy.visit('/auth/owner');

          cy.get('[data-cy="owner-email"], input[type="email"]')
            .first()
            .clear()
            .type(ownerEmail);

          cy.get('[data-cy="owner-password"], input[type="password"]')
            .first()
            .clear()
            .type(ownerPassword);

          cy.get('[data-cy="owner-login-button"], button[type="submit"]')
            .first()
            .click();

          // Wait for dashboard redirect
          cy.url().should('include', '/dashboard', { timeout: 15000 });

          // Now visit /auth/owner again - should redirect back to /dashboard
          cy.visit('/auth/owner');
          cy.url().should('include', '/dashboard', { timeout: 15000 });
        }
      );
    });
  });

  describe('Gate Scanner - Employee Login', () => {
    it('employee can log in at /auth/employee', () => {
      cy.origin(
        scannerUrl,
        { args: { scannerEmail, scannerPassword } },
        ({ scannerEmail, scannerPassword }) => {
          cy.visit('/auth/employee');

          // Fill email
          cy.get('[data-cy="employee-email"], input[type="email"]')
            .first()
            .clear()
            .type(scannerEmail);

          // Fill password
          cy.get('[data-cy="employee-password"], input[type="password"]')
            .first()
            .clear()
            .type(scannerPassword);

          // Submit
          cy.get('[data-cy="employee-login-button"], button[type="submit"]')
            .first()
            .click();

          // Employee should redirect to /scanner
          cy.url().should('match', /\/(scanner|dashboard)/, { timeout: 15000 });
        }
      );
    });

    it('shows remember me checkbox', () => {
      cy.origin(scannerUrl, () => {
        cy.visit('/auth/employee');

        // Verify remember me checkbox exists
        cy.get('[data-cy="employee-remember-me"], input[type="checkbox"]#remember, input[type="checkbox"]')
          .first()
          .should('exist')
          .and('be.visible');

        // Verify label text
        cy.get('label[for="remember"], label:contains("Remember")')
          .first()
          .should('be.visible')
          .and('contain.text', 'Remember');
      });
    });
  });

  describe('Pass Lounge - Customer Login', () => {
    it('customer login page loads correctly', () => {
      cy.visit('/login');

      // Verify email field renders
      cy.get('[data-cy="customer-email"], input[type="email"]')
        .first()
        .should('be.visible');

      // Verify password field renders
      cy.get('[data-cy="customer-password"], input[type="password"]')
        .first()
        .should('be.visible');

      // Verify submit button renders
      cy.get('[data-cy="customer-login-button"], button[type="submit"]')
        .first()
        .should('be.visible');
    });

    it('shows social login options', () => {
      cy.visit('/login');

      // Verify Google login button is visible
      cy.get('[data-cy="google-login"], button:contains("Google")')
        .first()
        .should('be.visible');
    });
  });

  describe('Role-Based Access Control', () => {
    it('employee cannot access /dashboard - shows 403', () => {
      cy.origin(
        scannerUrl,
        { args: { scannerEmail, scannerPassword } },
        ({ scannerEmail, scannerPassword }) => {
          // Log in as employee
          cy.visit('/auth/employee');

          cy.get('[data-cy="employee-email"], input[type="email"]')
            .first()
            .clear()
            .type(scannerEmail);

          cy.get('[data-cy="employee-password"], input[type="password"]')
            .first()
            .clear()
            .type(scannerPassword);

          cy.get('[data-cy="employee-login-button"], button[type="submit"]')
            .first()
            .click();

          // Wait for login to complete
          cy.url().should('not.contain', '/auth', { timeout: 15000 });

          // Navigate to /dashboard (owner-only route)
          cy.visit('/dashboard');

          // Should see the 403 unauthorized page
          cy.get('[data-cy="unauthorized-page"], h1:contains("403")', { timeout: 10000 })
            .first()
            .should('be.visible');

          // Verify access denied text is present
          cy.get('body').then(($body) => {
            const text = $body.text();
            expect(text).to.match(/Access Denied|403|Unauthorized/i);
          });
        }
      );
    });

    it('unauthenticated user redirected to /auth', () => {
      cy.origin(scannerUrl, () => {
        // Clear any existing sessions
        cy.clearCookies();
        cy.clearLocalStorage();

        // Visit a protected route without logging in
        cy.visit('/dashboard');

        // Should redirect to /auth
        cy.url().should('include', '/auth', { timeout: 15000 });
      });
    });
  });
});
