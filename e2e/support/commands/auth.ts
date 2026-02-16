/// <reference types="cypress" />

// Login with session caching
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.session([email], () => {
    cy.visit('/auth');
    cy.get('input[type="email"], input[name="email"], [data-cy="email"]').type(email);
    cy.get('input[type="password"], input[name="password"], [data-cy="password"]').type(password);
    cy.get('button[type="submit"], [data-cy="login-button"]').click();
    // Wait for redirect to dashboard or scanner
    cy.url().should('not.contain', '/auth');
  }, {
    cacheAcrossSpecs: true,
  });
});

// Login to scanner app with configured credentials
Cypress.Commands.add('loginScanner', () => {
  const email = Cypress.env('SCANNER_EMAIL');
  const password = Cypress.env('SCANNER_PASSWORD');

  cy.session(['scanner', email], () => {
    cy.visit(Cypress.env('SCANNER_URL') + '/auth');
    cy.get('input[type="email"], input[name="email"], [data-cy="email"]').type(email);
    cy.get('input[type="password"], input[name="password"], [data-cy="password"]').type(password);
    cy.get('button[type="submit"], [data-cy="login-button"]').click();
    cy.url().should('not.contain', '/auth');
  }, {
    cacheAcrossSpecs: true,
  });
});
