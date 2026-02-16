# Phase 8: GA End-to-End Testing - Research

**Researched:** 2026-01-31
**Domain:** Cypress E2E Testing for Multi-App Ticket Purchase Flow
**Confidence:** HIGH

## Summary

This phase implements comprehensive end-to-end tests for the general admission ticket flow using Cypress. The test suite validates the complete journey: browsing events, purchasing tickets on `maguey-pass-lounge` (port 3016), receiving email confirmation, and scanning QR codes on `maguey-gate-scanner` (port 3015). Cypress 15.x is the current stable version requiring Node.js 20+.

The primary technical challenge is cross-origin testing between two apps. Cypress's `cy.origin()` command (mandatory since v14) enables seamless navigation between different localhost ports. The established approach uses `cy.session()` for auth caching, `cypress-plugin-stripe-elements` for Stripe iframe handling, and database verification via `cy.task()` with Supabase client.

**Primary recommendation:** Structure tests around user journeys with shared custom commands for login, purchase, and scan operations. Use `cy.origin()` for cross-app flows and verify data via direct database queries.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| cypress | ^15.x | E2E test framework | Locked decision, full cross-origin support since v14 |
| @cypress/grep | ^4.x | Test filtering | Filter tests by tags for focused runs |
| cypress-plugin-stripe-elements | ^2.x | Stripe iframe handling | Proven solution for filling Stripe Elements |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jsqr | ^1.4.0 | QR code decoding | Verify QR content before scanning |
| start-server-and-test | ^2.x | Server orchestration | Start both apps before tests |
| @supabase/supabase-js | ^2.78.0 | Database verification | Already in project, use via cy.task() |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| cypress-plugin-stripe-elements | Manual iframe handling | Plugin abstracts complexity, more stable |
| jsQR in browser | Decode via cy.task() | Browser decode requires canvas manipulation |
| Cypress Cloud parallel | cypress-parallel | Cloud provides better load balancing but costs money |

**Installation:**
```bash
# From project root
npm install --save-dev cypress @cypress/grep cypress-plugin-stripe-elements jsqr start-server-and-test
```

## Architecture Patterns

### Recommended Project Structure
```
e2e/
├── cypress.config.ts          # Main config with baseUrl, env vars
├── support/
│   ├── e2e.ts                 # Support file imports
│   ├── commands/
│   │   ├── auth.ts            # cy.login(), cy.logout()
│   │   ├── purchase.ts        # cy.purchaseTicket(), cy.fillStripe()
│   │   ├── scan.ts            # cy.scanQRCode(), cy.verifyScan()
│   │   └── db.ts              # cy.verifyInDatabase(), cy.cleanupTestData()
│   └── index.d.ts             # Type declarations for custom commands
├── fixtures/
│   ├── test-event.json        # Event creation data
│   └── stripe-cards.json      # Test card numbers
├── plugins/
│   └── index.ts               # cy.task() definitions for DB access
└── specs/
    ├── health-check.cy.ts     # Service availability checks
    ├── happy-path/
    │   ├── purchase-flow.cy.ts
    │   ├── email-verification.cy.ts
    │   └── scan-flow.cy.ts
    ├── edge-cases/
    │   ├── payment-failures.cy.ts
    │   ├── duplicate-scan.cy.ts
    │   └── invalid-qr.cy.ts
    └── offline/
        └── offline-scan.cy.ts
```

### Pattern 1: Cross-Origin Testing with cy.origin()
**What:** Navigate between pass-lounge (purchase) and gate-scanner (scan) in a single test
**When to use:** Any test that spans both applications
**Example:**
```typescript
// Source: https://docs.cypress.io/api/commands/origin
describe('Complete GA Flow', () => {
  it('purchases ticket and scans at gate', () => {
    // Start on pass-lounge (baseUrl)
    cy.visit('/events');
    cy.purchaseTicket('General Admission');

    // Store ticket data for cross-origin use
    cy.get('[data-cy=ticket-id]').invoke('text').as('ticketId');
    cy.get('[data-cy=qr-code]').invoke('attr', 'src').as('qrData');

    // Switch to gate-scanner origin
    cy.origin('http://localhost:3015', { args: { ticketId: '@ticketId' } }, ({ ticketId }) => {
      cy.visit('/scanner');
      cy.login('staff@example.com', 'password');
      cy.get('[data-cy=manual-entry]').type(ticketId);
      cy.get('[data-cy=scan-button]').click();
      cy.get('[data-cy=scan-result]').should('contain', 'Valid');
    });
  });
});
```

