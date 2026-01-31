/// <reference types="cypress" />

// Scan a ticket using manual entry (simulates QR scan)
Cypress.Commands.add('scanTicket', (qrCodeToken: string) => {
  // Look for manual entry input or scan input
  cy.get('[data-cy="manual-entry"], input[placeholder*="ticket"], input[placeholder*="QR"], input[name="ticketId"]', { timeout: 10000 })
    .should('be.visible')
    .clear()
    .type(qrCodeToken);

  // Click lookup/scan button
  cy.get('[data-cy="lookup-button"], [data-cy="scan-button"], button:contains("Lookup"), button:contains("Check")').first().click();
});
