/// <reference types="cypress" />

// DB verification commands are implemented as cy.task() in cypress.config.ts
// This file provides convenient wrappers and additional utilities

// Utility to wait for email to be queued (with polling)
Cypress.Commands.add('waitForEmailQueued', { prevSubject: false }, (ticketId: string, timeout = 30000) => {
  const startTime = Date.now();

  const checkEmail = (): Cypress.Chainable<any> => {
    return cy.task('verifyEmailQueued', ticketId, { log: false }).then((result: unknown) => {
      const emails = result as any[];
      if (emails && emails.length > 0) {
        return emails;
      }
      if (Date.now() - startTime > timeout) {
        throw new Error(`Email not queued for ticket ${ticketId} within ${timeout}ms`);
      }
      // Wait and retry
      return cy.wait(1000, { log: false }).then(() => checkEmail());
    });
  };

  return checkEmail();
});

// Extend type declarations
declare global {
  namespace Cypress {
    interface Chainable {
      waitForEmailQueued(ticketId: string, timeout?: number): Chainable<any[]>;
    }
  }
}

export {};
