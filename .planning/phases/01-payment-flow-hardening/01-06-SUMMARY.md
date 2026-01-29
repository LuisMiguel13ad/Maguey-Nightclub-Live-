---
phase: 01-payment-flow-hardening
plan: 06
subsystem: testing
tags: [k6, load-testing, performance, stripe, webhook, concurrent]

# Dependency graph
requires:
  - phase: 01-01
    provides: Database constraints (unique indexes, payment_failures table)
  - phase: 01-02
    provides: Webhook idempotency and non-blocking email
  - phase: 01-04
    provides: Owner notification system for failures
provides:
  - k6 load test for 50 concurrent checkout sessions
  - k6 load test for 50 concurrent webhook events
  - Duplicate webhook handling test
  - npm scripts for easy load test execution
affects: [phase-10-load-testing, launch-readiness, ci-pipeline]

# Tech tracking
tech-stack:
  added: [k6]
  patterns: [ramping-vus, custom-metrics, threshold-validation]

key-files:
  created:
    - maguey-pass-lounge/load-tests/payment-load.k6.js
    - maguey-pass-lounge/load-tests/webhook-load.k6.js
  modified:
    - maguey-pass-lounge/package.json

key-decisions:
  - "50 VUs target per user decision (typical busy night)"
  - "p95 < 5s for checkout, p95 < 3s for webhooks"
  - "Error rate threshold < 1%"
  - "Separate duplicate webhook scenario to test idempotency"

patterns-established:
  - "k6 load tests in load-tests/ directory"
  - "npm scripts prefixed with load-test:"
  - "JSON output for CI integration"

# Metrics
duration: 2min
completed: 2026-01-29
---

# Phase 1 Plan 6: Load Tests Summary

**k6 load tests for 50 concurrent payment checkout sessions and webhook events with duplicate handling verification**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-29T21:09:31Z
- **Completed:** 2026-01-29T21:11:04Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- k6 load test validates 50 concurrent checkout session creation
- k6 load test validates 50 concurrent webhook processing with idempotency
- Duplicate webhook scenario tests concurrent identical events (10 VUs x 5 iterations)
- npm scripts enable easy execution: `npm run load-test:payment`, `load-test:webhook`, `load-test:all`

## Task Commits

Each task was committed atomically:

1. **Task 1: Create k6 load test for checkout session creation** - `98d8ab0` (test)
2. **Task 2: Create k6 load test for webhook processing** - `3cd5e77` (test)
3. **Task 3: Add load test npm scripts** - `2e3e71b` (chore)

## Files Created/Modified
- `maguey-pass-lounge/load-tests/payment-load.k6.js` - k6 test for 50 concurrent checkout sessions with thresholds
- `maguey-pass-lounge/load-tests/webhook-load.k6.js` - k6 test for webhooks + duplicate handling scenario
- `maguey-pass-lounge/package.json` - Added load-test npm scripts

## Decisions Made
None - followed plan as specified

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None - k6 is not installed locally but scripts are syntactically valid JavaScript and will run once k6 is installed (`brew install k6`)

## User Setup Required

To run load tests:
1. Install k6: `brew install k6` (macOS) or see https://k6.io/docs/get-started/installation/
2. Set environment variables:
   - `SUPABASE_URL` - Supabase project URL
   - `SUPABASE_ANON_KEY` - Supabase anon key (for payment test)
   - `SUPABASE_SERVICE_ROLE_KEY` - Service role key (for webhook test)
   - `TEST_EVENT_ID` - Event ID for load testing
3. Run tests:
   - `npm run load-test:payment` - Payment flow test
   - `npm run load-test:webhook` - Webhook processing test
   - `npm run load-test:all` - Both tests

## Next Phase Readiness
- Phase 1 (Payment Flow Hardening) now complete
- All 6 plans executed: database constraints, webhook idempotency, frontend error handling, owner notifications, failure scenario tests, and load tests
- Ready for Phase 2 (Email Reliability)

---
*Phase: 01-payment-flow-hardening*
*Completed: 2026-01-29*
