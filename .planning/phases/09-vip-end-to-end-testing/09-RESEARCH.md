# Phase 9: VIP End-to-End Testing - Research

**Researched:** 2026-01-31
**Domain:** End-to-End Testing (Playwright, PostgreSQL concurrency, Email webhooks)
**Confidence:** HIGH

## Summary

Phase 9 validates the complete VIP reservation flow from purchase to gate entry. The research focused on implementation patterns for five key testing domains: Playwright E2E for checkout flows, URL parameter-based scanner testing, PostgreSQL concurrent transaction testing, Resend webhook verification, and SQL seed data patterns.

Playwright provides robust patterns for testing Stripe checkout flows using test cards and fixtures for database seeding. PostgreSQL supports concurrent testing via multiple connections, pg_background extension, or SERIALIZABLE isolation. Resend webhooks require Svix signature verification and can be tested via ngrok tunneling. SQL seed scripts should use idempotent patterns with `ON CONFLICT DO NOTHING` and `IF NOT EXISTS` clauses.

The existing codebase already has Playwright configured, VIPScanner.tsx accepts QR tokens, and the resend webhook handler implements proper Svix verification. The main implementation gap is creating comprehensive seed data and writing test specs that exercise the full VIP flow.

**Primary recommendation:** Build on existing Playwright config with worker-scoped database seeding fixtures, use URL parameters for scanner QR input testing, and leverage PostgreSQL's native concurrent connection support for race condition testing.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Playwright | Latest (from package.json) | E2E browser testing | Official recommendation for modern E2E testing, auto-waiting, cross-browser support |
| PostgreSQL native connections | 14+ | Concurrent transaction testing | Built-in parallel connection support, SERIALIZABLE isolation level |
| Svix | 1.34.0 | Resend webhook signature verification | Official Resend webhook infrastructure |
| Supabase JS Client | 2.x | Database operations in tests | Existing project dependency |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pg_background | Latest | Parallel SQL execution | Optional - only if testing autonomous transactions needed |
| ngrok | Latest | Local webhook testing | Development - tunnel webhooks to localhost |
| Stripe test cards | N/A | Payment simulation | Use 4242 4242 4242 4242 for successful payments |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Playwright | Cypress | Playwright has better API testing, WebSocket support, multiple browser contexts |
| Multiple connections | pg_background extension | Native connections simpler, pg_background requires extension installation |
| Svix verification | Custom HMAC | Svix is official Resend method, handles timing attacks correctly |

**Installation:**
```bash
# Playwright already installed in maguey-pass-lounge
cd maguey-pass-lounge
npx playwright install chromium

# No additional dependencies needed - use native PostgreSQL connections
# Svix already in supabase/functions/resend-webhook/index.ts
```

## Architecture Patterns

### Recommended Test File Structure
```
maguey-pass-lounge/
├── playwright/
│   ├── tests/
│   │   ├── checkout.spec.ts           # Existing GA checkout
│   │   ├── vip-checkout.spec.ts       # NEW: VIP checkout flow
│   │   ├── vip-floor-plan.spec.ts     # NEW: Realtime updates
│   │   └── vip-concurrent.spec.ts     # NEW: Race condition tests
│   ├── fixtures/
│   │   ├── vip-seed.ts                # NEW: Database seeding fixture
│   │   └── auth.ts                    # NEW: Auth fixture
│   └── .auth-state.json               # Existing auth state
├── supabase/
│   └── seed/
│       ├── 01-events.sql              # Event data
│       ├── 02-vip-tables.sql          # VIP table inventory
│       └── 03-vip-test-data.sql       # NEW: Complete VIP test scenario
└── tests/
    └── manual/
        ├── vip-scanner-uat.md         # NEW: Scanner UAT script
        └── vip-reentry-uat.md         # NEW: Re-entry UAT script
```