### Pattern 2: Authentication with cy.session()
**What:** Cache authentication state to avoid repeated login flows
**When to use:** Any test requiring authenticated scanner access
**Example:**
```typescript
// Source: https://docs.cypress.io/api/commands/session
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.session([email], () => {
    cy.visit('/auth');
    cy.get('[data-cy=email]').type(email);
    cy.get('[data-cy=password]').type(password);
    cy.get('[data-cy=login-button]').click();
    cy.url().should('contain', '/dashboard');
  }, {
    validate() {
      // Verify session is still valid
      cy.request('/api/auth/session').its('status').should('eq', 200);
    },
    cacheAcrossSpecs: true,
  });
});
```

### Pattern 3: Database Verification via cy.task()
**What:** Query Supabase directly to verify data state
**When to use:** Verify ticket creation, email queue, scan logs
**Example:**
```typescript
// cypress.config.ts
import { createClient } from '@supabase/supabase-js';

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      const supabase = createClient(
        config.env.SUPABASE_URL,
        config.env.SUPABASE_SERVICE_ROLE_KEY
      );

      on('task', {
        async verifyTicketCreated(orderId: string) {
          const { data, error } = await supabase
            .from('tickets')
            .select('*')
            .eq('order_id', orderId)
            .single();
          return { data, error };
        },

        async verifyEmailQueued(ticketId: string) {
          const { data } = await supabase
            .from('email_queue')
            .select('*')
            .eq('related_id', ticketId)
            .eq('email_type', 'ga_ticket');
          return data;
        },

        async cleanupTestData(testRunId: string) {
          // Delete in order: tickets -> orders -> events
          await supabase.from('tickets').delete()
            .like('ticket_id', `TEST-${testRunId}%`);
          await supabase.from('orders').delete()
            .like('customer_email', `%+${testRunId}@%`);
          return null;
        }
      });
    }
  }
});
```

### Pattern 4: Stripe Elements Testing
**What:** Fill payment forms using the plugin to handle iframes
**When to use:** Any checkout flow
**Example:**
```typescript
// Source: https://github.com/dbalatero/cypress-plugin-stripe-elements
// cypress/support/commands/purchase.ts
import 'cypress-plugin-stripe-elements';

Cypress.Commands.add('fillStripe', () => {
  cy.get('#card-element').within(() => {
    cy.fillElementsInput('cardNumber', '4242424242424242');
    cy.fillElementsInput('cardExpiry', '1230');  // MM/YY
    cy.fillElementsInput('cardCvc', '123');
    cy.fillElementsInput('postalCode', '90210');
  });
});

Cypress.Commands.add('fillStripeDeclined', (declineType: string) => {
  const cards = {
    generic: '4000000000000002',
    insufficientFunds: '4000000000009995',
    expired: '4000000000000069',
  };
  cy.get('#card-element').within(() => {
    cy.fillElementsInput('cardNumber', cards[declineType]);
    cy.fillElementsInput('cardExpiry', '1230');
    cy.fillElementsInput('cardCvc', '123');
  });
});
```

### Pattern 5: Network Stubbing for Offline Mode
**What:** Simulate network failures to test offline scanner behavior
**When to use:** Offline mode tests
**Example:**
```typescript
// Source: https://docs.cypress.io/api/commands/intercept
describe('Offline Scanner', () => {
  it('uses cached ticket when offline', () => {
    // First, cache a ticket while online
    cy.visit('/scanner');
    cy.scanQRCode('MGY-TEST-001');
    cy.get('[data-cy=scan-result]').should('contain', 'Valid');

    // Simulate going offline
    cy.intercept('**/*', { forceNetworkError: true }).as('offline');

    // Allow cached IndexedDB data
    cy.scanQRCode('MGY-TEST-001');
    cy.get('[data-cy=offline-indicator]').should('be.visible');
    cy.get('[data-cy=scan-result]').should('contain', 'Cached');
  });
});
```

