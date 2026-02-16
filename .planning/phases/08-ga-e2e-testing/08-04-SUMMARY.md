---
phase: 08-ga-e2e-testing
plan: 04
subsystem: testing
tags: [cypress, e2e, stripe, offline, edge-cases, payment-failures, qr-validation]

# Dependency graph
requires:
  - phase: 08-01
    provides: Cypress E2E infrastructure with custom commands
  - phase: 08-02
    provides: CI pipeline and health checks
  - phase: 03-02
    provides: Offline ticket cache service
  - phase: 07-06
    provides: Scanner offline modal and wake lock
provides:
  - Payment failure E2E tests for all Stripe decline card types
  - Invalid QR code rejection tests (security inputs, malformed data)
  - Offline scanner mode tests (indicator, caching, sync)
affects: [08-ci-pipeline, launch-review]

# Tech tracking
tech-stack:
  added: []
  patterns: [cy.intercept forceNetworkError for offline simulation, cy.fillStripeDeclined for decline cards]

key-files:
  created: [e2e/specs/edge-cases/payment-failures.cy.ts, e2e/specs/edge-cases/invalid-qr.cy.ts, e2e/specs/offline/offline-scan.cy.ts]
  modified: []

key-decisions:
  - "Using existing fillStripeDeclined command for payment failure tests"
  - "cy.intercept with forceNetworkError to simulate offline mode"
  - "Scanner tests navigate directly to scannerUrl instead of using cy.origin"
  - "Flexible selectors to accommodate various UI implementations"

patterns-established:
  - "Pattern: Edge case tests in e2e/specs/edge-cases/ directory"
  - "Pattern: Offline tests in e2e/specs/offline/ directory"
  - "Pattern: cy.intercept('**/*', { forceNetworkError: true }) for offline simulation"
  - "Pattern: Input sanitization tests for security validation"

# Metrics
duration: 3min
completed: 2026-01-31
---

# Phase 8 Plan 4: Edge Case and Offline E2E Tests Summary

**Cypress E2E tests for payment failures (4 Stripe decline cards), invalid QR code rejection (SQL injection, XSS, malformed input), and offline scanner mode (indicator, caching, sync)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-31T22:53:45Z
- **Completed:** 2026-01-31T22:56:50Z
- **Tasks:** 3
- **Files created:** 3

## Accomplishments
- Created payment failure tests covering all 4 Stripe decline card types with user-friendly error verification
- Built invalid QR tests for security inputs (SQL injection, XSS), malformed data, and rapid scan stability
- Implemented offline scanner tests for indicator display, network recovery, and scan queuing

## Task Commits

Each task was committed atomically:

1. **Task 1: Create payment failure tests** - `84cc91a` (feat)
2. **Task 2: Create invalid QR tests** - `7fa1696` (feat)
3. **Task 3: Create offline mode tests** - `68f405a` (feat)

## Files Created/Modified
- `e2e/specs/edge-cases/payment-failures.cy.ts` - Tests 4 Stripe decline cards, retry flow, loading state, form persistence
- `e2e/specs/edge-cases/invalid-qr.cy.ts` - Tests invalid codes, SQL injection, XSS, rapid scans, input sanitization
- `e2e/specs/offline/offline-scan.cy.ts` - Tests offline indicator, network recovery, intermittent connectivity, scan queuing

## Decisions Made
- **Using existing fillStripeDeclined command:** Leveraged the custom command from 08-01 rather than raw iframe manipulation
- **Direct scanner URL navigation:** Used `cy.visit(scannerUrl + '/auth')` instead of cy.origin for cleaner cross-app testing
- **Flexible selectors:** Tests use multiple selector patterns (`[data-cy="..."], button:contains("..."), .class`) to accommodate UI variations
- **forceNetworkError for offline:** Used Cypress intercept to simulate network failure rather than browser DevTools

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - all tests created successfully.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Edge case and offline E2E tests complete
- All GA E2E testing specs now available in e2e/specs/
- Note: Tests require apps running on localhost:3015 (scanner) and localhost:3016 (pass-lounge)
- CI pipeline (08-02) configured to run these tests on commit

---
*Phase: 08-ga-e2e-testing*
*Completed: 2026-01-31*