### Pattern 1: Playwright Fixture-Based Database Seeding
**What:** Worker-scoped fixtures that seed database before tests, clean up after
**When to use:** Any test requiring specific database state (VIP tables, reservations)
**Example:**
```typescript
// Source: https://playwright.dev/docs/test-fixtures
// playwright/fixtures/vip-seed.ts
import { test as base } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

type VipFixtures = {
  vipTestData: {
    eventId: string;
    tableId: string;
    reservationId: string;
    guestPassTokens: string[];
  };
};

export const test = base.extend<{}, VipFixtures>({
  vipTestData: [async ({}, use) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Setup: Create test event (future date to ensure active)
    const { data: event } = await supabase
      .from('events')
      .insert({
        name: 'VIP E2E Test Event',
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        time: '22:00:00',
        genre: 'Reggaeton',
        venue_name: 'Test Venue',
        city: 'Test City'
      })
      .select()
      .single();

    // Create VIP table for this event
    const { data: table } = await supabase
      .from('event_vip_tables')
      .insert({
        event_id: event.id,
        table_name: 'Premium Test Table',
        tier: 'premium',
        price: 750,
        guest_capacity: 8
      })
      .select()
      .single();

    // Provide to tests
    await use({
      eventId: event.id,
      tableId: table.id,
      reservationId: '', // Filled by test
      guestPassTokens: [] // Filled after checkout
    });

    // Cleanup: Delete test data
    await supabase.from('events').delete().eq('id', event.id);
  }, { scope: 'worker' }]
});
```

### Pattern 2: URL Parameter QR Testing
**What:** Pass QR token via URL parameter to bypass camera requirement
**When to use:** Automated scanner tests, CI/CD environments without camera access
**Example:**
```typescript
// Source: Existing VIPScanner.tsx (line 127-146) + https://qaautomation.expert/2026/01/06/mastering-query-parameters-in-playwright-api-tests/
// VIPScanner.tsx already parses QR tokens from handleQRCode callback
// Add URL parameter detection before camera initialization

test('VIP guest pass scans successfully', async ({ page, vipTestData }) => {
  // Construct URL with QR token as query parameter
  const qrToken = vipTestData.guestPassTokens[0];
  await page.goto(`/scanner?qr=${encodeURIComponent(qrToken)}`);

  // Wait for scan processing
  await page.waitForSelector('text=/checked in successfully/i');

  // Verify success message
  await expect(page.getByText(/Guest 1 of 8 checked in successfully!/i)).toBeVisible();
});
```

### Pattern 3: PostgreSQL Concurrent Transaction Testing
**What:** Multiple parallel connections calling same RPC to test race conditions
**When to use:** Testing VIP check-in concurrency, capacity limits, duplicate prevention
**Example:**
```typescript
// Source: https://www.doppler.com/blog/reliably-testing-race-conditions + https://sqlpey.com/sql/postgresql-concurrent-tag-insertion-race-conditions/
// tests/vip-concurrent.spec.ts
import { createClient } from '@supabase/supabase-js';

test('concurrent VIP check-ins handled correctly', async ({ vipTestData }) => {
  // Create 5 separate Supabase clients (separate connections)
  const clients = Array.from({ length: 5 }, () =>
    createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  );

  const guestPassIds = vipTestData.guestPassTokens.slice(0, 5);

  // Call process_vip_scan_with_reentry concurrently
  const results = await Promise.allSettled(
    clients.map((client, idx) =>
      client.rpc('process_vip_scan_with_reentry', {
        p_pass_id: guestPassIds[idx],
        p_scanned_by: 'test-user'
      })
    )
  );

  // Verify all succeeded (no race condition errors)
  results.forEach(result => {
    expect(result.status).toBe('fulfilled');
  });

  // Verify checked_in_guests count is exactly 5
  const { data: reservation } = await clients[0]
    .from('vip_reservations')
    .select('checked_in_guests')
    .eq('id', vipTestData.reservationId)
    .single();

  expect(reservation.checked_in_guests).toBe(5);

  // Verify no duplicate scan logs
  const { data: logs } = await clients[0]
    .from('vip_scan_logs')
    .select('id')
    .eq('reservation_id', vipTestData.reservationId);

  expect(logs?.length).toBe(5);
});
```

