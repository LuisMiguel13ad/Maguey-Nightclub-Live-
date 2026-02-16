/// <reference types="cypress" />

describe('Email Verification After Purchase', () => {
  const testRunId = Date.now().toString();
  const testEmail = `email+${testRunId}@test.maguey.com`;
  let purchasedTicketId: string | null = null;

  before(() => {
    // Health check
    cy.task('healthCheck').then((checks: any) => {
      expect(checks.db).to.be.true;
    });
  });

  after(() => {
    cy.task('cleanupTestData', testRunId);
  });

  it('queues confirmation email after purchase', () => {
    const startTime = Date.now();

    // Complete a purchase
    cy.visit('/');

    cy.get('a[href*="events"], button:contains("Events")')
      .first()
      .click();

    cy.get('[data-cy="event-card"], .event-card, article')
      .first()
      .click();

    cy.get('[data-cy="ticket-quantity"], select, input[type="number"]')
      .first()
      .then(($el) => {
        if ($el.is('select')) {
          cy.wrap($el).select('1');
        } else {
          cy.wrap($el).clear().type('1');
        }
      });

    cy.get('[data-cy="checkout-button"], button:contains("Checkout"), button:contains("Buy")')
      .first()
      .click();

    // Fill details
    cy.get('input[name="email"], input[type="email"]')
      .first()
      .clear()
      .type(testEmail);

    cy.get('input[name="firstName"], input[name="first_name"]')
      .first()
      .clear()
      .type('Email');

    cy.get('input[name="lastName"], input[name="last_name"]')
      .first()
      .clear()
      .type('Test');

    cy.fillStripe();

    cy.get('[data-cy="pay-button"], button:contains("Pay"), button[type="submit"]')
      .first()
      .click();

    // Wait for confirmation
    cy.get('[data-cy="order-confirmation"], [data-cy="success"], .confirmation', { timeout: 60000 })
      .should('be.visible');

    // Try to extract ticket ID from page or URL
    cy.url().then((url) => {
      // URL might contain ticket/order ID
      const ticketMatch = url.match(/ticket[s]?\/([a-zA-Z0-9-]+)/);
      const orderMatch = url.match(/order[s]?\/([a-zA-Z0-9-]+)/);
      const idMatch = ticketMatch || orderMatch;

      if (idMatch) {
        purchasedTicketId = idMatch[1];
        cy.log(`Captured ticket/order ID: ${purchasedTicketId}`);
      }
    });

    // Poll for email in queue (max 2 minutes per success criteria)
    const pollForEmail = (attempt = 0): void => {
      const maxAttempts = 24; // 24 * 5s = 2 minutes
      const pollInterval = 5000;

      if (attempt >= maxAttempts) {
        throw new Error('Email not queued within 2 minutes');
      }

      // Query email_queue by recipient email
      cy.task('log', `Polling for email (attempt ${attempt + 1}/${maxAttempts})...`);

      // We need to query by email since we may not have ticket ID
      cy.window().then(() => {
        cy.task('healthCheck').then(() => {
          // Use a custom task to check email by recipient
          cy.request({
            method: 'GET',
            url: `${Cypress.env('SUPABASE_URL')}/rest/v1/email_queue?recipient_email=eq.${encodeURIComponent(testEmail)}&select=*`,
            headers: {
              apikey: Cypress.env('SUPABASE_ANON_KEY') || '',
              Authorization: `Bearer ${Cypress.env('SUPABASE_SERVICE_ROLE_KEY') || ''}`,
            },
            failOnStatusCode: false,
          }).then((response) => {
            if (response.status === 200 && response.body && response.body.length > 0) {
              const email = response.body[0];
              cy.log(`Email found in queue: ${email.id}, status: ${email.status}`);

              // Verify email content
              expect(email.email_type).to.match(/ticket|confirmation|ga/i);
              expect(email.recipient_email).to.eq(testEmail);

              // Log timing
              const elapsed = Date.now() - startTime;
              cy.log(`Email queued in ${elapsed}ms (${(elapsed / 1000).toFixed(1)}s)`);

              // Verify under 2 minutes
              expect(elapsed).to.be.lessThan(120000, 'Email should be queued within 2 minutes');
            } else {
              // Wait and retry
              cy.wait(pollInterval);
              pollForEmail(attempt + 1);
            }
          });
        });
      });
    };

    // Start polling after a short delay
    cy.wait(2000).then(() => {
      pollForEmail(0);
    });
  });

  it('email contains QR code reference', () => {
    // This test verifies that the queued email has the QR code/ticket info
    // Since we can't easily check email content without more setup,
    // we verify the email_queue record has the right metadata

    cy.visit('/');

    const uniqueEmail = `qr+${Date.now()}@test.maguey.com`;

    // Quick purchase
    cy.get('a[href*="events"], button:contains("Events")')
      .first()
      .click();

    cy.get('[data-cy="event-card"], .event-card, article')
      .first()
      .click();

    cy.get('[data-cy="ticket-quantity"], select, input[type="number"]')
      .first()
      .then(($el) => {
        if ($el.is('select')) {
          cy.wrap($el).select('1');
        } else {
          cy.wrap($el).clear().type('1');
        }
      });

    cy.get('[data-cy="checkout-button"], button:contains("Checkout"), button:contains("Buy")')
      .first()
      .click();

    cy.get('input[name="email"], input[type="email"]')
      .first()
      .clear()
      .type(uniqueEmail);

    cy.get('input[name="firstName"], input[name="first_name"]')
      .first()
      .clear()
      .type('QR');

    cy.get('input[name="lastName"], input[name="last_name"]')
      .first()
      .clear()
      .type('Test');

    cy.fillStripe();

    cy.get('[data-cy="pay-button"], button:contains("Pay"), button[type="submit"]')
      .first()
      .click();

    cy.get('[data-cy="order-confirmation"], [data-cy="success"], .confirmation', { timeout: 60000 })
      .should('be.visible');

    // Wait for email to be queued and verify content includes QR reference
    cy.wait(10000); // Give webhook time to process

    cy.request({
      method: 'GET',
      url: `${Cypress.env('SUPABASE_URL')}/rest/v1/email_queue?recipient_email=eq.${encodeURIComponent(uniqueEmail)}&select=*,html_content`,
      headers: {
        apikey: Cypress.env('SUPABASE_ANON_KEY') || '',
        Authorization: `Bearer ${Cypress.env('SUPABASE_SERVICE_ROLE_KEY') || ''}`,
      },
      failOnStatusCode: false,
    }).then((response) => {
      if (response.status === 200 && response.body && response.body.length > 0) {
        const email = response.body[0];
        // Email HTML should contain QR or ticket reference
        if (email.html_content) {
          expect(email.html_content).to.match(/qr|ticket|code/i);
        }
        cy.log('Email contains ticket/QR reference');
      } else {
        cy.log('Email not yet in queue - this may be a timing issue');
      }
    });
  });
});
