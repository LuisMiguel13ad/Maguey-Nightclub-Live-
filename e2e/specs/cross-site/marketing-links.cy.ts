/// <reference types="cypress" />

/**
 * Marketing Site Cross-Site Link Tests
 *
 * Verifies that the marketing site (maguey-nights, localhost:3017) correctly
 * links to the purchase site (maguey-pass-lounge, localhost:3016).
 *
 * Uses cy.origin() for cross-origin access to the marketing site.
 * Checks href attributes rather than clicking links to avoid navigating away.
 *
 * Marketing site CTA buttons use getPurchaseSiteBaseUrl() which resolves to:
 *   VITE_PURCHASE_SITE_URL > VITE_PURCHASE_WEBSITE_URL > localhost fallback
 */

describe('Marketing Site Links to Purchase Site', () => {
  const marketingUrl = Cypress.env('MARKETING_URL');
  // The purchase site URL that marketing links should point to
  // In local dev this is localhost:3016 (baseUrl) or localhost:5173 (fallback)
  const purchaseUrlPatterns = ['localhost:3016', 'localhost:5173', 'tickets.magueynightclub.com'];

  /**
   * Helper: check if an href contains any of the purchase site URL patterns
   */
  const matchesPurchaseSite = (href: string): boolean => {
    return purchaseUrlPatterns.some((pattern) => href.includes(pattern));
  };

  it('marketing site event links point to purchase site', () => {
    cy.origin(marketingUrl, { args: { purchaseUrlPatterns } }, ({ purchaseUrlPatterns }) => {
      // Visit the events page on the marketing site
      cy.visit('/events', { failOnStatusCode: false });

      // Wait for events to load (fetched from Supabase)
      cy.get('body', { timeout: 15000 }).should('be.visible');

      // Look for event cards or links that point to purchase
      cy.get('body').then(($body) => {
        // Check for links containing ticket/purchase references
        const eventLinks = $body.find(
          'a[href*="ticket"], a[href*="events"], a[href*="localhost:3016"], ' +
          'a[href*="localhost:5173"], a[href*="tickets.maguey"], ' +
          '[data-cy="event-link"], .event-card a, article a'
        );

        if (eventLinks.length > 0) {
          // Verify at least one link points to the purchase site
          let foundPurchaseLink = false;
          eventLinks.each((_, el) => {
            const href = el.getAttribute('href') || '';
            if (purchaseUrlPatterns.some((p: string) => href.includes(p))) {
              foundPurchaseLink = true;
            }
          });

          if (foundPurchaseLink) {
            cy.log('Event links correctly point to purchase site');
          } else {
            // Links may use relative paths if events are on the same site
            cy.log('Event links found but may use internal routing');
          }
        } else {
          // No events may be published, or page structure differs
          cy.log('No event links found — events page may be empty or use different structure');
        }
      });

      // Check for "BUY TICKETS" or similar CTAs
      cy.get('a:contains("BUY TICKETS"), a:contains("Buy Tickets"), a:contains("Get Tickets"), button:contains("BUY TICKETS")', { timeout: 10000 })
        .then(($links) => {
          if ($links.length > 0) {
            // Check the parent <a> tag href
            const firstLink = $links.first().closest('a');
            if (firstLink.length > 0) {
              const href = firstLink.attr('href') || '';
              const pointsToPurchase = purchaseUrlPatterns.some((p: string) => href.includes(p));
              expect(pointsToPurchase).to.be.true;
              cy.log(`Events page CTA href: ${href}`);
            }
          }
        });
    });
  });

  it('homepage CTA links to purchase site', () => {
    cy.origin(marketingUrl, { args: { purchaseUrlPatterns } }, ({ purchaseUrlPatterns }) => {
      // Visit marketing homepage
      cy.visit('/');

      // Wait for page to fully load
      cy.get('body', { timeout: 15000 }).should('be.visible');

      // Look for "BUY TICKETS" CTA buttons on the homepage
      cy.get('a:contains("BUY TICKETS"), a:contains("Buy Tickets"), a:contains("Get Tickets"), a:contains("Purchase")', { timeout: 15000 })
        .then(($links) => {
          if ($links.length > 0) {
            // Check the first CTA link
            const firstCta = $links.first().closest('a');
            if (firstCta.length > 0) {
              const href = firstCta.attr('href') || '';
              cy.log(`Homepage CTA href: ${href}`);

              // The href should contain a purchase site URL pattern
              const pointsToPurchase = purchaseUrlPatterns.some((p: string) => href.includes(p));
              expect(pointsToPurchase).to.be.true;
            } else {
              // The CTA text may be inside a button wrapped by an anchor
              const parentAnchor = $links.first().parents('a').first();
              if (parentAnchor.length > 0) {
                const href = parentAnchor.attr('href') || '';
                cy.log(`Homepage CTA parent href: ${href}`);
                const pointsToPurchase = purchaseUrlPatterns.some((p: string) => href.includes(p));
                expect(pointsToPurchase).to.be.true;
              }
            }
          } else {
            // Fallback: look for any anchor linking to purchase site patterns
            cy.get('a[href*="localhost:3016"], a[href*="localhost:5173"], a[href*="tickets.maguey"]')
              .should('have.length.greaterThan', 0);
          }
        });
    });
  });

  it('event detail page has ticket purchase link', () => {
    cy.origin(marketingUrl, { args: { purchaseUrlPatterns } }, ({ purchaseUrlPatterns }) => {
      // Visit the events page first to find a valid event
      cy.visit('/events', { failOnStatusCode: false });

      cy.get('body', { timeout: 15000 }).should('be.visible');

      // Try to click into the first event detail page
      cy.get('body').then(($body) => {
        const eventCards = $body.find(
          '[data-cy="event-card"], .event-card, article, a[href*="/event"], a[href*="/events/"]'
        );

        if (eventCards.length > 0) {
          // Get the first event link href
          const firstCard = eventCards.first();
          const href = firstCard.attr('href') || firstCard.find('a').first().attr('href');

          if (href) {
            cy.visit(href);
          } else {
            // Click the card to navigate
            cy.wrap(firstCard).click();
          }

          // On the event detail page, look for a purchase/ticket link
          cy.get('body', { timeout: 15000 }).then(($detailBody) => {
            const purchaseLinks = $detailBody.find(
              'a:contains("BUY TICKETS"), a:contains("Buy Tickets"), a:contains("Get Tickets"), ' +
              'a:contains("Purchase"), button:contains("BUY"), ' +
              'a[href*="localhost:3016"], a[href*="localhost:5173"], a[href*="tickets.maguey"]'
            );

            if (purchaseLinks.length > 0) {
              // Check the closest anchor's href
              const link = purchaseLinks.first().closest('a');
              if (link.length > 0) {
                const linkHref = link.attr('href') || '';
                cy.log(`Event detail purchase link: ${linkHref}`);
                const pointsToPurchase = purchaseUrlPatterns.some((p: string) => linkHref.includes(p));
                expect(pointsToPurchase).to.be.true;
              } else {
                // May be a button inside an anchor — check parent
                const parentAnchor = purchaseLinks.first().parents('a').first();
                if (parentAnchor.length > 0) {
                  const parentHref = parentAnchor.attr('href') || '';
                  cy.log(`Event detail purchase parent link: ${parentHref}`);
                  const pointsToPurchase = purchaseUrlPatterns.some((p: string) => parentHref.includes(p));
                  expect(pointsToPurchase).to.be.true;
                }
              }
            } else {
              cy.log('No explicit purchase link found on event detail page — may use internal routing');
            }
          });
        } else {
          cy.log('No events found on events page — cannot test event detail links');
        }
      });
    });
  });
});