### Pattern 4: Resend Webhook Verification Testing
**What:** Verify webhook signature using Svix, test delivery status updates
**When to use:** Email delivery confirmation tests, webhook endpoint validation
**Example:**
```typescript
// Source: Existing resend-webhook/index.ts + https://resend.com/blog/webhooks + https://www.svix.com/blog/using-resend-webhooks-for-email-status-alerts/
// Webhook handler already implements correct pattern (lines 59-81)
// Test pattern:

test('VIP reservation email delivery confirmed', async ({ page, vipTestData }) => {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Complete VIP checkout (triggers email)
  // ... checkout steps ...

  // Poll email_queue for resend_email_id
  let emailId: string | null = null;
  for (let i = 0; i < 30; i++) {
    const { data } = await supabase
      .from('email_queue')
      .select('resend_email_id, status')
      .eq('reservation_id', vipTestData.reservationId)
      .eq('email_type', 'vip_confirmation')
      .single();

    if (data?.resend_email_id && data.status === 'sent') {
      emailId = data.resend_email_id;
      break;
    }
    await page.waitForTimeout(1000);
  }

  expect(emailId).toBeTruthy();

  // Wait for webhook delivery event (up to 60s)
  for (let i = 0; i < 60; i++) {
    const { data } = await supabase
      .from('email_delivery_status')
      .select('event_type')
      .eq('resend_email_id', emailId!)
      .eq('event_type', 'email.delivered')
      .maybeSingle();

    if (data) {
      // Success - email delivered
      return;
    }
    await page.waitForTimeout(1000);
  }

  throw new Error('Email delivery webhook not received within 60s');
});
```

### Pattern 5: Idempotent SQL Seed Scripts
**What:** SQL scripts that can be run multiple times without errors, using ON CONFLICT
**When to use:** Test data setup, development environment seeding
**Example:**
```sql
-- Source: https://supabase.com/docs/guides/local-development/seeding-your-database + https://kmoppel.github.io/2022-12-23-generating-lots-of-test-data-with-postgres-fast-and-faster/
-- supabase/seed/03-vip-test-data.sql

-- Create test event (idempotent)
INSERT INTO events (id, name, date, time, genre, venue_name, city)
VALUES (
  '99999999-9999-9999-9999-999999999999',
  'VIP Test Event',
  (CURRENT_DATE + INTERVAL '30 days')::date,
  '22:00:00',
  'Reggaeton',
  'Test Venue',
  'Test City'
)
ON CONFLICT (id) DO UPDATE SET
  date = EXCLUDED.date,
  updated_at = NOW();

-- Create VIP tables for test event (3 tiers)
INSERT INTO event_vip_tables (id, event_id, table_name, tier, price, guest_capacity, is_active)
VALUES
  ('11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999999', 'Test Premium Table', 'premium', 750, 8, true),
  ('22222222-2222-2222-2222-222222222222', '99999999-9999-9999-9999-999999999999', 'Test Front Row Table', 'front_row', 700, 6, true),
  ('33333333-3333-3333-3333-333333333333', '99999999-9999-9999-9999-999999999999', 'Test Standard Table', 'standard', 600, 6, true)
ON CONFLICT (id) DO NOTHING;

-- Create confirmed VIP reservation with guest passes
INSERT INTO vip_reservations (id, event_id, table_id, status, host_name, host_email, total_guests, checked_in_guests)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '99999999-9999-9999-9999-999999999999',
  '11111111-1111-1111-1111-111111111111',
  'confirmed',
  'Test Host',
  '[email protected]',
  8,
  0
)
ON CONFLICT (id) DO UPDATE SET status = 'confirmed', checked_in_guests = 0;

-- Create 8 guest passes with QR tokens
-- Using generate_series for scalability
INSERT INTO vip_guest_passes (id, reservation_id, guest_number, qr_token, qr_signature, status)
SELECT
  gen_random_uuid(),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  gs.n,
  'VIP-TEST-GUEST-' || LPAD(gs.n::text, 2, '0'),
  encode(hmac('VIP-TEST-GUEST-' || LPAD(gs.n::text, 2, '0'), 'test-secret', 'sha256'), 'hex'),
  'active'
FROM generate_series(1, 8) AS gs(n)
ON CONFLICT (qr_token) DO NOTHING;

-- Output QR tokens for manual testing
SELECT
  'QR Tokens for manual scanner testing:' AS info,
  qr_token,
  guest_number
FROM vip_guest_passes
WHERE reservation_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
ORDER BY guest_number;
```