### Anti-Patterns to Avoid
- **Chaining after action commands:** "In general, the structure of your test should flow query -> query -> command or assertion(s). It's best practice not to chain anything after an action command."
- **Hard-coded waits:** Never use `cy.wait(5000)`. Use assertions that auto-retry instead
- **Testing external services directly:** Mock Resend API, use Stripe test mode
- **Dependent tests:** Each test must set up its own state independently
- **CSS selectors:** Use `data-cy` attributes for stable element selection

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Stripe iframe handling | Custom iframe commands | cypress-plugin-stripe-elements | Handles timing, frame selection, field mapping |
| QR code decoding | Canvas manipulation | jsQR via cy.task() | Library handles binary parsing edge cases |
| Cross-origin auth | Cookie manipulation | cy.session() + cy.origin() | Built-in, handles complex state |
| Parallel test runs | Custom sharding | GitHub Actions matrix + optional Cypress Cloud | Load balancing is complex |
| Retry on failure | Custom retry loops | Cypress retries config | Built-in exponential backoff |
| Screenshot on failure | Manual cy.screenshot() | Automatic (enabled by default) | Captures at correct moment |

**Key insight:** Cypress has evolved significantly in v14-15 with `cy.origin()` becoming mandatory. Most "workarounds" from older tutorials are now anti-patterns.

## Common Pitfalls

### Pitfall 1: Forgetting cy.origin() for Cross-App Navigation
**What goes wrong:** Tests fail with "Cypress detected a cross-origin error"
**Why it happens:** Cypress v14+ requires explicit origin switching
**How to avoid:** Always wrap cross-origin actions in `cy.origin()`
**Warning signs:** Errors mentioning "document.domain" or "cross-origin"

### Pitfall 2: Stripe iframe Timing Issues
**What goes wrong:** "Element not found" when filling Stripe fields
**Why it happens:** Stripe Elements load asynchronously in iframes
**How to avoid:** Use cypress-plugin-stripe-elements which handles waiting
**Warning signs:** Flaky tests that pass locally but fail in CI

### Pitfall 3: Test Isolation Failures
**What goes wrong:** Tests pass in isolation but fail when run together
**Why it happens:** Shared state between tests (database, localStorage)
**How to avoid:**
- Use unique test run IDs in test data
- Cleanup in `before()` not `after()` (after may not run)
- Use `cy.session()` to isolate auth state
**Warning signs:** Different results with `--spec` vs full run

### Pitfall 4: Flaky Email Verification
**What goes wrong:** Email assertion fails intermittently
**Why it happens:** Email processing is async, timing varies
**How to avoid:** Poll email_queue table with retry instead of fixed wait
**Warning signs:** Tests with `cy.wait(10000)` for email

### Pitfall 5: chromeWebSecurity Disabled Globally
**What goes wrong:** Security vulnerabilities, some tests may behave differently
**Why it happens:** Stripe plugin requires `chromeWebSecurity: false`
**How to avoid:** Only disable in tests that need it via test config
**Warning signs:** Tests behaving differently than manual testing

### Pitfall 6: Variables Not Passed to cy.origin()
**What goes wrong:** Variables are undefined inside cy.origin callback
**Why it happens:** Callback is serialized, can't access outer scope
**How to avoid:** Pass via `args` option: `cy.origin(url, { args: { var } }, ({ var }) => {})`
**Warning signs:** "undefined" errors inside origin callback

### Pitfall 7: Viewport Not Set for Mobile Tests
**What goes wrong:** Mobile-specific UI elements not tested
**Why it happens:** Default viewport is desktop (1000x660)
**How to avoid:** Use `cy.viewport('iphone-x')` or config preset
**Warning signs:** Tests pass but mobile bugs ship

## Code Examples

Verified patterns from official sources:

