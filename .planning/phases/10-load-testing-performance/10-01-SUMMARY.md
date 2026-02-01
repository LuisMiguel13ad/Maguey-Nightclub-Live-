---
phase: 10-load-testing-performance
plan: 01
subsystem: testing
tags: [k6, load-testing, performance, supabase, stripe]

# Dependency graph
requires:
  - phase: 01-payment-failure-hardening
    provides: stripe-webhook edge function for checkout flow testing
provides:
  - Shared threshold configuration (p95 < 500ms default, scenario-specific overrides)
  - Supabase auth headers helper for k6 tests
  - Stripe webhook signature generator for webhook simulation
  - Test data factories for tickets, webhooks, scans
  - npm scripts for running load tests
affects: [10-02, 10-03, 10-04, 10-05]

# Tech tracking
tech-stack:
  added: [k6]
  patterns: [shared-thresholds, helper-modules, data-generators]

key-files:
  created:
    - load-tests/config/thresholds.js
    - load-tests/helpers/auth.js
    - load-tests/helpers/stripe-signature.js
    - load-tests/helpers/data-generators.js
    - load-tests/data/test-config.json
  modified:
    - package.json

key-decisions:
  - "p95 < 500ms global default with scenario-specific overrides"
  - "Scanner threshold p95 < 200ms for faster gate operations"
  - "Dashboard threshold p95 < 3000ms for acceptable load times"
  - "Webhook threshold p95 < 1000ms for processing tolerance"

patterns-established:
  - "getThresholds(scenario): merge base thresholds with scenario-specific"
  - "generateStripeSignature(): HMAC-SHA256 for webhook simulation"
  - "Data generator unique IDs: timestamp_vuId_iter pattern"

# Metrics
duration: 3min
completed: 2026-01-31
---

# Phase 10 Plan 01: k6 Infrastructure Setup Summary

**k6 load testing infrastructure with shared thresholds (p95 < 500ms), Supabase auth helpers, Stripe signature generator, and test data factories**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-31T21:34:22Z
- **Completed:** 2026-01-31T21:37:30Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Shared threshold configuration for all four test scenarios (purchase, scanner, dashboard, webhook)
- Helper modules for Supabase authentication and Stripe webhook signatures
- Test data factories generating unique payloads per virtual user
- npm scripts for individual and combined load test execution

## Task Commits

Each task was committed atomically:

1. **Task 1: Create shared threshold configuration** - `b850708` (chore)
2. **Task 2: Create authentication and data helper modules** - `7e79cd5` (chore)
3. **Task 3: Update package.json with k6 test scripts** - `b8d0d77` (chore)

## Files Created/Modified
- `load-tests/config/thresholds.js` - Shared threshold definitions with getThresholds() helper
- `load-tests/helpers/auth.js` - Supabase getHeaders(), getServiceHeaders(), getBaseUrl()
- `load-tests/helpers/stripe-signature.js` - generateStripeSignature() using k6/crypto HMAC
- `load-tests/helpers/data-generators.js` - generateTicketPayload(), generateWebhookEvent(), generateScanPayload()
- `load-tests/data/test-config.json` - Scenario VU counts and durations
- `package.json` - load-test:* npm scripts

## Decisions Made
- **Threshold values from CONTEXT.md:** p95 < 500ms global, scanner < 200ms, dashboard < 3s, webhook < 1s
- **Unique ID pattern:** `${Date.now()}_${vuId}_${iter}` ensures no collisions across VUs
- **Root-level load-tests directory:** Supports monorepo testing across maguey-pass-lounge and maguey-gate-scanner
- **Environment variable pattern:** __ENV for k6 compatibility

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

k6 installation required:
```bash
brew install k6
```

Environment variables needed for running tests:
- `SUPABASE_URL` - Test project URL
- `SUPABASE_ANON_KEY` - Anonymous key for authenticated requests
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for elevated operations
- `TEST_EVENT_ID` - Event ID for test scenarios
- `STRIPE_WEBHOOK_SECRET` - For webhook signature generation

## Next Phase Readiness
- Infrastructure ready for scenario-specific test files (10-02 through 10-05)
- All helper modules export functions that scenarios will import
- npm scripts configured but scenarios not yet created (expected in subsequent plans)

---
*Phase: 10-load-testing-performance*
*Completed: 2026-01-31*