### Pattern 6: Supabase Realtime Testing
**What:** Test that UI updates when database changes (floor plan showing bookings)
**When to use:** VIP floor plan realtime updates, availability changes
**Example:**
```typescript
// Source: https://github.com/isaacharrisholt/supawright + https://hackceleration.com/supabase-review/
// Supabase realtime handles 10K+ concurrent connections with websockets

test('floor plan updates when VIP table booked', async ({ page, vipTestData }) => {
  // Navigate to VIP tables page
  await page.goto(`/vip-tables/${vipTestData.eventId}`);

  // Verify initial state - table available
  const tableCard = page.locator(`[data-table-id="${vipTestData.tableId}"]`);
  await expect(tableCard).not.toHaveClass(/reserved/);

  // Simulate booking in database (direct DB update to trigger realtime)
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await supabase
    .from('vip_reservations')
    .insert({
      event_id: vipTestData.eventId,
      table_id: vipTestData.tableId,
      status: 'confirmed',
      host_name: 'Realtime Test',
      host_email: '[email protected]'
    });

  // Wait for realtime update to reflect in UI (Supabase realtime is fast)
  await expect(tableCard).toHaveClass(/reserved/, { timeout: 5000 });
});
```

### Anti-Patterns to Avoid
- **Hard-coded test data IDs:** Use fixtures or generate UUIDs to avoid conflicts
- **Waiting for arbitrary timeouts:** Use Playwright's auto-waiting and expect with timeout
- **Testing Stripe production API:** Always use test mode and test cards (4242 4242 4242 4242)
- **Ignoring webhook signature verification:** Always verify Svix signatures in production code
- **Non-idempotent seed scripts:** Always use `ON CONFLICT DO NOTHING` or `IF NOT EXISTS`

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Webhook signature verification | Custom HMAC verification | Svix library (already in code) | Handles timing attacks, key rotation, proper comparison |
| Concurrent transaction testing | Custom locking/mutex logic | PostgreSQL SERIALIZABLE isolation + multiple connections | Database handles conflicts correctly, prevents data corruption |
| Test data cleanup | Manual DELETE statements | Playwright fixtures with scope: 'worker' | Automatic cleanup, runs once per worker, prevents leaks |
| QR code generation for tests | Image generation libraries | URL parameter `?qr=TOKEN` | Bypasses camera requirement, faster, works in CI |
| Email delivery verification | Polling email providers | Resend webhook + email_delivery_status table | Real delivery confirmation, audit trail, already implemented |
| Database seeding | ORM seeders or custom scripts | SQL files with ON CONFLICT | Database-native, idempotent, version-controlled with migrations |

**Key insight:** Testing concurrent database operations and webhooks involves complex edge cases (timing attacks, race conditions, signature rotation). Use battle-tested libraries (Svix) and database primitives (SERIALIZABLE isolation, multiple connections) rather than custom solutions.

## Common Pitfalls

### Pitfall 1: Stripe Test Cards Not Working in Different Scenarios
**What goes wrong:** Using 4242 4242 4242 4242 for all tests, missing error scenarios
**Why it happens:** Developers only test happy path, don't use Stripe's simulation cards
**How to avoid:** Use specific test cards for different scenarios:
- Success: 4242 4242 4242 4242
- Decline: 4000 0000 0000 0002
- Insufficient funds: 4000 0000 0000 9995
- Expired card: 4000 0000 0000 0069
**Warning signs:** Tests only pass with successful payments, error handling untested

### Pitfall 2: Race Condition Tests That Don't Actually Race
**What goes wrong:** Concurrent tests run sequentially, don't expose race conditions
**Why it happens:** Using `await` inside loops instead of `Promise.allSettled`
**How to avoid:** Always use `Promise.allSettled` or `Promise.all` for concurrent operations:
```typescript
// BAD: Sequential
for (const client of clients) {
  await client.rpc('process_vip_scan_with_reentry', { p_pass_id: id });
}

// GOOD: Concurrent
await Promise.allSettled(
  clients.map(client => client.rpc('process_vip_scan_with_reentry', { p_pass_id: id }))
);
```
**Warning signs:** Race condition tests always pass, no transaction conflicts logged