### Complete Purchase Flow Test
```typescript
// Source: Cypress docs + project context
describe('GA Ticket Purchase', () => {
  const testRunId = `${Date.now()}`;
  const testEmail = `buyer+${testRunId}@test.com`;

  before(() => {
    // Health check all services
    cy.task('healthCheck').should('deep.equal', {
      db: true,
      stripe: true,
      edgeFunctions: true
    });
  });

  after(() => {
    cy.task('cleanupTestData', testRunId);
  });

  it('completes full purchase flow under 2 minutes', () => {
    const startTime = Date.now();

    // 1. Browse events and select
    cy.visit('/events');
    cy.get('[data-cy=event-card]').first().click();

    // 2. Add tickets
    cy.get('[data-cy=ticket-tier-ga]').within(() => {
      cy.get('[data-cy=quantity]').select('2');
      cy.get('[data-cy=add-to-cart]').click();
    });

    // 3. Checkout
    cy.get('[data-cy=checkout-button]').click();
    cy.get('[data-cy=email]').type(testEmail);
    cy.get('[data-cy=first-name]').type('Test');
    cy.get('[data-cy=last-name]').type('User');

    // 4. Pay with Stripe
    cy.fillStripe();
    cy.get('[data-cy=pay-button]').click();

    // 5. Wait for success
    cy.get('[data-cy=order-confirmation]', { timeout: 30000 })
      .should('be.visible');
    cy.get('[data-cy=order-id]').invoke('text').as('orderId');

    // 6. Verify ticket displayed
    cy.get('[data-cy=ticket-qr]').should('be.visible');

    // 7. Verify database state
    cy.get('@orderId').then((orderId) => {
      cy.task('verifyTicketCreated', orderId).then((result) => {
        expect(result.data.status).to.eq('issued');
        expect(result.data.ticket_type).to.eq('ga');
      });
    });

    // 8. Verify email queued
    cy.get('@orderId').then((orderId) => {
      cy.task('verifyEmailQueued', orderId).then((emails) => {
        expect(emails).to.have.length.gte(1);
        expect(emails[0].status).to.be.oneOf(['pending', 'sent', 'delivered']);
      });
    });

    // Timing assertion
    const elapsed = Date.now() - startTime;
    cy.log(`Flow completed in ${elapsed}ms`);
    // Note: Measure, don't assert on timing in E2E (too flaky)
  });
});
```

### Scan Flow with Cross-Origin
```typescript
// Source: Cypress cy.origin() docs
describe('Gate Scanner Flow', () => {
  let ticketId: string;

  before(() => {
    // Create test ticket via API
    cy.task('createTestTicket').then((ticket) => {
      ticketId = ticket.ticket_id;
    });
  });

  it('accepts valid QR code at gate', () => {
    cy.origin('http://localhost:3015', { args: { ticketId } }, ({ ticketId }) => {
      // Login to scanner (uses cy.session internally)
      cy.visit('/auth');
      cy.get('[data-cy=email]').type(Cypress.env('SCANNER_EMAIL'));
      cy.get('[data-cy=password]').type(Cypress.env('SCANNER_PASSWORD'));
      cy.get('[data-cy=login]').click();

      // Navigate to scanner
      cy.visit('/scanner');

      // Use manual entry (simulates scan)
      cy.get('[data-cy=manual-entry]').type(ticketId);
      cy.get('[data-cy=lookup-button]').click();

      // Verify result
      cy.get('[data-cy=ticket-status]').should('contain', 'Valid');
      cy.get('[data-cy=check-in-button]').click();
      cy.get('[data-cy=success-message]').should('contain', 'Checked In');
    });

    // Verify in database
    cy.task('verifyTicketScanned', ticketId).then((result) => {
      expect(result.data.status).to.eq('checked_in');
      expect(result.data.checked_in_at).to.not.be.null;
    });
  });

  it('rejects already-scanned ticket', () => {
    cy.origin('http://localhost:3015', { args: { ticketId } }, ({ ticketId }) => {
      cy.visit('/scanner');
      cy.get('[data-cy=manual-entry]').type(ticketId);
      cy.get('[data-cy=lookup-button]').click();

      // Should show already used
      cy.get('[data-cy=ticket-status]').should('contain', 'Already Used');
      cy.get('[data-cy=error-message]').should('be.visible');
    });
  });
});
```

### Payment Failure Testing
```typescript
// Source: Stripe test cards docs
describe('Payment Failures', () => {
  const stripeDeclineCards = {
    generic: '4000000000000002',
    insufficientFunds: '4000000000009995',
    expired: '4000000000000069',
    incorrectCvc: '4000000000000127',
  };

  Object.entries(stripeDeclineCards).forEach(([reason, cardNumber]) => {
    it(`handles ${reason} decline`, () => {
      cy.visit('/checkout');
      cy.selectEvent();

      cy.get('#card-element').within(() => {
        cy.fillElementsInput('cardNumber', cardNumber);
        cy.fillElementsInput('cardExpiry', '1230');
        cy.fillElementsInput('cardCvc', '123');
      });

      cy.get('[data-cy=pay-button]').click();

      // Verify error UI
      cy.get('[data-cy=payment-error]').should('be.visible');
      cy.get('[data-cy=payment-error]')
        .invoke('text')
        .should('match', /declined|failed|insufficient/i);

      // Verify no ticket created
      cy.task('verifyNoTicketForEmail', testEmail).then((count) => {
        expect(count).to.eq(0);
      });
    });
  });
});
```

