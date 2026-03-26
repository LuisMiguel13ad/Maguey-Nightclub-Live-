/// <reference types="cypress" />

// Login as owner on the scanner site
Cypress.Commands.add('loginOwner', () => {
  const email = Cypress.env('OWNER_EMAIL');
  const password = Cypress.env('OWNER_PASSWORD');
  const scannerUrl = Cypress.env('SCANNER_URL');

  cy.session(['owner', email], () => {
    cy.visit(scannerUrl + '/auth/owner');
    cy.get('input[type="email"], input[name="email"], [data-cy="owner-email"]').type(email);
    cy.get('input[type="password"], input[name="password"], [data-cy="owner-password"]').type(password);
    cy.get('button[type="submit"], [data-cy="owner-login-button"]').click();
    cy.url().should('not.contain', '/auth');
  }, {
    cacheAcrossSpecs: true,
  });
});

// Fill VIP booking form with test data
Cypress.Commands.add('fillVipBookingForm', (data: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  guestCount?: number;
  celebration?: string;
  specialRequests?: string;
}) => {
  // Contact info
  cy.get('[data-cy="vip-first-name"], input[name="firstName"]').clear().type(data.firstName);
  cy.get('[data-cy="vip-last-name"], input[name="lastName"]').clear().type(data.lastName);
  cy.get('[data-cy="vip-email"], input[name="email"]').clear().type(data.email);
  cy.get('[data-cy="vip-phone"], input[name="phone"]').clear().type(data.phone);

  // Party details (optional)
  if (data.guestCount) {
    cy.get('[data-cy="vip-guest-count"], select[name="guestCount"]').select(data.guestCount.toString());
  }

  if (data.celebration) {
    cy.get('[data-cy="vip-celebration"], select[name="celebration"]').select(data.celebration);
  }

  if (data.specialRequests) {
    cy.get('[data-cy="vip-special-requests"], textarea[name="specialRequests"]').type(data.specialRequests);
  }

  // Accept terms
  cy.get('[data-cy="vip-terms-checkbox"], input[type="checkbox"][name*="terms"], input[type="checkbox"][name*="agree"]').check({ force: true });
});