### Pitfall 3: Webhook Tests Timing Out
**What goes wrong:** Tests fail because webhook not received within timeout
**Why it happens:** Resend delivery can take 10-60 seconds, tests use 5s timeout
**How to avoid:** Use polling with generous timeout (60s+) for webhook events:
```typescript
// Poll every 1s for up to 60s
for (let i = 0; i < 60; i++) {
  const { data } = await supabase
    .from('email_delivery_status')
    .select('event_type')
    .eq('resend_email_id', emailId)
    .eq('event_type', 'email.delivered')
    .maybeSingle();

  if (data) return; // Success
  await page.waitForTimeout(1000);
}
```
**Warning signs:** Tests fail intermittently with "email.delivered not received"

### Pitfall 4: Non-Idempotent Seed Scripts
**What goes wrong:** Running seed script twice causes duplicate key errors
**Why it happens:** Using `INSERT` without `ON CONFLICT` clause
**How to avoid:** Always use `ON CONFLICT DO NOTHING` or `DO UPDATE SET`:
```sql
-- BAD: Fails on second run
INSERT INTO events (id, name) VALUES ('123', 'Test Event');

-- GOOD: Idempotent
INSERT INTO events (id, name) VALUES ('123', 'Test Event')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW();
```
**Warning signs:** "duplicate key value violates unique constraint" errors

### Pitfall 5: Testing Against Stale Migrations
**What goes wrong:** Tests fail because VIP RPCs don't exist on remote database
**Why it happens:** Migrations applied locally but not pushed to Supabase remote
**How to avoid:** Always verify migrations before testing:
```bash
# Check local vs remote migration status
supabase db diff --linked

# If differences exist, push migrations
supabase db push
```
**Warning signs:** "function does not exist" errors for RPCs like `process_vip_scan_with_reentry`

### Pitfall 6: URL Parameter Security Risk
**What goes wrong:** Production scanner accepts `?qr=TOKEN` parameter, bypasses validation
**Why it happens:** Test-only feature not gated behind environment variable
**How to avoid:** Gate URL parameter feature behind test mode:
```typescript
// In VIPScanner.tsx
useEffect(() => {
  // Only in development/test
  if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
    const params = new URLSearchParams(window.location.search);
    const qrParam = params.get('qr');
    if (qrParam) {
      handleQRCode(qrParam);
    }
  }
}, []);
```
**Warning signs:** QR parameter works in production build

## Code Examples

Verified patterns from official sources and existing codebase:

### VIP Checkout E2E Test
```typescript
// Source: Existing checkout.spec.ts (lines 1-70) + BrowserStack Playwright best practices
// playwright/tests/vip-checkout.spec.ts
import { test, expect } from '@playwright/test';
import { test as vipTest } from '../fixtures/vip-seed';

vipTest('VIP table checkout completes successfully', async ({ page, vipTestData }) => {
  // Navigate to VIP tables page
  await page.goto(`/vip-tables/${vipTestData.eventId}`);

  // Wait for tables to load
  await expect(page.getByRole('heading', { name: /vip tables/i })).toBeVisible();

  // Select first available premium table
  const premiumTable = page.locator('[data-tier="premium"]').first();
  await expect(premiumTable).toBeVisible();
  await premiumTable.click();

  // Proceed to checkout
  await page.getByRole('button', { name: /book table/i }).click();
  await page.waitForURL('**/vip-checkout**');

  // Fill guest information
  await page.getByLabel('Host name').fill('Test Host');
  await page.getByLabel('Email').fill('[email protected]');
  await page.getByLabel('Number of guests').fill('8');

  // Optional: Link GA tickets (test can skip for basic flow)

  // Proceed to payment
  await page.getByRole('button', { name: /continue to payment/i }).click();
  await page.waitForURL('**/payment**');

  // Fill Stripe test card
  await page.getByLabel('Email address').fill('[email protected]');
  await page.getByLabel('Card number').fill('4242 4242 4242 4242');
  await page.getByLabel('Expiration date').fill('12/30');
  await page.getByLabel('Security code').fill('123');
  await page.getByLabel('First name').fill('Test');
  await page.getByLabel('Last name').fill('Host');

  // Complete purchase
  await page.getByRole('button', { name: /complete purchase/i }).click();

  // Verify success
  await expect(
    page.getByRole('heading', { name: /reservation confirmed/i })
  ).toBeVisible({ timeout: 30000 }); // Stripe can take up to 30s

  // Verify QR codes displayed
  await expect(page.getByText(/guest pass/i)).toBeVisible();
  await expect(page.locator('[data-qr-code]')).toHaveCount(8); // 8 guest passes
});
```

