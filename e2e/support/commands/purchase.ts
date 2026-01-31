/// <reference types="cypress" />
import 'cypress-plugin-stripe-elements';

// Fill Stripe payment form with valid card
Cypress.Commands.add('fillStripe', () => {
  // Wait for Stripe iframe to load
  cy.get('iframe[name^="__privateStripeFrame"]', { timeout: 15000 }).should('exist');

  // Use the plugin to fill card details
  cy.get('iframe[name^="__privateStripeFrame"]').first().within({ log: false }, () => {
    cy.fillElementsInput('cardNumber', '4242424242424242');
    cy.fillElementsInput('cardExpiry', '1230');
    cy.fillElementsInput('cardCvc', '123');
  });

  // Fill ZIP if visible (depends on Stripe config)
  cy.get('body').then(($body) => {
    if ($body.find('iframe[name*="postal"]').length > 0) {
      cy.get('iframe[name*="postal"]').within({ log: false }, () => {
        cy.fillElementsInput('postalCode', '90210');
      });
    }
  });
});

// Fill Stripe with a declined card
Cypress.Commands.add('fillStripeDeclined', (declineType: 'generic' | 'insufficientFunds' | 'expired' | 'incorrectCvc') => {
  const cards: Record<string, string> = {
    generic: '4000000000000002',
    insufficientFunds: '4000000000009995',
    expired: '4000000000000069',
    incorrectCvc: '4000000000000127',
  };

  cy.get('iframe[name^="__privateStripeFrame"]', { timeout: 15000 }).should('exist');

  cy.get('iframe[name^="__privateStripeFrame"]').first().within({ log: false }, () => {
    cy.fillElementsInput('cardNumber', cards[declineType]);
    cy.fillElementsInput('cardExpiry', '1230');
    cy.fillElementsInput('cardCvc', '123');
  });
});
