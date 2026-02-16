# Testing Patterns

**Analysis Date:** 2026-01-29

## Test Framework

**Runner:**
- Vitest 2.1.8
- Config: `vitest.config.ts` in each project directory
- Environment: `jsdom` (DOM simulation for browser tests)
- Setup file: `src/setupTests.ts` (imports `@testing-library/jest-dom`)

**Assertion Library:**
- Vitest built-in expect API
- @testing-library/jest-dom matchers (toBeInTheDocument, etc.)
- @testing-library/react for React component testing

**Run Commands:**
```bash
npm test                    # Run all tests once
npm run test:unit           # Run unit tests only (exclude integration)
npm run test:integration    # Run integration tests only
npm run test:all            # Explicitly run all tests
npm run test:coverage       # Generate coverage report
npm run test:watch          # Watch mode (re-run on file changes)
```

**Coverage:**
- Provider: v8
- Reporters: text, json, html
- Excluded from coverage:
  - `node_modules/`
  - `src/setupTests.ts`
  - `**/*.d.ts`
  - `**/*.test.ts`
  - `**/test-utils.ts`
- Generate with: `npm run test:coverage`
- Output: HTML report in `coverage/` directory

**Environment Configuration:**
- Mock environment variables for tests defined in `vitest.config.ts`
- Key test env vars:
  - `VITE_SUPABASE_URL`: `https://test.supabase.co`
  - `VITE_SUPABASE_ANON_KEY`: `test-anon-key`
  - `VITE_QR_SIGNING_SECRET`: `test-qr-signing-secret-for-unit-tests`
  - `VITE_STRIPE_WEBHOOK_SECRET`: `test_webhook_secret`

**Timeouts:**
- Test timeout: 30 seconds
- Hook timeout: 30 seconds (setup/teardown)

## Test File Organization

**Location:**
- Co-located with source files
- Unit tests: `src/**/__tests__/` or `src/lib/__tests__/`
- Integration tests: `src/__tests__/integration/`
- E2E tests: `playwright/tests/`

**Naming:**
- Unit test files: `[source-name].test.ts`
- Integration test files: `[feature].test.ts`
- E2E test files: `[feature].spec.ts`
- Helper files: `test-utils.ts`, `setup-integration.ts`

**Structure:**
```
src/
├── lib/
│   ├── orders-service.ts          # Implementation
│   └── __tests__/
│       ├── orders-service.test.ts  # Unit tests
│       ├── test-utils.ts           # Mock factories
│       └── pagination.test.ts      # Related tests
├── __tests__/
│   ├── integration/
│   │   ├── event-availability.test.ts
│   │   ├── order-flow.test.ts
│   │   └── webhook-processing.test.ts
│   └── setup-integration.ts        # Integration test setup
└── setupTests.ts                   # Global test setup
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

describe('Feature Name (Integration)', () => {
  beforeAll(async () => {
    // Setup database connection, seed data
    await setupTestDatabase();
  });

  afterAll(async () => {
    // Cleanup
    await cleanupTestDatabase();
  });

  beforeEach(() => {
    // Reset state before each test
    resetTestTracking();
  });

  describe('Nested Feature', () => {
    it('should do something specific', async () => {
      // Arrange: Setup test data
      const { event, ticketTypes } = await seedTestEvent({
        ticketTypes: [{ name: 'GA', price: 50, fee: 5, totalInventory: 100 }],
      });

      // Act: Perform the action
      const availability = await checkAvailabilityBatch([ticketTypeIds[0]]);

      // Assert: Verify results
      expect(availability.ticketTypes.get(ticketTypeIds[0])?.available).toBe(100);
    });
  });
});
```

**Patterns:**

**Setup Pattern:**
- `beforeAll()`: Database/resource initialization (runs once per describe block)
- `beforeEach()`: Reset state/counters (runs before each test)
- `afterAll()`: Cleanup (runs once after all tests in describe block)

**Teardown Pattern:**
- Call cleanup functions in `afterAll()`
- Reset mocks with `vi.resetAllMocks()`
- Reset counters with `resetCounters()`

**Assertion Pattern:**
- Use descriptive test names ending with "should"
- Group related assertions in one test
- Test happy path, edge cases, and error cases separately