### Scanner URL Parameter Implementation
```typescript
// Source: Existing VIPScanner.tsx + https://playwrightsolutions.com/how-do-you-append-query-parameters-to-page-goto-using-playwright-test/
// maguey-gate-scanner/src/components/vip/VIPScanner.tsx
// Add to VIPScanner component after line 344 (in useEffect):

useEffect(() => {
  // Test-only: Accept QR token via URL parameter
  if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
    const params = new URLSearchParams(window.location.search);
    const qrParam = params.get('qr');

    if (qrParam) {
      console.log('[TEST MODE] Processing QR from URL parameter:', qrParam);
      handleQRCode(qrParam);

      // Clear parameter from URL to avoid re-processing
      const url = new URL(window.location.href);
      url.searchParams.delete('qr');
      window.history.replaceState({}, '', url.toString());
    }
  }
}, []);
```

### Migration Verification Script
```typescript
// Source: Phase 4 UAT experience + PostgreSQL best practices
// tests/verify-vip-migrations.ts
import { createClient } from '@supabase/supabase-js';

const REQUIRED_RPCS = [
  'check_vip_linked_ticket_reentry',
  'process_vip_scan_with_reentry',
  'scan_ticket_atomic',
  'increment_vip_checked_in',
  'create_unified_vip_checkout',
  'verify_vip_pass_signature',
  'link_ticket_to_vip',
  'check_vip_capacity'
];

async function verifyMigrations() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const results = await Promise.all(
    REQUIRED_RPCS.map(async (rpcName) => {
      try {
        // Test call with invalid params to check existence
        await supabase.rpc(rpcName as any, {});
        return { rpc: rpcName, exists: true };
      } catch (error: any) {
        // "function does not exist" = missing
        // Other errors = exists but params wrong (expected)
        const exists = !error.message.includes('function') && !error.message.includes('does not exist');
        return { rpc: rpcName, exists, error: error.message };
      }
    })
  );

  const missing = results.filter(r => !r.exists);

  if (missing.length > 0) {
    console.error('❌ Missing VIP RPCs:');
    missing.forEach(r => console.error(`  - ${r.rpc}: ${r.error}`));
    console.error('\nRun: supabase db push');
    process.exit(1);
  }

  console.log('✅ All VIP RPCs verified on remote database');
  results.forEach(r => console.log(`  ✓ ${r.rpc}`));
}

verifyMigrations();
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Selenium for E2E | Playwright | 2023-2024 | Auto-waiting, better API testing, multi-context support |
| dblink for autonomous transactions | pg_background extension | 2020+ | Cleaner API, better performance, modern Postgres |
| Manual webhook testing | Svix signature verification | 2023+ | Security best practice, prevents spoofing |
| beforeEach/afterEach hooks | Playwright fixtures | 2021+ | Better encapsulation, automatic cleanup, composability |
| Custom retry logic | Playwright auto-retry | 2021+ | Built-in exponential backoff, configurable per-test |

**Deprecated/outdated:**
- **Puppeteer for E2E:** Playwright has better cross-browser support and API testing
- **cypress-recurse for polling:** Playwright's `expect` with `{ timeout }` handles retries natively
- **Manual Stripe webhook mocking:** Use Stripe CLI `stripe listen --forward-to` for local testing

## Open Questions

Things that couldn't be fully resolved:

1. **pg_background availability on Supabase hosted platform**
   - What we know: Extension exists, Cloud SQL supports background worker mode
   - What's unclear: Whether Supabase enables it by default or requires manual installation
   - Recommendation: Use native multiple connections for concurrency testing (no extension needed)

2. **Resend webhook delivery time SLA**
   - What we know: email.delivered events arrive within seconds to minutes
   - What's unclear: Guaranteed maximum delivery time for webhook events
   - Recommendation: Use 60-120s timeout for webhook tests, log timing for metrics

3. **VIPScanner URL parameter security in production**
   - What we know: Scanner should only accept camera-scanned QRs in production
   - What's unclear: Whether environment gating is sufficient or if feature flag needed
   - Recommendation: Gate behind `import.meta.env.DEV || import.meta.env.MODE === 'test'`

4. **Optimal worker count for Playwright parallel execution**
   - What we know: Workers share database via worker-scoped fixtures
   - What's unclear: How many workers safe with concurrent VIP checkout tests
   - Recommendation: Start with 1 worker (`--workers=1`), increase if tests isolated properly

## Sources

### Primary (HIGH confidence)
- Playwright Official Docs - Fixtures: https://playwright.dev/docs/test-fixtures
- Playwright Official Docs - Mocking: https://playwright.dev/docs/mock
- Existing maguey-pass-lounge codebase:
  - `playwright.config.ts` - Configured with baseURL, auth state
  - `playwright/tests/checkout.spec.ts` - GA checkout pattern
  - `maguey-gate-scanner/src/components/vip/VIPScanner.tsx` - QR handling logic
  - `supabase/functions/resend-webhook/index.ts` - Svix verification implementation
  - `supabase/migrations/20250115000002_seed_events.sql` - Seed pattern example

### Secondary (MEDIUM confidence)
- [BrowserStack: 15 Best Practices for Playwright testing in 2026](https://www.browserstack.com/guide/playwright-best-practices) - Test isolation, auto-waiting
- [QA Automation Expert: Mastering Query Parameters in Playwright API Tests](https://qaautomation.expert/2026/01/06/mastering-query-parameters-in-playwright-api-tests/) - URL parameter patterns
- [Playwright Solutions: How Do You Append Query Parameters](https://playwrightsolutions.com/how-do-you-append-query-parameters-to-page-goto-using-playwright-test/) - URL construction
- [Stripe Official Docs: Automated Testing](https://docs.stripe.com/automated-testing) - Test cards, payment simulation
- [Supabase Docs: Seeding Your Database](https://supabase.com/docs/guides/local-development/seeding-your-database) - SQL seed patterns
- [Resend Blog: Webhooks](https://resend.com/blog/webhooks) - Event types, verification
- [Svix Blog: Using Resend Webhooks for Email Status Alerts](https://www.svix.com/blog/using-resend-webhooks-for-email-status-alerts/) - Webhook testing patterns

### Tertiary (LOW confidence)
- [PostgreSQL Concurrent Tag Insertion: Preventing Race Conditions](https://sqlpey.com/sql/postgresql-concurrent-tag-insertion-race-conditions/) - SERIALIZABLE isolation examples
- [Doppler Blog: Reliably Testing Race Conditions](https://www.doppler.com/blog/reliably-testing-race-conditions) - Concurrent testing strategies
- [Supawright GitHub](https://github.com/isaacharrisholt/supawright) - Supabase-specific test harness (not needed, native Supabase client sufficient)
- [pg_background Extension Analysis](https://db.cs.cmu.edu/pgexts-vldb2025/pg_background.html) - Extension capabilities (alternative to multiple connections)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Playwright, PostgreSQL, Svix all verified in existing codebase
- Architecture: HIGH - Patterns derived from existing checkout.spec.ts and VIPScanner.tsx implementation
- Pitfalls: MEDIUM - Based on common E2E testing issues and Phase 4 UAT learnings, not project-specific failures

**Research date:** 2026-01-31
**Valid until:** 2026-02-28 (30 days - Playwright and testing patterns stable)

## Notes for Planner

1. **Migration verification is CRITICAL** - Phase 4 UAT showed 5/8 tests blocked by unapplied migrations. Plan 09-01 MUST verify all RPCs exist before any testing begins.

2. **Hybrid testing approach decided in CONTEXT.md** - Playwright for checkout/floor plan, manual UAT for scanner. Plans should follow this split.

3. **URL parameter implementation is minimal** - VIPScanner already parses tokens in `handleQRCode`, just need to read from URL params and call that function.

4. **Existing checkout.spec.ts is excellent template** - Lines 1-70 show full GA checkout flow, VIP version follows same pattern with different selectors.

5. **Resend webhook handler already correct** - Lines 59-81 of resend-webhook/index.ts show proper Svix verification, no changes needed. Tests just need to poll `email_delivery_status` table.

6. **Seed script should output tokens** - Use `SELECT` at end of seed script to print QR tokens for manual UAT (see Pattern 5 example).

7. **Worker-scoped fixtures prevent test pollution** - Each worker gets isolated database state, cleanup automatic. Use `{ scope: 'worker' }` for expensive setup like event/table creation.
