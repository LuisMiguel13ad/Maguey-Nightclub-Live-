# Coding Conventions

**Analysis Date:** 2026-01-29

## Naming Patterns

**Files:**
- Kebab-case for utility/service files: `stripe.ts`, `supabase.ts`, `rate-limit-middleware.ts`, `circuit-breaker.ts`
- PascalCase for React components: `AuthContext.tsx`, `Navigation.tsx`, `VIPScanner.tsx`
- PascalCase for error classes: `OrderCreationError`, `InsufficientInventoryError`, `PaymentError`
- Lowercase with hyphens for test files: `orders-service.test.ts`, `event-availability.test.ts`

**Functions:**
- camelCase for all function names (public and private): `createLogger()`, `logOperation()`, `checkPaymentAvailability()`, `formatStripeError()`
- Action verbs as prefixes: `create`, `get`, `check`, `format`, `validate`, `calculate`, `handle`, `process`
- Async functions use the same naming: `async function createCheckoutSession()`
- Mock/test functions use `Mock` prefix: `createMockEvent()`, `createMockOrder()`, `generateMockQRToken()`

**Variables:**
- camelCase for local variables: `stripePublishableKey`, `supabaseUrl`, `ticketTypeId`, `eventCounter`
- ALL_CAPS for constants: `LOG_LEVELS`, `LEVEL_COLORS`, `RESET`
- Boolean variables use `is`, `has`, `can` prefixes: `isDevelopment`, `isAvailable`, `hasError`, `canProceed`
- Private class fields use underscore prefix: `_baseContext`, `_minLevel`

**Types:**
- PascalCase for all type/interface names: `LogEntry`, `Logger`, `AppError`, `VipReservation`, `StripeAvailabilityStatus`
- Use `Type` suffix for utility types: `CheckoutSelectionRecord`, `OrderLineItem`, `MockEvent`
- Interface definitions: `interface Logger`, `interface LogContext`, `type LogLevel`

**Exports:**
- Named exports for functions, types, and classes
- Default export only for React components and singleton instances (e.g., `logger`, `supabase`)

## Code Style

**Formatting:**
- ESLint + TypeScript ESLint for linting
- Config: `eslint.config.js` (flat config format)
- JavaScript target: ES2020
- Browser environment

**Linting:**
- Tool: ESLint 9.32.0 with TypeScript ESLint 8.38.0
- Extends: `@eslint/js` recommended + `typescript-eslint` recommended
- Plugins: `react-hooks`, `react-refresh`
- Disabled rules:
  - `@typescript-eslint/no-unused-vars`: off (allows intentional unused parameters)
- Enabled warnings:
  - `react-refresh/only-export-components`: warn (enforces component-only exports in HMR)
- All `.ts` and `.tsx` files are linted

**Indentation:** 2 spaces (inferred from code samples)

**Semicolons:** Always required at end of statements

**Quotes:** Single quotes for strings (enforced by ESLint)

## Import Organization

**Order:**
1. Third-party packages (React, Supabase, Stripe, etc.)
2. Relative imports from parent and sibling directories (`./`, `../`)
3. Path aliases (`@/`)
4. Type imports (when needed)

**Example:**
```typescript
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { checkPasswordBreach } from '@/lib/password-breach';
```

**Path Aliases:**
- `@/*` → `./src/*` (configured in `tsconfig.json`)
- Use `@/` prefix to reference src directory files from anywhere

## Error Handling

**Pattern:**
- Custom domain-specific error classes extending `AppError`: `OrderCreationError`, `PaymentError`, `ValidationError`, `InsufficientInventoryError`
- Each error class has a `code` property (string constant): `'ORDER_CREATION_FAILED'`, `'INSUFFICIENT_INVENTORY'`
- Errors include optional `details` object for debugging context
- Error classes defined in `src/lib/errors.ts`

**Usage:**
```typescript
export class OrderCreationError extends AppError {
  code = 'ORDER_CREATION_FAILED';

  constructor(message: string, details?: unknown) {
    super(message, 'ORDER_CREATION_FAILED', details);
    this.name = 'OrderCreationError';
  }
}
```

**Type Guard:**
- `isAppError(error): error is AppError` checks if error is application-specific
- `toAppError(error): AppError` converts unknown errors to AppError

**Circuit Breaker Pattern:**
- Payment and external API calls protected with circuit breaker for resilience
- Located in `src/lib/circuit-breaker.ts`
- States: `'CLOSED'` (normal), `'OPEN'` (failing), `'HALF_OPEN'` (recovering)
- Throws `CircuitBreakerError` when open
- Provides graceful fallback messages to users

**Async Error Handling:**
- Use try/catch blocks in async functions
- Log errors with context: `logger.error('Operation failed', error, { context })`
- Return error objects for control flow: `return { error }` (from `AuthContext`)
- Throw errors for exceptional cases that should propagate

## Logging

**Framework:** Custom structured logger (`src/lib/logger.ts`)

**Creating Loggers:**
- Default logger: `import { logger } from '@/lib/logger'`
- Module-specific: `const logger = createLogger({ module: 'orders' })`
- Request-scoped: `const reqLogger = createRequestLogger({ userId })`

**Log Levels:** `debug`, `info`, `warn`, `error`

