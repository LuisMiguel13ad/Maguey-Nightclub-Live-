---
phase: 04-vip-system-reliability
plan: 07
subsystem: payments
tags: [vip, stripe, supabase, rpc, checkout, unified-qr]

# Dependency graph
requires:
  - phase: 04-01
    provides: VIP state transition enforcement and database schema
provides:
  - Unified VIP checkout flow (GA ticket + VIP table in single transaction)
  - purchaser_ticket_id column linking VIP reservation to GA ticket
  - create_unified_vip_checkout RPC function for atomic checkout
  - Updated edge function enforcing GA ticket selection
  - Updated UI requiring entry ticket selection
affects: [04-06, vip-webhook-processing, vip-scanner-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Unified VIP checkout RPC for atomic multi-table transactions"
    - "Payment intent metadata vip_unified type for webhook routing"
    - "Required GA ticket selection with radio button UI"

key-files:
  created:
    - maguey-pass-lounge/supabase/migrations/20260130700000_unified_vip_checkout.sql
  modified:
    - maguey-pass-lounge/supabase/functions/create-vip-payment-intent/index.ts
    - maguey-pass-lounge/src/pages/VIPBookingForm.tsx

key-decisions:
  - "VIP purchaser MUST buy GA ticket during VIP checkout (not optional)"
  - "Single QR code serves dual purpose: entry + VIP host identification"
  - "Auto-select first ticket tier as default to reduce friction"
  - "Rollback VIP reservation and GA ticket if Stripe payment intent fails"
  - "Payment intent metadata marks vip_unified for webhook processing"

patterns-established:
  - "RPC functions for atomic cross-table operations (ticket + reservation)"
  - "Unified QR token shared between tickets and vip_reservations tables"
  - "Required field validation in both frontend and edge function"

# Metrics
duration: 7min
completed: 2026-01-31
---

# Phase 04 Plan 07: Unified VIP Checkout Summary

**VIP checkout creates GA ticket + VIP reservation atomically via RPC, with unified QR code for entry and host identification**

## Performance

- **Duration:** 7 min
- **Started:** 2026-01-31T00:22:33Z
- **Completed:** 2026-01-31T00:29:53Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- VIP purchaser must select GA ticket tier before completing VIP checkout
- Single atomic transaction creates both GA ticket and VIP reservation
- Unified QR code grants entry AND identifies purchaser as VIP host
- Payment intent includes combined amount (VIP table + GA ticket)
- Rollback logic prevents orphaned records if payment creation fails

## Task Commits

Each task was committed atomically:

1. **Task 1: Add purchaser_ticket_id and unified VIP checkout RPC** - `a5b4e93` (feat)
2. **Task 2: Update VIP payment intent for unified checkout** - `e9424a1` (feat)
3. **Task 3: Make GA ticket selection required in VIP checkout** - `b8047f2` (feat)

## Files Created/Modified
- `maguey-pass-lounge/supabase/migrations/20260130700000_unified_vip_checkout.sql` - Adds purchaser_ticket_id column and create_unified_vip_checkout RPC function for atomic checkout
- `maguey-pass-lounge/supabase/functions/create-vip-payment-intent/index.ts` - Validates GA ticket selection, calls unified checkout RPC, creates combined payment intent, adds rollback on Stripe failure
- `maguey-pass-lounge/src/pages/VIPBookingForm.tsx` - Replaces optional GA ticket counter with required tier selection using radio buttons, auto-selects first tier, updates total calculation

## Decisions Made

**1. GA ticket selection mandatory (not optional)**
- Context required VIP purchaser MUST buy GA ticket
- Edge function validates ticketTierId presence
- UI disables checkout until tier selected

**2. Auto-select first ticket tier as default**
- Reduces friction - user can change but doesn't have to click
- Ensures valid state immediately after tiers load
- Matches common UX pattern for required selections

**3. Single unified QR token for both records**
- GA ticket and VIP reservation share same qr_code_token
- Scanner can look up either table with single QR scan
- Simplifies check-in flow (no separate QR codes)

**4. Rollback on Stripe failure**
- If payment intent creation fails, delete both ticket and reservation
- Mark table as available again
- Prevents orphaned database records without payment

**5. Payment intent metadata vip_unified type**
- Webhook can identify unified checkouts vs legacy VIP-only
- Enables future webhook logic differentiation
- Metadata includes both ticketId and reservationId

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Migration timestamp collision**
- Initial migration used timestamp 20260130400000 which conflicted with plan 04-04
- Resolution: Changed to 20260130700000 (7am instead of 4am)
- No impact on functionality, just file naming

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for:**
- Plan 04-06: GA scanner VIP link detection (can now detect purchaser_ticket_id)
- VIP webhook processing needs update to handle vip_unified payment intent type
- Scanner integration can leverage unified QR code for seamless check-in

**Database changes:**
- vip_reservations.purchaser_ticket_id now available for joins
- create_unified_vip_checkout RPC ready for use
- Unified QR tokens enable cross-table lookups

**Frontend changes:**
- VIP checkout enforces GA ticket requirement
- UI clearly communicates unified QR code purpose
- Total calculation includes both VIP table and entry ticket

**Edge function changes:**
- Validates mandatory GA ticket selection
- Creates atomic checkout via RPC
- Handles rollback on payment failure
- Returns unified QR token to client

---
*Phase: 04-vip-system-reliability*
*Completed: 2026-01-31*
