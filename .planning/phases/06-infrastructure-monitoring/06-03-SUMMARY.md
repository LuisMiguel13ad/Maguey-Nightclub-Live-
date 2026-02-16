---
phase: 06-infrastructure-monitoring
plan: 03
subsystem: infra
tags: [sentry, error-tracking, monitoring, edge-functions, react]

# Dependency graph
requires:
  - phase: 06-02
    provides: Rate limiting infrastructure (shared function patterns)
provides:
  - Sentry error tracking for all frontend apps
  - Sentry error tracking for critical edge functions
  - _shared/sentry.ts module for edge function error capture
affects: [06-04, 06-05, debugging, production-monitoring]

# Tech tracking
tech-stack:
  added:
    - "@sentry/react@10.38.0 (gate-scanner, nights)"
    - "https://deno.land/x/sentry (edge functions)"
  patterns:
    - "Edge function Sentry: initSentry at module level, setRequestContext per request, await captureError with flush"
    - "Frontend Sentry: Sentry.init before render, ErrorBoundary wrapping App"

key-files:
  created:
    - "maguey-pass-lounge/supabase/functions/_shared/sentry.ts"
  modified:
    - "maguey-pass-lounge/supabase/functions/stripe-webhook/index.ts"
    - "maguey-pass-lounge/supabase/functions/vip/webhook/index.ts"
    - "maguey-gate-scanner/src/main.tsx"
    - "maguey-nights/src/main.tsx"
    - "maguey-gate-scanner/package.json"
    - "maguey-nights/package.json"

key-decisions:
  - "defaultIntegrations: false for edge functions to prevent scope contamination"
  - "await captureError() with flush(2000) before response ends"
  - "Filter ResizeObserver and mixed-content errors in frontend"
  - "VITE_SENTRY_DSN environment variable for frontend configuration"

patterns-established:
  - "Edge Sentry pattern: initSentry() at module level, setRequestContext(req, requestId) at handler start, await captureError() in catch blocks"
  - "Frontend Sentry pattern: Sentry.init with beforeSend filter, ErrorBoundary wrapping root component"

# Metrics
duration: 4min
completed: 2026-01-31
---

# Phase 6 Plan 3: Sentry Integration Summary

**Sentry error tracking extended to gate-scanner, nights frontends and critical edge functions with proper flush handling**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-31T00:00:00Z
- **Completed:** 2026-01-31T00:04:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Created shared Sentry module for edge functions with proper Deno/Edge patterns
- Added error tracking to stripe-webhook and vip/webhook edge functions
- Installed @sentry/react in gate-scanner and nights frontends
- Added Sentry.init and ErrorBoundary to both frontend apps
- All apps now report errors to Sentry with environment and request context

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Sentry shared module for edge functions** - `94741fe` (feat)
2. **Task 2: Add Sentry to critical edge functions** - `0befec5` (feat)
3. **Task 3: Add Sentry to gate-scanner and nights frontends** - `53de0ca` (feat)

## Files Created/Modified

- `maguey-pass-lounge/supabase/functions/_shared/sentry.ts` - Shared Sentry module for edge functions
- `maguey-pass-lounge/supabase/functions/stripe-webhook/index.ts` - Added Sentry error tracking
- `maguey-pass-lounge/supabase/functions/vip/webhook/index.ts` - Added Sentry error tracking (deprecated endpoint)
- `maguey-gate-scanner/src/main.tsx` - Sentry.init and ErrorBoundary
- `maguey-nights/src/main.tsx` - Sentry.init and ErrorBoundary
- `maguey-gate-scanner/package.json` - Added @sentry/react dependency
- `maguey-nights/package.json` - Added @sentry/react dependency

## Decisions Made

1. **defaultIntegrations: false for edge functions** - Critical for preventing scope contamination across concurrent requests in edge runtime
2. **await captureError() with 2s flush timeout** - Ensures errors are sent before edge function terminates
3. **Filter ResizeObserver errors** - Common browser noise that clutters Sentry dashboard
4. **VITE_SENTRY_DSN environment variable** - Standard Vite pattern for frontend configuration
5. **maguey-pass-lounge already has Sentry** - No changes needed, already integrated per project stack

## Deviations from Plan

None - plan executed exactly as written.

## User Setup Required

**External services require manual configuration:**

Environment variables to add in Supabase Dashboard (Edge Functions):
- `SENTRY_DSN` - Sentry DSN for edge function error tracking

Environment variables to add in frontend deployment:
- `VITE_SENTRY_DSN` - Same DSN for frontend error tracking

Dashboard configuration:
1. Create Sentry project if not exists (React / Deno)
2. Get DSN from Settings > Client Keys (DSN)
3. Add DSN to environment variables above

## Issues Encountered

None

## Next Phase Readiness

- All apps now have error tracking ready for production
- SENTRY_DSN and VITE_SENTRY_DSN environment variables need configuration
- Ready for 06-04: Structured logging integration with Sentry

---
*Phase: 06-infrastructure-monitoring*
*Completed: 2026-01-31*
