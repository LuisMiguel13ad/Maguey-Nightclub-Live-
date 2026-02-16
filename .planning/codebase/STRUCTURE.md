# Codebase Structure

**Analysis Date:** 2026-01-29

## Directory Layout

```
Maguey-Nightclub-Live/
├── maguey-pass-lounge/        # Ticket sales & VIP booking (port 3016)
│   ├── src/
│   │   ├── main.tsx            # App entry point (React root)
│   │   ├── App.tsx             # Router & provider setup
│   │   ├── index.css           # Global styles
│   │   ├── pages/              # Route components (Checkout, Payment, Events, VIP flows)
│   │   ├── components/         # Reusable UI components
│   │   │   ├── ui/             # shadcn primitives (button, dialog, card, etc)
│   │   │   ├── admin/          # Admin dashboard components
│   │   │   ├── auth/           # Auth-related components
│   │   │   ├── vip/            # VIP table components
│   │   │   ├── scanner/        # Ticket scanner display
│   │   │   └── dashboard/      # Dashboard widgets
│   │   ├── contexts/           # Context API providers (AuthContext)
│   │   ├── hooks/              # Custom React hooks
│   │   ├── lib/                # Business logic & services
│   │   │   ├── supabase.ts     # DB client & types
│   │   │   ├── events-service.ts     # Event queries
│   │   │   ├── vip-tables-service.ts # VIP booking logic
│   │   │   ├── stripe.ts             # Stripe API client
│   │   │   ├── errors/               # Error tracking & types
│   │   │   ├── tracing/              # Distributed tracing
│   │   │   ├── sentry.ts             # Error monitoring
│   │   │   └── [other services]
│   │   └── middleware/         # Request middleware (rate limiting)
│   ├── supabase/
│   │   ├── functions/          # Edge functions (webhooks, payments)
│   │   │   ├── stripe-webhook/
│   │   │   ├── create-checkout-session/
│   │   │   ├── create-vip-payment-intent/
│   │   │   └── vip/
│   │   └── migrations/         # SQL migrations
│   ├── vite.config.ts          # Build config (port 3016)
│   ├── package.json
│   └── tsconfig.json
│
├── maguey-gate-scanner/        # Ticket scanning & admin (port 3015)
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── pages/              # Scanner, Dashboard, Event Management, VIP Tables
│   │   ├── components/         # Scanner UI, analytics, admin dashboards
│   │   │   ├── ui/
│   │   │   ├── [scanners]      # QrScanner, NFCScanner, VIPScanner components
│   │   │   └── [dashboards]    # Admin, Analytics, Fraud dashboards
│   │   ├── contexts/           # AuthContext, BrandingContext
│   │   ├── hooks/
│   │   ├── lib/                # Business logic
│   │   │   ├── integrations/supabase/  # Auto-generated DB types
│   │   │   ├── scanner-service.ts      # Core scan logic
│   │   │   ├── nfc-service.ts          # NFC reading
│   │   │   ├── vip-tables-admin-service.ts
│   │   │   ├── tracing/
│   │   │   └── [other services]
│   │   └── pages/crew/         # Crew-specific pages
│   ├── vite.config.ts          # Build config (port 3015)
│   ├── package.json
│   └── tsconfig.json
│
├── maguey-nights/              # Public website (port 3017)
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── pages/              # Index, Events, Gallery, Restaurant, Contact
│   │   ├── components/         # Hero, Navigation, Event carousel, etc
│   │   │   ├── ui/
│   │   │   └── [feature]       # InstagramFeed, CinemaCarousel
│   │   ├── contexts/
│   │   ├── lib/
│   │   └── admin/              # Admin event manager
│   ├── vite.config.ts          # Build config with code splitting (port 3017)
│   ├── tailwind.config.ts      # Tailwind config
│   ├── package.json
│   └── tsconfig.json
│
├── .planning/
│   └── codebase/               # GSD analysis documents
│       ├── ARCHITECTURE.md
│       └── STRUCTURE.md
│
├── node_modules/               # Shared dependencies (monorepo root)
├── package.json                # Root workspace dependencies
└── tsconfig.json               # Root TypeScript config
```

## Directory Purposes