**Async Testing:**
```typescript
it('should update availability after purchase', async () => {
  const { event, ticketTypes } = await seedTestEvent({
    ticketTypes: [{ name: 'GA', price: 50, fee: 5, totalInventory: 100 }],
  });

  const ticketTypeId = ticketTypes[0].id;

  // Check initial state
  const initialAvailability = await getTicketTypeAvailability(ticketTypeId);
  expect(initialAvailability.available).toBe(100);

  // Perform async operation
  await createTestOrder({
    eventId: event.id,
    ticketTypeIds: [ticketTypeId],
    quantities: [10],
  });

  // Verify changed state
  const updatedAvailability = await getTicketTypeAvailability(ticketTypeId);
  expect(updatedAvailability.available).toBe(90);
});
```

## Mocking

**Framework:** Vitest's `vi` module (similar to Jest)

**Patterns:**

**Mock Functions:**
```typescript
import { vi } from 'vitest';

const mockFetch = vi.fn();
const mockCallback = vi.fn().mockResolvedValue({ data: [] });

// Assert calls
expect(mockCallback).toHaveBeenCalledWith(expectedArg);
expect(mockCallback).toHaveBeenCalledTimes(1);
```

**Mock Factories:**
```typescript
// Located in src/lib/__tests__/test-utils.ts
export function createMockEvent(overrides: Partial<MockEvent> = {}): MockEvent {
  const id = overrides.id ?? `event-${++eventCounter}`;
  const now = new Date().toISOString();

  return {
    id,
    name: `Test Event ${eventCounter}`,
    description: 'A test event for unit testing',
    event_date: '2025-06-15',
    status: 'published',
    is_active: true,
    created_at: now,
    updated_at: now,
    ...overrides,  // Allow overriding defaults
  };
}
```

**Mock Supabase Client:**
```typescript
export function createMockSupabaseClient() {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
      update: vi.fn().mockResolvedValue({ data: {}, error: null }),
      delete: vi.fn().mockResolvedValue({ data: {}, error: null }),
    }),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  };
}
```

**What to Mock:**
- External service calls (Stripe, Supabase, APIs)
- Database operations (in unit tests; use real DB in integration tests)
- Time-dependent functions (use `vi.useFakeTimers()`)
- Complex dependencies when testing specific units
- File system operations

**What NOT to Mock:**
- Core business logic functions
- Pure utility functions
- Internal service calls (test them together)
- In integration tests: actual database (use test database)

## Fixtures and Factories

**Test Data Creation:**

**Mock Factories Location:**
- `src/lib/__tests__/test-utils.ts` - For orders/business logic
- `src/__tests__/setup-integration.ts` - For integration tests

**Factory Pattern:**
```typescript
let eventCounter = 0;

export function resetCounters(): void {
  eventCounter = 0;
}

export function createMockEvent(overrides: Partial<MockEvent> = {}): MockEvent {
  const id = overrides.id ?? `event-${++eventCounter}`;
  // ... return mock with defaults + overrides
}

// Usage in tests:
beforeEach(() => {
  resetCounters();
});

it('should handle multiple events', () => {
  const event1 = createMockEvent({ name: 'Event 1' });
  const event2 = createMockEvent({ name: 'Event 2' });
  // event1.id === 'event-1', event2.id === 'event-2'
});
```

**Data Builders:**
```typescript
export interface MockEvent {
  id: string;
  name: string;
  price: number;
  total_inventory: number;
  tickets_sold: number;
  // ... fields
}

// Sensible defaults + override capability
const defaultEvent = {
  status: 'published',
  is_active: true,
  tickets_sold: 0,
  created_at: now,
  updated_at: now,
};
```

**Integration Test Helpers:**
```typescript
// From src/__tests__/setup-integration.ts
export async function setupTestDatabase(): Promise<void> {
  // Initialize test database connection
}

export async function cleanupTestDatabase(): Promise<void> {
  // Delete test data and cleanup
}

export async function seedTestEvent(options: {
  name?: string;
  status?: string;
  isActive?: boolean;
  ticketTypes?: Array<{
    name: string;
    price: number;
    fee: number;
    totalInventory?: number;
  }>;
}): Promise<{ event: Event; ticketTypes: TicketType[] }> {
  // Create event with optional ticket types
}
```

## Test Types

**Unit Tests:**
- Scope: Individual functions, classes, components
- Location: `src/**/__tests__/*.test.ts`
- Dependencies: Mocked
- Example: `orders-service.test.ts`, `query-optimizer.test.ts`

**Pattern:**
```typescript
describe('mapCheckoutSelectionToLineItems', () => {
  it('filters out zero-quantity tickets and maps to line items', () => {
    const selection: CheckoutSelectionRecord = {
      'ticket-1': { name: 'VIP', price: 100, fee: 15, quantity: 2 },
      'ticket-2': { name: 'GA', price: 50, fee: 10, quantity: 0 },
    };

    const result = mapCheckoutSelectionToLineItems(selection);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      ticketTypeId: 'ticket-1',
      quantity: 2,
      unitPrice: 100,
      unitFee: 15,
      displayName: 'VIP',
    });
  });
});
```

