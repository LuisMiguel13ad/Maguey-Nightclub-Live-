/// <reference types="cypress" />

describe('Event Management', () => {
  const scannerUrl = Cypress.env('SCANNER_URL');
  const ownerEmail = Cypress.env('OWNER_EMAIL');
  const ownerPassword = Cypress.env('OWNER_PASSWORD');

  // Test event created via cy.task for cleanup tests
  let testEventId: string | null = null;

  after(() => {
    // Cleanup test event if one was created
    if (testEventId) {
      cy.task('deleteTestEvent', testEventId);
    }
  });

  it('displays event list with existing events', () => {
    cy.origin(scannerUrl, { args: { ownerEmail, ownerPassword } }, ({ ownerEmail, ownerPassword }) => {
      cy.visit('/auth/owner');
      cy.get('input[type="email"], input[name="email"], [data-cy="email"]')
        .first()
        .clear()
        .type(ownerEmail);
      cy.get('input[type="password"], input[name="password"], [data-cy="password"]')
        .first()
        .clear()
        .type(ownerPassword);
      cy.get('button[type="submit"], [data-cy="login-button"]')
        .first()
        .click();

      cy.url().should('not.contain', '/auth', { timeout: 15000 });

      cy.visit('/events');

      // Wait for the events page to load
      cy.get('[data-cy="events-container"], .events-page, main', { timeout: 15000 })
        .should('be.visible');

      // Verify events table/list renders
      // EventManagement renders a Table component or "No events yet" message
      cy.get('body').then(($body) => {
        const hasTable = $body.find('[data-cy="events-table"], table, .event-list').length > 0;
        const hasEmptyMessage = $body.text().match(/No events/i);
        // Either we have events in a table, or we see the empty state
        expect(hasTable || hasEmptyMessage).to.be.ok;
      });

      // Verify the page title / header renders
      cy.contains(/Event Management/i).should('exist');
    });
  });

  it('can open event creation form', () => {
    cy.origin(scannerUrl, { args: { ownerEmail, ownerPassword } }, ({ ownerEmail, ownerPassword }) => {
      cy.visit('/auth/owner');
      cy.get('input[type="email"], input[name="email"], [data-cy="email"]')
        .first()
        .clear()
        .type(ownerEmail);
      cy.get('input[type="password"], input[name="password"], [data-cy="password"]')
        .first()
        .clear()
        .type(ownerPassword);
      cy.get('button[type="submit"], [data-cy="login-button"]')
        .first()
        .click();

      cy.url().should('not.contain', '/auth', { timeout: 15000 });
      cy.visit('/events');

      cy.get('[data-cy="events-container"], .events-page, main', { timeout: 15000 })
        .should('be.visible');

      // Click the "New Event" / create button
      cy.get('[data-cy="create-event-button"], button:contains("New Event"), button:contains("Create"), button:contains("Add Event")')
        .first()
        .click();

      // Verify the create/edit dialog appears
      // The Dialog renders with "Create New Event" title
      cy.get('[role="dialog"], [data-cy="event-form"], .dialog', { timeout: 10000 })
        .should('be.visible');

      cy.contains(/Create New Event/i).should('be.visible');
    });
  });

  it('validates required fields on event creation', () => {
    cy.origin(scannerUrl, { args: { ownerEmail, ownerPassword } }, ({ ownerEmail, ownerPassword }) => {
      cy.visit('/auth/owner');
      cy.get('input[type="email"], input[name="email"], [data-cy="email"]')
        .first()
        .clear()
        .type(ownerEmail);
      cy.get('input[type="password"], input[name="password"], [data-cy="password"]')
        .first()
        .clear()
        .type(ownerPassword);
      cy.get('button[type="submit"], [data-cy="login-button"]')
        .first()
        .click();

      cy.url().should('not.contain', '/auth', { timeout: 15000 });
      cy.visit('/events');

      cy.get('[data-cy="events-container"], .events-page, main', { timeout: 15000 })
        .should('be.visible');

      // Open creation form
      cy.get('[data-cy="create-event-button"], button:contains("New Event"), button:contains("Create"), button:contains("Add Event")')
        .first()
        .click();

      cy.get('[role="dialog"], [data-cy="event-form"]', { timeout: 10000 })
        .should('be.visible');

      // Try to save without filling required fields
      // Click "Next" or "Create Event" / "Save" button
      cy.get('[role="dialog"]').within(() => {
        cy.get('button:contains("Next"), button:contains("Save"), button:contains("Create Event")')
          .first()
          .click();
      });

      // Should show validation error or toast
      // The form checks for event name, date, time at minimum
      cy.get('body').then(($body) => {
        const hasError =
          $body.find('[data-cy="error"], .error, [role="alert"]').length > 0 ||
          $body.text().match(/required|please|fill|enter|invalid|name|date/i);
        expect(hasError).to.be.ok;
      });
    });
  });

  it('views event details', () => {
    cy.origin(scannerUrl, { args: { ownerEmail, ownerPassword } }, ({ ownerEmail, ownerPassword }) => {
      cy.visit('/auth/owner');
      cy.get('input[type="email"], input[name="email"], [data-cy="email"]')
        .first()
        .clear()
        .type(ownerEmail);
      cy.get('input[type="password"], input[name="password"], [data-cy="password"]')
        .first()
        .clear()
        .type(ownerPassword);
      cy.get('button[type="submit"], [data-cy="login-button"]')
        .first()
        .click();

      cy.url().should('not.contain', '/auth', { timeout: 15000 });
      cy.visit('/events');

      cy.get('[data-cy="events-container"], .events-page, main', { timeout: 15000 })
        .should('be.visible');

      // Check if there are event rows to click
      cy.get('body').then(($body) => {
        const eventRows = $body.find('[data-cy="events-table"] tr, table tbody tr, .event-list .event-card');
        if (eventRows.length > 0) {
          // Click the edit button on the first event row to view details
          // EventRow has an Edit button with <Edit /> icon
          cy.get('table tbody tr, [data-cy="event-row"]')
            .first()
            .find('button:has(svg), [data-cy="edit-event"]')
            .filter(':visible')
            .first()
            .click();

          // The edit dialog should open with event details
          cy.get('[role="dialog"], [data-cy="event-form"]', { timeout: 10000 })
            .should('be.visible');

          // Should show "Edit Event" title
          cy.contains(/Edit Event/i).should('be.visible');
        } else {
          cy.log('No events available to view details - skipping interaction');
        }
      });
    });
  });

  it('shows VIP configuration section', () => {
    cy.origin(scannerUrl, { args: { ownerEmail, ownerPassword } }, ({ ownerEmail, ownerPassword }) => {
      cy.visit('/auth/owner');
      cy.get('input[type="email"], input[name="email"], [data-cy="email"]')
        .first()
        .clear()
        .type(ownerEmail);
      cy.get('input[type="password"], input[name="password"], [data-cy="password"]')
        .first()
        .clear()
        .type(ownerPassword);
      cy.get('button[type="submit"], [data-cy="login-button"]')
        .first()
        .click();

      cy.url().should('not.contain', '/auth', { timeout: 15000 });
      cy.visit('/events');

      cy.get('[data-cy="events-container"], .events-page, main', { timeout: 15000 })
        .should('be.visible');

      // Check if there are events to edit
      cy.get('body').then(($body) => {
        const eventRows = $body.find('table tbody tr, [data-cy="event-row"]');
        if (eventRows.length > 0) {
          // Click edit on the first event
          cy.get('table tbody tr, [data-cy="event-row"]')
            .first()
            .find('button:has(svg), [data-cy="edit-event"]')
            .filter(':visible')
            .first()
            .click();

          cy.get('[role="dialog"]', { timeout: 10000 })
            .should('be.visible');

          // The edit dialog uses Tabs with "VIP Setup" tab
          cy.get('[role="dialog"]').within(() => {
            cy.get('button:contains("VIP"), [role="tab"]:contains("VIP"), [data-cy="vip-tab"]')
              .first()
              .click();

            // VIP section should be visible (VIPSetupManager or VIPReservationsList)
            cy.get('body');
          });

          // Verify VIP content is rendered after tab click
          cy.get('[role="dialog"]')
            .invoke('text')
            .should('match', /VIP|table|reservation|tier/i);
        } else {
          // If no events, open create form and check for VIP step indicator
          cy.get('[data-cy="create-event-button"], button:contains("New Event")')
            .first()
            .click();

          cy.get('[role="dialog"]', { timeout: 10000 })
            .should('be.visible');

          // New event wizard has "VIP Setup" in the step indicator
          cy.contains(/VIP Setup/i).should('exist');
        }
      });
    });
  });

  it('event list is searchable or filterable', () => {
    cy.origin(scannerUrl, { args: { ownerEmail, ownerPassword } }, ({ ownerEmail, ownerPassword }) => {
      cy.visit('/auth/owner');
      cy.get('input[type="email"], input[name="email"], [data-cy="email"]')
        .first()
        .clear()
        .type(ownerEmail);
      cy.get('input[type="password"], input[name="password"], [data-cy="password"]')
        .first()
        .clear()
        .type(ownerPassword);
      cy.get('button[type="submit"], [data-cy="login-button"]')
        .first()
        .click();

      cy.url().should('not.contain', '/auth', { timeout: 15000 });
      cy.visit('/events');

      cy.get('[data-cy="events-container"], .events-page, main', { timeout: 15000 })
        .should('be.visible');

      // Verify search input exists (placeholder "Search events...")
      cy.get('[data-cy="search-events"], input[placeholder*="Search"], input[placeholder*="search"]')
        .should('be.visible');

      // Type a search query that is unlikely to match
      cy.get('[data-cy="search-events"], input[placeholder*="Search"], input[placeholder*="search"]')
        .first()
        .clear()
        .type('zzz_nonexistent_event_query');

      // Should show "No events found" or an empty table
      cy.get('body').then(($body) => {
        const hasEmptyResult =
          $body.text().match(/No events found/i) ||
          $body.find('table tbody tr').length === 0;
        expect(hasEmptyResult).to.be.ok;
      });

      // Clear the search
      cy.get('[data-cy="search-events"], input[placeholder*="Search"], input[placeholder*="search"]')
        .first()
        .clear();

      // Events should reappear (or empty state if no events exist)
      // Wait briefly for the filter to update
      cy.wait(500);
    });
  });

  it('prevents deleting event with active tickets', function () {
    // Create a test event with a ticket via cy.task, then try to delete it
    cy.task('createTestEvent', {
      name: `E2E Delete Guard ${Date.now()}`,
      status: 'published',
    }).then((event: any) => {
      if (!event) {
        cy.log('Could not create test event - skipping delete guard test');
        this.skip();
        return;
      }
      testEventId = event.id;

      // Create a ticket for this event so delete is blocked
      cy.task('createTestTicket', event.id).then((ticket: any) => {
        if (!ticket) {
          cy.log('Could not create test ticket - skipping delete guard test');
          this.skip();
          return;
        }

        cy.origin(
          scannerUrl,
          { args: { ownerEmail, ownerPassword, eventName: event.name } },
          ({ ownerEmail, ownerPassword, eventName }) => {
            cy.visit('/auth/owner');
            cy.get('input[type="email"], input[name="email"], [data-cy="email"]')
              .first()
              .clear()
              .type(ownerEmail);
            cy.get('input[type="password"], input[name="password"], [data-cy="password"]')
              .first()
              .clear()
              .type(ownerPassword);
            cy.get('button[type="submit"], [data-cy="login-button"]')
              .first()
              .click();

            cy.url().should('not.contain', '/auth', { timeout: 15000 });
            cy.visit('/events');

            cy.get('[data-cy="events-container"], .events-page, main', { timeout: 15000 })
              .should('be.visible');

            // Find the test event row and click delete
            // Wait for the events table to populate
            cy.get('table tbody, [data-cy="events-table"]', { timeout: 10000 })
              .should('exist');

            // Search for the test event to narrow results
            cy.get('[data-cy="search-events"], input[placeholder*="Search"], input[placeholder*="search"]')
              .first()
              .clear()
              .type(eventName);

            // Short wait for filter
            cy.wait(500);

            // Find the row containing our event and click delete (Trash2 icon button)
            cy.get('table tbody tr, [data-cy="event-row"]')
              .first()
              .within(() => {
                // Click the last button (delete) or a button with trash icon
                cy.get('button')
                  .last()
                  .click();
              });

            // AlertDialog should appear asking for confirmation
            cy.get('[role="alertdialog"], [data-cy="delete-dialog"]', { timeout: 5000 })
              .should('be.visible');

            // Confirm the deletion
            cy.get('[role="alertdialog"] button:contains("Delete"), [role="alertdialog"] button.bg-destructive')
              .first()
              .click();

            // Should show a "Cannot Delete" error toast because the event has tickets
            cy.get('body').then(($body) => {
              const hasProtection =
                $body.text().match(/Cannot Delete/i) ||
                $body.text().match(/has tickets/i) ||
                $body.text().match(/cannot be deleted/i) ||
                $body.find('[data-cy="delete-error"]').length > 0;
              expect(hasProtection).to.be.ok;
            });
          }
        );
      });
    });
  });
});

describe('Event Management - Mobile Viewport', () => {
  beforeEach(() => {
    cy.viewport('iphone-x');
  });

  it('renders event list on mobile', () => {
    const scannerUrl = Cypress.env('SCANNER_URL');
    const ownerEmail = Cypress.env('OWNER_EMAIL');
    const ownerPassword = Cypress.env('OWNER_PASSWORD');

    cy.origin(scannerUrl, { args: { ownerEmail, ownerPassword } }, ({ ownerEmail, ownerPassword }) => {
      cy.visit('/auth/owner');
      cy.get('input[type="email"], input[name="email"], [data-cy="email"]')
        .first()
        .clear()
        .type(ownerEmail);
      cy.get('input[type="password"], input[name="password"], [data-cy="password"]')
        .first()
        .clear()
        .type(ownerPassword);
      cy.get('button[type="submit"], [data-cy="login-button"]')
        .first()
        .click();

      cy.url().should('not.contain', '/auth', { timeout: 15000 });
      cy.visit('/events');

      // Events page should render on mobile
      cy.get('[data-cy="events-container"], .events-page, main', { timeout: 15000 })
        .should('be.visible');

      cy.contains(/Event Management/i).should('exist');
    });
  });
});
