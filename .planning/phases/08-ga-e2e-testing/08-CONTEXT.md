# Phase 8: GA End-to-End Testing - Context

**Gathered:** 2026-01-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Validate the complete general admission flow from ticket purchase through gate entry. Tests cover the full chain: browse events → select tickets → complete payment → receive email with QR → scan QR at gate → verify check-in. This is testing existing functionality, not building new features.

</domain>

<decisions>
## Implementation Decisions

### Test Scope & Coverage
- Comprehensive coverage: happy path + key edge cases + failure scenarios
- All available ticket tiers tested, not just one
- Full webhook chain verification (Stripe → DB → ticket creation)
- Include offline mode behavior testing (cache → offline → scan → sync)
- Both mobile and desktop viewport testing for scanner
- Email content validation including QR code extraction and verification
- Run E2E tests on every commit in CI/CD pipeline
- Both UI verification AND direct database checks for critical data

### Failure Testing Approach
- Real Stripe test failures for payment declines (use Stripe's decline test cards)
- Mock/intercept network failures and timeout scenarios
- Tests verify recovery behavior for each failure type

### Execution Approach
- **Framework:** Cypress
- **Environment:** Both local dev servers AND staging (configurable via env vars)
- **Cross-app flows:** Tests navigate between pass-lounge (purchase) and gate-scanner (scan)
- **Artifacts:** Video and screenshot capture on every failure
- **Browser mode:** Headless for CI, headed locally for debugging
- **Parallelism:** 4+ parallel workers for speed
- **Mocking strategy:** Hybrid - real Stripe test mode, mock Resend API calls
- **Authentication:** Full UI login flow for gate-scanner (tests real auth)

### Test Data Strategy
- Events created via UI (tests the creation flow as part of E2E)
- Cleanup after suite completion (batch cleanup, not per-test)
- Standard Stripe test cards (4242 4242 4242 4242)
- Real email addresses for testing (actual delivery)
- Query email_queue database table to verify email content/status
- Default database connection (same as app)
- Health check all services (DB, Stripe, edge functions) before running tests

### Validation Criteria
- **Pass rate:** 100% required - any failure fails the suite
- **Reports:** Console output only (no HTML reports)
- **Assertions:** Both UI feedback AND underlying data correctness
- **QR verification:** Decode QR to verify format, THEN actually scan to verify function

### Claude's Discretion
- Concurrency level for concurrent purchase tests (appropriate for E2E vs load testing)
- 2-minute timing threshold: measure vs assert
- Error message text validation: exact match vs semantic check
- Retry strategy for flaky failures
- Test file location (root /e2e vs per-app)
- Timeout configuration per operation type
- Custom Cypress commands abstraction level
- Unique identifier strategy for test data isolation

</decisions>

<specifics>
## Specific Ideas

- Cross-app flow is critical: purchase happens on maguey-pass-lounge, scanning happens on maguey-gate-scanner — tests must navigate between both
- Since events are created via UI, the E2E suite also validates the owner dashboard event creation flow
- Email verification via email_queue table is faster and more reliable than external inbox services
- Offline mode test: cache ticket → simulate offline → scan → come back online → verify sync completes

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-ga-e2e-testing*
*Context gathered: 2026-01-31*