**maguey-pass-lounge/src/pages/:**
- Purpose: Page route components for ticket sales and VIP booking flows
- Contains: Events (list/filter), Checkout (ticket selection), Payment (Stripe), Ticket (display), VIP flows (booking, payment, confirmation), Auth pages (login, signup, 2FA), Account pages (profile, settings, account)
- Key files:
  - `Checkout.tsx`: 45KB - Main ticket purchase page
  - `VIPBookingForm.tsx`: 55KB - VIP table booking interface
  - `Events.tsx`: 32KB - Event listing and filtering
  - `Payment.tsx`: 15KB - Stripe payment form

**maguey-pass-lounge/src/components/:**
- Purpose: Reusable UI components organized by feature
- Key subdirectories:
  - `ui/`: 80+ shadcn/ui components (button, dialog, card, form, etc)
  - `admin/`: Admin dashboards (error tracking, circuit breaker, metrics)
  - `vip/`: VIP table floor plans, booking panels
  - `auth/`: Auth components (login form, 2FA setup, password meter)

**maguey-gate-scanner/src/pages/:**
- Purpose: Scanner app pages for staff and admin
- Contains: Scanner (main QR/NFC scan), Dashboard (owner overview), EventManagement, VipTablesManagement, Orders, TeamManagement, SecuritySettings, OwnerDashboard, DoorCounterManagement, etc.
- Key files:
  - `Scanner.tsx`: 27KB - Main scanning interface
  - `OwnerDashboard.tsx`: 28KB - Owner analytics
  - `VipTablesManagement.tsx`: 63KB - VIP management interface
  - `EventManagement.tsx`: 85KB - Event CRUD operations

**maguey-gate-scanner/src/lib/:**
- Purpose: Business logic for scanning, admin operations, analytics
- Key files:
  - `scanner-service.ts`: Core ticket scanning logic with signature verification
  - `nfc-service.ts`: NFC tag reading and validation
  - `vip-tables-admin-service.ts`: VIP table availability, reservations
  - `analytics-service.ts`: Event attendance analytics
  - `branding-service.ts`: Custom event branding
  - `request-signing.ts`: HMAC signature validation

**maguey-nights/src/pages/:**
- Purpose: Public-facing website pages
- Contains: Index (hero), Events (upcoming), Gallery, Restaurant, Contact, Checkout, Payment, AdminDashboard, Scanner
- Key files:
  - `Index.tsx`: 28KB - Homepage with hero and event carousel
  - `EventPage.tsx`: 33KB - Individual event details
  - `Restaurant.tsx`: 36KB - Restaurant menu and ordering

**maguey-pass-lounge/src/lib/:**
- Purpose: Ticket sales, payment, VIP booking business logic
- Key files:
  - `supabase.ts`: 150+ lines - DB client, types, RPC functions
  - `events-service.ts`: Event queries, caching, pagination
  - `vip-tables-service.ts`: VIP reservation availability, booking
  - `stripe.ts`: Stripe API integration
  - `tracing/`: Distributed tracing infrastructure
  - `errors/`: Error tracking and categorization

**maguey-gate-scanner/src/lib/tracing/:**
- Purpose: Distributed tracing for scanner operations
- Contains: Tracer, span creation, exporters (Supabase, console)
- Key files:
  - `tracer.ts`: Main tracer implementation
  - `scan-spans.ts`: Scan-specific span creation helpers
  - `exporters/`: Send traces to backends

## Key File Locations

**Entry Points:**
- `maguey-pass-lounge/src/main.tsx`: Initialize React root, error tracking (Sentry)
- `maguey-gate-scanner/src/main.tsx`: Same initialization
- `maguey-nights/src/main.tsx`: Same initialization

**Configuration:**
- `maguey-pass-lounge/vite.config.ts`: Port 3016, base path config
- `maguey-gate-scanner/vite.config.ts`: Port 3015
- `maguey-nights/vite.config.ts`: Port 3017, code splitting config
- `.env.example`: Environment variables template (in each app root)

**Core Logic:**
- `src/lib/supabase.ts`: Database client and types (all apps have their own)
- `src/lib/events-service.ts`: Event queries with caching
- `src/lib/scanner-service.ts`: Ticket scanning with signature verification
- `src/lib/errors/error-tracker.ts`: Error collection and Sentry integration
- `src/lib/tracing/`: Distributed tracing setup

