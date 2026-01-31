/// <reference types="cypress" />

describe('Health Checks', () => {
  it('verifies database connectivity', () => {
    cy.task('healthCheck').then((checks: { db: boolean; stripe: boolean; edgeFunctions: boolean }) => {
      expect(checks.db, 'Database should be accessible').to.be.true;
    });
  });

  it('verifies Stripe API is available', () => {
    // Stripe test mode should always be available
    cy.task('healthCheck').then((checks: { db: boolean; stripe: boolean; edgeFunctions: boolean }) => {
      expect(checks.stripe, 'Stripe should be available').to.be.true;
    });
  });

  it('verifies edge functions are deployed', () => {
    cy.task('healthCheck').then((checks: { db: boolean; stripe: boolean; edgeFunctions: boolean }) => {
      expect(checks.edgeFunctions, 'Edge functions should be deployed').to.be.true;
    });
  });

  it('can access pass-lounge homepage', () => {
    cy.visit('/');
    cy.get('body').should('be.visible');
    cy.url().should('include', 'localhost:3016');
  });

  it('can access gate-scanner login page', () => {
    cy.visit(Cypress.env('SCANNER_URL') + '/auth');
    cy.get('body').should('be.visible');
    cy.url().should('include', 'localhost:3015');
  });

  it('has at least one upcoming published event', () => {
    cy.task('getTestEvent').then((event: any) => {
      expect(event, 'Should have an upcoming event for testing').to.not.be.null;
      expect(event.status).to.eq('published');
      cy.log(`Found test event: ${event.name} on ${event.event_datetime}`);
    });
  });
});