**Integration Tests:**
- Scope: Multiple components/services working together
- Location: `src/__tests__/integration/*.test.ts`
- Dependencies: Real database (test DB), mocked external services
- Example: `event-availability.test.ts`, `order-flow.test.ts`, `webhook-processing.test.ts`

**Pattern:**
```typescript
describe('Event Availability (Integration)', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  it('should update availability after purchase', async () => {
    // Create test data
    const { event, ticketTypes } = await seedTestEvent({
      ticketTypes: [{ name: 'GA', price: 50, fee: 5, totalInventory: 100 }],
    });

    // Test workflow: create order, verify availability updated
    const ticketTypeId = ticketTypes[0].id;
    const initialAvailability = await getTicketTypeAvailability(ticketTypeId);

    await createTestOrder({
      eventId: event.id,
      ticketTypeIds: [ticketTypeId],
      quantities: [10],
    });

    const updatedAvailability = await getTicketTypeAvailability(ticketTypeId);
    expect(updatedAvailability.available).toBe(initialAvailability.available - 10);
  });
});
```

**E2E Tests:**
- Framework: Playwright 1.45.3
- Location: `playwright/tests/`
- Pattern: `.spec.ts` files
- Example: `checkout.spec.ts`
- Browser-based testing of user flows
- Not included in main npm test suite (separate commands)

## Error Testing

**Testing Success Cases:**
```typescript
it('should create order successfully', async () => {
  const result = await createOrder(validOrderData);

  expect(result.success).toBe(true);
  expect(result.orderId).toBeDefined();
  expect(result.tickets).toHaveLength(2);
});
```

**Testing Error Cases:**
```typescript
it('should throw InsufficientInventoryError when not enough tickets', async () => {
  const order = await createTestOrder({
    eventId: event.id,
    ticketTypeIds: [ticketTypeId],
    quantities: [100], // More than available
  });

  expect(order.error).toBeInstanceOf(InsufficientInventoryError);
  expect(order.error?.ticketTypeName).toBe('GA');
  expect(order.error?.requested).toBe(100);
  expect(order.error?.available).toBe(50);
});
```

**Testing Async Errors:**
```typescript
it('should handle network errors gracefully', async () => {
  const mockFetch = vi.fn().mockRejectedValue(new TypeError('Network error'));

  try {
    await callApiWithMockedFetch();
    expect.fail('Should have thrown');
  } catch (error) {
    expect(error).toBeInstanceOf(TypeError);
    expect(error.message).toContain('Network error');
  }
});
```

## Common Testing Utilities

**Helper Functions in test-utils.ts:**
```typescript
// Signature generation for QR codes
export function generateQRSignature(token: string): string {
  return bytesToHex(hmac(sha256, utf8ToBytes(token), utf8ToBytes(secret)));
}

// Generate mock QR token
export function generateMockQRToken(): string {
  return `test-token-${Math.random().toString(36).slice(2)}`;
}

// Validate QR signature
export function validateQRSignature(token: string, signature: string): boolean {
  const expected = generateQRSignature(token);
  return signature === expected;
}

// Run operations concurrently
export async function runConcurrently<T>(
  operations: Array<() => Promise<T>>,
  concurrency: number = 5
): Promise<T[]> {
  // Implementation of concurrent execution with limit
}

// Assertion helpers
export function expectOk<T>(result: Result<T>): T {
  if (!result.ok) {
    throw new Error(`Expected ok, got error: ${result.error}`);
  }
  return result.value;
}

export function expectErr<E>(result: Result<any, E>): E {
  if (result.ok) {
    throw new Error('Expected error, got ok');
  }
  return result.error;
}
```

## Test Isolation and Cleanup

**Database Isolation:**
- Each integration test uses test database
- Data seeded per test or per suite
- Cleanup removes all test data after suite completes
- Counters reset with `resetCounters()` in `beforeEach`

**Environment Isolation:**
- Mock env vars defined in `vitest.config.ts`
- Real env vars not used in tests
- Mock clock with `vi.useFakeTimers()` when testing time-dependent code

**Test Independence:**
- No test should depend on another test's state
- Use `beforeEach` to reset state between tests
- Use unique IDs for test data (auto-incrementing counters)

---

*Testing analysis: 2026-01-29*