**Testing:**
- `src/setupTests.ts`: Vitest configuration (all apps)
- `src/__tests__/integration/`: Integration tests
- `playwright/tests/`: End-to-end tests

## Naming Conventions

**Files:**
- Components: PascalCase (e.g., `ScannerInput.tsx`, `VIPTableFloorPlan.tsx`)
- Pages: PascalCase (e.g., `Checkout.tsx`, `EventManagement.tsx`)
- Services: kebab-case with `-service` suffix (e.g., `events-service.ts`, `scanner-service.ts`)
- Utilities/Helpers: kebab-case (e.g., `utils.ts`, `pagination.ts`)
- Types: PascalCase in `.ts` files alongside code or separate `types.ts`
- Tests: suffix with `.test.ts` or `.spec.ts`

**Directories:**
- Feature directories: kebab-case (e.g., `ui/`, `vip/`, `admin/`, `crew/`)
- Logical grouping: lowercase plural (e.g., `components/`, `pages/`, `hooks/`, `lib/`)
- Absolute path alias: `@` → `src/`

## Where to Add New Code

**New Feature Page:**
1. Create page component in `src/pages/FeatureName.tsx`
2. Add route in `src/App.tsx` Routes
3. Create service if needed in `src/lib/feature-name-service.ts`
4. Create components in `src/components/feature/` if complex
5. Add tests in `src/__tests__/feature.test.ts`

**New Feature Component:**
1. If reusable across pages: Add to `src/components/feature-name/ComponentName.tsx`
2. If feature-specific: Add to `src/pages/FeaturePage.tsx` or nested in components
3. Use `@` alias for imports: `import { Component } from '@/components/feature/ComponentName'`
4. Use shadcn/ui primitives from `@/components/ui/` as building blocks

**New Service/Business Logic:**
1. Create in `src/lib/feature-name-service.ts`
2. Export named functions (no default export)
3. Use Result pattern for error handling: `export async function doSomething(): AsyncResult<T>`
4. Import supabase at top: `import { supabase } from './supabase'`
5. Add tracing: `const span = tracer.startSpan('operation-name')`

**New API Integration:**
1. Create wrapper in `src/lib/service-name-client.ts`
2. Export methods for API calls
3. Use environment variables: `const apiKey = import.meta.env.VITE_SERVICE_KEY`
4. Add error handling with custom error types

**Utilities/Helpers:**
1. Add to `src/lib/utils.ts` if small and shared
2. Create new file if large or domain-specific: `src/lib/feature-utils.ts`
3. Export named functions

**Shared Hooks:**
1. Create in `src/hooks/useFeatureName.ts`
2. Export hook function directly (default export)
3. Use React hooks inside (useState, useEffect, useContext, etc)

## Special Directories

**src/components/ui/:**
- Purpose: Shadcn/ui primitive components (not modified, auto-generated)
- Generated: Yes (from `npx shadcn-ui add`)
- Committed: Yes (checked into git)
- Usage: Import as building blocks: `import { Button } from '@/components/ui/button'`

**src/lib/errors/:**
- Purpose: Error types, tracking, boundaries
- Generated: No
- Committed: Yes
- Key files: `error-types.ts`, `error-tracker.ts`, `scanner-errors.ts`

**src/lib/tracing/:**
- Purpose: Distributed tracing infrastructure
- Generated: No
- Committed: Yes
- Usage: `import { tracer } from '@/lib/tracing'` for span creation

**supabase/migrations/:**
- Purpose: SQL migrations for schema changes
- Generated: No
- Committed: Yes
- Naming: `YYYYMMDDHHMMSS_description.sql`
- Usage: Run with `supabase migration up`

**supabase/functions/:**
- Purpose: Serverless edge functions (webhooks, payments)
- Generated: No
- Committed: Yes
- Key functions: `stripe-webhook/`, `create-checkout-session/`, `create-vip-payment-intent/`

**playwright/tests/:**
- Purpose: End-to-end browser tests
- Generated: No
- Committed: Yes
- Run: `npx playwright test`

---

*Structure analysis: 2026-01-29*
