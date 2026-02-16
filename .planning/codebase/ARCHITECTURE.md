# Architecture

**Analysis Date:** 2026-01-29

## Pattern Overview

**Overall:** Multi-app monorepo using a Component + Service + Context + Pages layered architecture with React and TypeScript.

**Key Characteristics:**
- Three independent React + Vite applications (maguey-pass-lounge, maguey-gate-scanner, maguey-nights)
- Centralized Supabase database with edge functions for backend logic
- React Router for client-side routing
- Context API + React Query for state management
- Service layer for business logic (events, scanner, tickets, VIP tables)
- Shared UI component library (shadcn/ui) across all apps

## Layers

**Presentation (UI Components):**
- Purpose: Render user interface with reusable components
- Location: `src/components/` (all apps)
- Contains: UI primitives (`src/components/ui/`), feature components (auth, scanner, vip, dashboard), page containers
- Depends on: Hooks, Contexts, Services
- Used by: Pages and parent components

**Pages/Routes:**
- Purpose: Orchestrate components for specific routes, handle page-level logic
- Location: `src/pages/` (all apps)
- Contains: Page components corresponding to routes defined in `App.tsx`
- Depends on: Components, Contexts, Services, Hooks
- Used by: Router in `App.tsx`

**Context/State Management:**
- Purpose: Provide application state and business logic across component tree
- Location: `src/contexts/` (all apps)
- Contains: `AuthContext` (authentication, user session), `BrandingContext` (branding settings in gate-scanner)
- Depends on: Services (supabase), hooks
- Used by: All components needing shared state

**Service Layer:**
- Purpose: Encapsulate business logic and data access patterns
- Location: `src/lib/` (all apps)
- Contains:
  - `supabase.ts`: Database client and TypeScript types
  - Event services: `events-service.ts`, `vip-tables-service.ts`
  - Scanner services: `scanner-service.ts`, `nfc-service.ts`, `simple-scanner.ts`
  - Auth services: `biometric-auth.ts`, password management
  - Infrastructure: Tracing, error handling, monitoring, caching
- Depends on: Supabase client, external APIs (Stripe)
- Used by: Components, Pages, Contexts

**Custom Hooks:**
- Purpose: Encapsulate stateful logic and reusable patterns
- Location: `src/hooks/` (all apps)
- Contains: `useNewsletter`, `useMobile`, `usePagination`, `use-toast`
- Depends on: React hooks, contexts, services
- Used by: Components

**Infrastructure/Cross-Cutting:**
- Purpose: Handle errors, logging, monitoring, tracing, caching
- Location: `src/lib/errors/`, `src/lib/tracing/`, `src/lib/`
- Contains:
  - Error tracking: `errorTracker`, `ErrorBoundary`
  - Distributed tracing: tracer, span management, exporters
  - Monitoring: query optimization, performance tracking
  - Logging: structured logging
  - Caching: in-memory cache with TTL
- Used by: Service layer and higher

**Backend/Edge Functions:**
- Purpose: Secure server-side operations, webhook handling, payment processing
- Location: `supabase/functions/` (maguey-pass-lounge)
- Contains: Stripe webhooks, VIP payment flows, checkout sessions, availability checks
- Accessed by: Frontend services via HTTP

## Data Flow

**Ticket Purchase Flow:**

1. User navigates to `Checkout` page (`src/pages/Checkout.tsx`)
2. Page loads events via `events-service.ts` using `supabase` client
3. User selects event, ticket type, fills personal info
4. Submit calls Supabase edge function `create-checkout-session` via `src/lib/stripe.ts`
5. Edge function creates Stripe PaymentIntent, returns client secret
6. Frontend displays Stripe payment form with client secret
7. After payment, Stripe webhook triggers `stripe-webhook` edge function
8. Edge function creates Order and Ticket records in database
9. Frontend redirects to `CheckoutSuccess` page with ticket info
10. Ticket displayed with QR code (generated via `qr_token` + `qr_signature`)

**Scanner Flow (Gate Scanner):**

1. Staff opens `Scanner` page (`src/pages/Scanner.tsx`)
2. Scans QR code or NFC tag via `QrScanner` or `NFCScanner` component
3. QR/NFC data sent to `scanner-service.ts`
4. Service validates signature, looks up ticket in Supabase
5. Service publishes `ticketScanned` event via `events/ticket-events.ts`
6. Page displays ticket details, entry status
7. Staff confirms or rejects entry
8. Scan recorded in database with metadata