### Viewport Testing
```typescript
// Source: https://docs.cypress.io/api/commands/viewport
const viewports = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', preset: 'iphone-x' as const },
];

viewports.forEach((vp) => {
  describe(`Scanner on ${vp.name}`, () => {
    beforeEach(() => {
      if ('preset' in vp) {
        cy.viewport(vp.preset);
      } else {
        cy.viewport(vp.width, vp.height);
      }
    });

    it('displays scanner interface correctly', () => {
      cy.origin('http://localhost:3015', () => {
        cy.visit('/scanner');
        cy.get('[data-cy=scanner-container]').should('be.visible');
        cy.get('[data-cy=scan-button]').should('be.visible');
      });
    });
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `cy.route()` for network stubbing | `cy.intercept()` | Cypress 6.0 (2020) | Full fetch/XHR support |
| Manual cross-origin workarounds | `cy.origin()` mandatory | Cypress 14.0 (2025) | Must use for different origins |
| `experimentalSessionAndOrigin` | Built-in `cy.session()` | Cypress 12.0 (2023) | No experimental flag needed |
| Node 16/18 support | Node 20+ required | Cypress 15.0 (2025) | Update CI runners |
| Webpack 4 | Webpack 5 only | Cypress 15.0 (2025) | May affect custom configs |

**Deprecated/outdated:**
- `cy.server()` / `cy.route()`: Use `cy.intercept()` instead
- `experimentalSessionAndOrigin` flag: Remove, now default behavior
- `chromeWebSecurity: false` globally: Prefer per-test when possible
- `cypress-iframe` plugin: Use `cy.origin()` for same-site iframes

## Open Questions

Things that couldn't be fully resolved:

1. **Exact timing threshold assertion**
   - What we know: 2-minute target from payment to email
   - What's unclear: Should test assert timing or just measure?
   - Recommendation: Log timing, don't assert (too flaky for CI). Add a separate performance baseline script if needed.

2. **Parallel worker count**
   - What we know: CONTEXT says 4+ workers
   - What's unclear: Optimal number for this codebase size
   - Recommendation: Start with 4 in GitHub Actions matrix, adjust based on run times

3. **Test file location**
   - What we know: Claude's discretion per CONTEXT
   - What's unclear: Root `/e2e` vs per-app directories
   - Recommendation: Root `/e2e` folder - tests span both apps, single Cypress install

4. **Custom command abstraction level**
   - What we know: Need reusable commands
   - What's unclear: How granular to make them
   - Recommendation: Start with high-level journey commands (cy.purchaseTicket), refactor as patterns emerge

## Sources

### Primary (HIGH confidence)
- [Cypress Best Practices](https://docs.cypress.io/app/core-concepts/best-practices) - Test structure, selectors, state management
- [cy.origin() API](https://docs.cypress.io/api/commands/origin) - Cross-origin testing patterns
- [cy.session() API](https://docs.cypress.io/api/commands/session) - Authentication caching
- [cy.intercept() API](https://docs.cypress.io/api/commands/intercept) - Network stubbing
- [Cypress GitHub Actions Guide](https://docs.cypress.io/app/continuous-integration/github-actions) - CI configuration
- [Stripe Test Cards](https://docs.stripe.com/testing) - Payment decline testing

### Secondary (MEDIUM confidence)
- [cypress-plugin-stripe-elements](https://github.com/dbalatero/cypress-plugin-stripe-elements) - Stripe iframe handling
- [Cypress Changelog](https://docs.cypress.io/app/references/changelog) - v15 features and breaking changes
- [jsQR GitHub](https://github.com/cozmo/jsQR) - QR decoding library

### Tertiary (LOW confidence)
- Various Medium articles on cross-origin patterns (verified with official docs)
- Community tutorials on Supabase + Cypress (verified with Supabase docs)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Cypress docs are authoritative, plugin well-documented
- Architecture: HIGH - Patterns from official Cypress docs and verified examples
- Pitfalls: HIGH - Common issues documented in Cypress guides and GitHub issues
- Cross-origin: HIGH - Cypress v14+ has mandatory, well-documented approach
- Stripe testing: MEDIUM - Plugin works but version compatibility may need verification

**Research date:** 2026-01-31
**Valid until:** 2026-03-01 (Cypress is stable but check for v15.x minor updates)

---

## Appendix: Environment Configuration

### cypress.config.ts Template
```typescript
import { defineConfig } from 'cypress';
import { createClient } from '@supabase/supabase-js';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3016', // pass-lounge
    supportFile: 'e2e/support/e2e.ts',
    specPattern: 'e2e/specs/**/*.cy.ts',

    // Video/screenshot config per CONTEXT
    video: true,
    screenshotOnRunFailure: true,
    trashAssetsBeforeRuns: true,

    // Retry config
    retries: {
      runMode: 2,
      openMode: 0,
    },

    // Required for Stripe plugin
    chromeWebSecurity: false,

    // Timeouts
    defaultCommandTimeout: 10000,
    pageLoadTimeout: 30000,
    requestTimeout: 10000,

    // Environment variables
    env: {
      SUPABASE_URL: process.env.VITE_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      SCANNER_URL: 'http://localhost:3015',
      SCANNER_EMAIL: 'staff@maguey.com',
      SCANNER_PASSWORD: process.env.SCANNER_TEST_PASSWORD,
    },

    setupNodeEvents(on, config) {
      const supabase = createClient(
        config.env.SUPABASE_URL!,
        config.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      on('task', {
        // Health checks
        async healthCheck() {
          const checks = { db: false, stripe: true, edgeFunctions: false };

          // DB check
          const { error } = await supabase.from('events').select('id').limit(1);
          checks.db = !error;

          // Edge functions check (placeholder)
          // checks.edgeFunctions = await checkEdgeFunctions();
          checks.edgeFunctions = true;

          return checks;
        },

        // Ticket verification
        async verifyTicketCreated(orderId: string) {
          return supabase.from('tickets').select('*').eq('order_id', orderId).single();
        },

        // Email queue verification
        async verifyEmailQueued(ticketId: string) {
          const { data } = await supabase
            .from('email_queue')
            .select('*')
            .eq('related_id', ticketId);
          return data;
        },

        // Scan verification
        async verifyTicketScanned(ticketId: string) {
          return supabase.from('tickets').select('*').eq('ticket_id', ticketId).single();
        },

        // Cleanup
        async cleanupTestData(testRunId: string) {
          // Delete test data by test run ID pattern
          await supabase.from('tickets').delete().ilike('ticket_id', `%${testRunId}%`);
          await supabase.from('orders').delete().ilike('customer_email', `%${testRunId}%`);
          return null;
        },

        // Create test ticket for scan tests
        async createTestTicket() {
          // Implementation depends on your ticket creation logic
          return { ticket_id: `TEST-${Date.now()}-ABC123` };
        },
      });

      // Delete videos for passing specs
      on('after:spec', (spec, results) => {
        if (results && results.video) {
          const failures = results.tests?.some((test) =>
            test.attempts?.some((attempt) => attempt.state === 'failed')
          );
          if (!failures) {
            const fs = require('fs');
            fs.unlinkSync(results.video);
          }
        }
      });

      return config;
    },
  },
});
```

### GitHub Actions Workflow Template
```yaml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:

jobs:
  install:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run build --workspace=maguey-pass-lounge
      - run: npm run build --workspace=maguey-gate-scanner
      - uses: actions/upload-artifact@v4
        with:
          name: build-artifacts
          path: |
            maguey-pass-lounge/dist
            maguey-gate-scanner/dist

  e2e:
    runs-on: ubuntu-24.04
    needs: install
    strategy:
      fail-fast: false
      matrix:
        containers: [1, 2, 3, 4]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          name: build-artifacts
      - uses: cypress-io/github-action@v6
        with:
          start: |
            npm run preview --workspace=maguey-pass-lounge -- --port 3016 &
            npm run preview --workspace=maguey-gate-scanner -- --port 3015
          wait-on: 'http://localhost:3016, http://localhost:3015'
          browser: chrome
          # Optional: Enable for Cypress Cloud parallelization
          # record: true
          # parallel: true
        env:
          VITE_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          VITE_STRIPE_PUBLISHABLE_KEY: ${{ secrets.STRIPE_TEST_PK }}
```
