/// <reference types="cypress" />

declare namespace Cypress {
  interface Chainable {
    // Auth commands
    login(email: string, password: string): Chainable<void>;
    loginScanner(): Chainable<void>;

    // Purchase commands
    fillStripe(): Chainable<void>;
    fillStripeDeclined(declineType: 'generic' | 'insufficientFunds' | 'expired' | 'incorrectCvc'): Chainable<void>;

    // Scan commands
    scanTicket(qrCodeToken: string): Chainable<void>;

    // DB verification commands
    waitForEmailQueued(ticketId: string, timeout?: number): Chainable<any[]>;
  }
}