**Structured Logging:**
```typescript
logger.debug('Creating checkout session', {
  eventId: orderData.eventId,
  ticketCount: orderData.tickets.length,
  total: orderData.totalAmount,
});

logger.error('Stripe circuit breaker is open', error, {
  state: error.state,
  circuitName: error.circuitName,
});
```

**Patterns:**
- All context passed as object: `logger.info('message', { key: value })`
- Development: Human-readable output with colors and context
- Production: JSON format for log aggregators
- Use `logger.time(label)` for performance tracking
- Use `logOperation()` for automatic timing and error handling

**Context Fields:**
- `requestId`: Unique request identifier
- `userId`: Authenticated user ID
- `eventId`: Event context
- `orderId`: Order context
- `ticketId`: Ticket context
- `module`: Code module/section name
- Custom context as needed

## Comments

**When to Comment:**
- Explain *why*, not *what*: Code shows what it does, comments explain design decisions
- Document non-obvious logic or workarounds
- Mark TODOs with reasoning: `// TODO: Implement phone authentication with SMS provider`
- Explain complex algorithms or calculations

**JSDoc/TSDoc:**
- Use for all public functions and exported types
- Include `@param`, `@returns`, `@example`, `@deprecated` tags
- Document purpose, parameters, and return value

**Example:**
```typescript
/**
 * Create Stripe Payment Intent
 * This calls your backend API to create a payment intent
 *
 * Protected by circuit breaker to prevent cascading failures when
 * the Stripe API or Edge Function is experiencing issues.
 */
export async function createCheckoutSession(orderData: {
  eventId: string;
  // ... parameters
}): Promise<{ url: string; sessionId: string; orderId: string }> {
```

**Section Headers:**
- Use comment blocks to organize large files:
```typescript
// ============================================
// STRIPE INITIALIZATION
// ============================================
```

## Function Design

**Size:**
- Keep functions focused on a single responsibility
- Prefer functions under 50 lines where practical
- Complex operations (e.g., `orders-service.ts`) can be 100-200+ lines with clear sections

**Parameters:**
- Use objects for multiple parameters (not tuples)
- Include type annotations with JSDoc examples
- Destructure parameters in function signature

**Example:**
```typescript
export async function createCheckoutSession(orderData: {
  eventId: string;
  tickets: Array<{
    ticketTypeId: string;
    quantity: number;
    unitPrice: number;
    unitFee: number;
    displayName: string;
  }>;
  customerEmail: string;
  customerName: string;
  totalAmount: number;
}): Promise<{ url: string; sessionId: string; orderId: string }>
```

**Return Values:**
- Return objects with descriptive keys: `{ url, sessionId, orderId }`
- Use result objects for error handling: `{ success: boolean; data?: T; error?: Error }`
- For async operations, return Promise of typed object
- Consistent interface for similar operations

**Default Parameters:**
- Use in function signature when sensible
- Document default values in JSDoc

## Module Design

**Exports:**
- Use named exports for utilities, services, and types
- One export per concept (e.g., one Logger per module)
- Export types and interfaces alongside implementations

**Service Modules:**
- Organize related functions in service files: `orders-service.ts`, `events-service.ts`, `vip-tables-service.ts`
- Each service handles one domain: orders, events, VIP tables
- Export utility functions alongside main service functions

**Barrel Files:**
- Located in `src/components/ui/` (shadcn UI components)
- Can export multiple related exports from one file
- Avoid for custom app code (prefer direct imports)

**Configuration and Constants:**
- Environment variables accessed via `import.meta.env.VITE_*` (Vite) or `process.env.*` (Node)
- Type constants: `type LogLevel = 'debug' | 'info' | 'warn' | 'error'`
- Configuration objects at module top with constants

**Example Service Structure:**
```typescript
// ============================================
// TYPES
// ============================================
export interface StripeAvailabilityStatus { /* ... */ }

// ============================================
// INITIALIZATION
// ============================================
function getStripe(): Promise<Stripe | null> { /* ... */ }

// ============================================
// PRIMARY OPERATIONS
// ============================================
export async function createCheckoutSession(/* ... */) { /* ... */ }
export async function redirectToCheckout(/* ... */) { /* ... */ }

// ============================================
// UTILITY FUNCTIONS
// ============================================
export function formatStripeError(/* ... */) { /* ... */ }
```

## TypeScript Configuration

**Type Strictness:**
- `noImplicitAny`: false (allows implicit any in edge cases)
- `noUnusedParameters`: false (allows intentional unused params)
- `strictNullChecks`: false (allows null/undefined without explicit annotation)
- `noUnusedLocals`: false (allows unused variables)
- `skipLibCheck`: true (skips type-checking dependencies)

**Path Resolution:**
- `baseUrl`: `.` (project root)
- Path aliases: `@/*` → `./src/*`

## React-Specific Conventions

**Components:**
- Functional components only (no class components)
- Use `ReactNode` type for children props
- Export as default if single-export file
- Props interface named `[ComponentName]Props`

**Hooks:**
- Custom hooks follow naming: `useAuth()`, `useRouter()`, `useContext()`
- Hooks from library import directly: `import { useEffect, useState } from 'react'`
- React hooks rules enforced by ESLint

**Context:**
- Context provider wraps subtree: `<AuthProvider>{children}</AuthProvider>`
- Custom hook for context access: `const auth = useAuth()`
- Error thrown if hook used outside provider

---

*Convention analysis: 2026-01-29*
