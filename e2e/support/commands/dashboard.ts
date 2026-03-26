/// <reference types="cypress" />

// Navigate within the owner dashboard sidebar
Cypress.Commands.add('navigateSidebar', (section: string) => {
  const sidebarSelectors: Record<string, string> = {
    dashboard: '[data-cy="sidebar-dashboard"], a[href="/dashboard"], nav a:contains("Dashboard")',
    events: '[data-cy="sidebar-events"], a[href="/events"], nav a:contains("Events")',
    team: '[data-cy="sidebar-team"], a[href="/team"], nav a:contains("Team")',
    analytics: '[data-cy="sidebar-analytics"], a[href="/analytics"], nav a:contains("Analytics")',
    orders: '[data-cy="sidebar-orders"], a[href="/orders"], nav a:contains("Orders")',
    vipTables: '[data-cy="sidebar-vip-tables"], a[href="/vip-tables"], nav a:contains("VIP")',
    security: '[data-cy="sidebar-security"], a[href="/security"], nav a:contains("Security")',
  };

  const selector = sidebarSelectors[section];
  if (!selector) {
    throw new Error(`Unknown sidebar section: ${section}. Valid: ${Object.keys(sidebarSelectors).join(', ')}`);
  }

  cy.get(selector, { timeout: 10000 }).first().click();
});