**VIP Table Booking Flow:**

1. User navigates to `VIPBookingForm` page (`src/pages/VIPBookingForm.tsx`)
2. Page loads VIP table layout via `vip-tables-service.ts`
3. User selects table, fills guest info, chooses payment method
4. Submit calls Supabase edge function `create-vip-payment-intent`
5. Edge function creates PaymentIntent, returns client secret
6. Frontend displays payment form
7. After payment, edge function `vip/webhook` creates VipReservation record
8. User receives confirmation and can view reservation details

**State Management:**

- Auth state: `AuthContext` manages user, session, and auth methods
- Page-level state: Managed by page components using `useState`, `useQuery` (React Query)
- Global UI state: Toasts, tooltips via shadcn/ui providers
- Cross-cutting state: Branding, error tracking via service layer

## Key Abstractions

**Service Pattern:**
- Purpose: Encapsulate database queries, API calls, business logic
- Examples: `events-service.ts`, `scanner-service.ts`, `vip-tables-service.ts`
- Pattern: Export named async functions returning `Result<T>` or direct data, take services as dependencies

**Result Type:**
- Purpose: Handle errors functionally without exceptions
- Examples: `Result<T>`, `AsyncResult<T>`, `ok()`, `err()`
- Pattern: Functions return `Result` types, callers check `isOk()` before accessing data

**Supabase RPC Functions:**
- Purpose: Atomic database operations, complex queries
- Examples: Inventory management with `reserve_tickets_rpc()`, VIP availability checks
- Pattern: Defined in SQL migrations, called via `supabase.rpc()` from services

**Context + Hook Pattern:**
- Purpose: Share state and logic across component tree
- Examples: `AuthProvider` + `useAuth()`, `BrandingProvider` + `useBranding()`
- Pattern: Provider wraps tree in `App.tsx`, hook accesses context

**Page Container Pattern:**
- Purpose: Each page handles its own routing, data fetching, state
- Location: `src/pages/`
- Pattern: Page component is route handler, fetches data via hooks, renders components

## Entry Points

**maguey-pass-lounge (Ticket Sales & VIP Booking):**
- Location: `src/main.tsx` → `src/App.tsx`
- Triggers: User accesses app in browser
- Responsibilities: Initialize Sentry error tracking, wrap app with providers (QueryClient, Auth, Tooltip), render router with routes

**maguey-gate-scanner (Ticket Scanning & Event Management):**
- Location: `src/main.tsx` → `src/App.tsx`
- Triggers: Staff/owner accesses scanner app
- Responsibilities: Initialize error boundary, providers, render scanner interface and admin dashboards

**maguey-nights (Public Website & Event Info):**
- Location: `src/main.tsx` → `src/App.tsx`
- Triggers: User accesses public website
- Responsibilities: Initialize providers with lazy-loaded routes, render marketing pages, event details, restaurant

## Error Handling

**Strategy:** Layered error handling with ErrorBoundary at page level, try-catch in services, Result types for functional error handling.

**Patterns:**

- **React Error Boundary:** `src/components/ErrorBoundary.tsx` catches render errors, displays fallback UI
- **Service-level Result types:** Services return `Result<T>` instead of throwing, allowing callers to handle errors explicitly
- **Error Tracking:** `src/lib/errors/error-tracker.ts` logs errors to Sentry and local tracking
- **Scanner-specific errors:** `src/lib/errors/scanner-errors.ts` defines `ScanError` types with recovery strategies
- **Global error handler:** `src/lib/sentry.ts` initializes Sentry for production error tracking

## Cross-Cutting Concerns

**Logging:**
- Created via `createLogger({ module: 'name' })` in `src/lib/logger.ts`
- Structured logging with context, redaction for sensitive data
- Logs in development go to console

**Validation:**
- Form validation via `react-hook-form` + `zod` (in checkout/payment pages)
- Business logic validation in services (e.g., ticket availability, signature verification)
- RLS policies in Supabase enforce row-level security

**Authentication:**
- Managed by `AuthContext` using Supabase Auth
- Magic link, email/password, social login, 2FA, biometric auth supported
- Session stored in localStorage, auto-refreshed

**Rate Limiting:**
- Client-side rate limiting middleware in `src/middleware/rate-limit-middleware.ts`
- Server-side: Edge functions implement rate limits

---

*Architecture analysis: 2026-01-29*
