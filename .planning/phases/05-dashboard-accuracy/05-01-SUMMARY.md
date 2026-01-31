---
phase: 05-dashboard-accuracy
plan: 01
subsystem: database, api
tags: [stripe, postgresql, supabase, edge-functions, revenue-reconciliation]

# Dependency graph
requires:
  - phase: 01-payment-resilience
    provides: Stripe webhook integration patterns
  - phase: 04-vip-system-reliability
    provides: vip_reservations table with amount_paid_cents
provides:
  - revenue_discrepancies audit table for tracking DB vs Stripe totals
  - verify-revenue Edge Function for on-demand reconciliation
  - Stripe balance transaction comparison infrastructure
affects: [05-02, 05-03, 05-04, 05-05, dashboard-ui, owner-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Stripe balance transactions pagination for reconciliation
    - Revenue discrepancy audit logging with resolution workflow

key-files:
  created:
    - maguey-pass-lounge/supabase/migrations/20260131000000_revenue_discrepancies.sql
    - maguey-pass-lounge/supabase/functions/verify-revenue/index.ts
  modified: []

key-decisions:
  - "$1 discrepancy threshold for logging (per RESEARCH.md)"
  - "Discrepancy logged to audit table for owner visibility"
  - "Service role only for INSERT to prevent unauthorized logging"

patterns-established:
  - "Revenue reconciliation: DB total vs Stripe balance transactions"
  - "Audit table pattern with resolved_at and resolution_notes workflow"

# Metrics
duration: 4min
completed: 2026-01-31
---

# Phase 05 Plan 01: Revenue Discrepancies Summary

**Revenue reconciliation infrastructure with Stripe balance transaction verification and audit logging for discrepancy transparency**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-31T00:00:00Z
- **Completed:** 2026-01-31T00:04:00Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments

- Created revenue_discrepancies audit table with event reference, revenue figures, timestamps, and resolution workflow
- Built verify-revenue Edge Function that compares database revenue (tickets + VIP) against Stripe balance transactions
- Implemented $1 threshold for discrepancy logging per RESEARCH.md recommendations
- Added response breakdown showing ticket vs VIP revenue and Stripe transaction count

## Task Commits

Each task was committed atomically:

1. **Task 1: Create revenue_discrepancies audit table** - `6f8e1b9` (feat)
2. **Task 2: Create verify-revenue Edge Function** - `f1ef050` (feat)

## Files Created

- `maguey-pass-lounge/supabase/migrations/20260131000000_revenue_discrepancies.sql` - Audit table for tracking revenue discrepancies between database and Stripe
- `maguey-pass-lounge/supabase/functions/verify-revenue/index.ts` - Edge Function that queries DB revenue, fetches Stripe balance transactions, compares totals, and logs discrepancies

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| $1 discrepancy threshold | Per RESEARCH.md - small timing discrepancies are normal |
| Service role INSERT only | Prevents unauthorized discrepancy injection |
| Authenticated SELECT/UPDATE | Owners need to view and mark resolved |
| Return breakdown in response | Debugging aid: ticket vs VIP revenue split |

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **Docker not running:** Could not run `supabase db push --dry-run` to validate migration syntax. Migration syntax verified manually against PostgreSQL standards.

## User Setup Required

None - no external service configuration required. The Edge Function uses existing `STRIPE_SECRET_KEY` from Supabase secrets.

## Next Phase Readiness

- Revenue reconciliation infrastructure complete
- Ready for Plan 02: Ticket count accuracy checks
- Dashboard UI can call verify-revenue endpoint to display discrepancy warnings

---
*Phase: 05-dashboard-accuracy*
*Completed: 2026-01-31*
