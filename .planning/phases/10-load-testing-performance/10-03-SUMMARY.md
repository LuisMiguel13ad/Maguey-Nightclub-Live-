---
phase: 10-load-testing-performance
plan: 03
subsystem: testing
tags: [k6, load-testing, scanner, race-condition, performance]

# Dependency graph
requires:
  - phase: 10-01
    provides: k6 infrastructure (thresholds, auth helpers)
  - phase: 03-02
    provides: scan_ticket_atomic RPC with race condition handling
provides:
  - k6 scanner burst load test with 10 simultaneous VUs
  - Race condition test scenario for concurrent scan validation
  - Test ticket data template for staging setup
affects: [10-04, 10-05, 12-launch-review]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - SharedArray for test data distribution across VUs
    - Per-VU ticket allocation to avoid collision in burst tests
    - Race condition detection via custom metrics

key-files:
  created:
    - load-tests/scenarios/scanner-burst.js
    - load-tests/data/test-tickets.json
  modified: []

key-decisions:
  - "p95 < 200ms threshold for scanner (stricter than default 500ms)"
  - "Two distinct scenarios: unique scans (1 min) then race condition (10 VUs same ticket)"
  - "Custom metrics for scan outcomes: successful_scans, already_scanned, race_conditions_caught"

patterns-established:
  - "Race condition tests use per-vu-iterations executor with 1 iteration each"
  - "Scanner metrics track not just success/failure but categorize rejection reasons"
  - "Test ticket data files include setup instructions and environment variable docs"

# Metrics
duration: 3min
completed: 2026-01-31
---

# Phase 10 Plan 03: Scanner Burst Load Test Summary

**k6 load test for 10 simultaneous scanner operations with p95 < 200ms threshold and explicit race condition validation**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-01T02:43:42Z
- **Completed:** 2026-02-01T02:46:45Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments
- Scanner burst test with 10 VUs scanning different tickets for 1 minute
- Race condition test with 10 VUs targeting same ticket simultaneously
- Custom metrics track successful scans, already-scanned rejections, and race conditions caught
- Test ticket data file with 15 placeholder IDs and setup instructions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create scanner burst load test** - `cfc6e4d` (feat)
2. **Task 2: Create test tickets data file** - `c5b3041` (chore)

## Files Created/Modified

- `load-tests/scenarios/scanner-burst.js` - k6 load test with 2 scenarios: unique scans and race condition testing
- `load-tests/data/test-tickets.json` - Placeholder ticket IDs with setup instructions for staging

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| p95 < 200ms threshold | Scanner operations are time-critical for gate entry flow; stricter than default 500ms |
| Two separate scenarios | Unique scans validate concurrent handling; race condition validates database locking |
| Custom metrics per outcome | Distinguish successful scans vs rejections vs race conditions for meaningful reporting |
| Placeholder UUIDs in data file | Users must create real staging tickets; placeholders provide structure |

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- k6 not installed in execution environment (noted as pending user setup from 10-01)
- Verified file structure and exports manually; syntax validation deferred to user

## User Setup Required

Before running scanner load tests:

1. Install k6: `brew install k6`
2. Create test event and tickets in staging Supabase
3. Update `load-tests/data/test-tickets.json` with real ticket UUIDs
4. Set environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `TEST_EVENT_ID`
   - `RACE_TEST_TICKET_ID`
5. Run: `k6 run load-tests/scenarios/scanner-burst.js`

## Next Phase Readiness

- Scanner burst test ready for execution with staging data
- Race condition test validates scan_ticket_atomic FOR UPDATE NOWAIT locking
- Next: 10-04 (Dashboard load test) - Wave 2

---
*Phase: 10-load-testing-performance*
*Completed: 2026-01-31*
