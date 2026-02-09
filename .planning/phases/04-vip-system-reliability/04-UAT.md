---
phase: 04-vip-system-reliability
status: testing
created: 2026-01-30
updated: 2026-02-09
tests_total: 8
tests_passed: 3
tests_failed: 0
tests_skipped: 1
tests_blocked: 0
blocking_reason: (resolved — all RPCs confirmed on remote DB)
---

# Phase 4 UAT: VIP System Reliability

User acceptance tests for Phase 4 deliverables. Each test validates a user-observable outcome.

## Test Status

| # | Test | Status | Notes |
|---|------|--------|-------|
| 1 | VIP checkout requires GA ticket selection | ✅ passed | Radio buttons visible, first tier auto-selected |
| 2 | VIP checkout total includes table + ticket price | ✅ passed | Order summary shows VIP + Entry = correct total |
| 3 | VIP floor plan shows "Live" indicator | ⏭️ skipped | Known gap: component exists but not integrated |
| 4 | VIP host can re-enter (second scan succeeds) | ⛔ blocked | Migrations not applied to remote DB |
| 5 | VIP re-entry shows gold "RE-ENTRY GRANTED" banner | ⛔ blocked | Requires Test 4 |
| 6 | VIP-linked GA ticket gets re-entry privilege | ⛔ blocked | `check_vip_linked_ticket_reentry` RPC missing |
| 7 | Regular GA ticket rejected on second scan | ⛔ blocked | `scan_ticket_atomic` fails - schema drift |
| 8 | VIP reservation status protected (no backward transitions) | ✅ passed | Trigger rejects `checked_in`→`confirmed` with correct error |

---

## Test 1: VIP Checkout Requires GA Ticket Selection

**Source:** 04-07-SUMMARY (Unified VIP checkout)

**What to test:**
1. Navigate to VIP booking form for an event with multiple ticket tiers
2. Select a VIP table
3. Observe the checkout form

**Expected:**
- Entry ticket tier selection is visible (radio buttons)
- First tier is auto-selected by default
- Checkout button shows combined total (VIP table + GA ticket)
- Cannot proceed if no ticket tier is selected

**Result:** ✅ PASSED
- Entry ticket section visible with radio buttons
- First tier auto-selected by default
- Verified on correct flow: `/events/{eventId}/vip-tables` → `/events/{eventId}/vip-booking`

---

## Test 2: VIP Checkout Total Includes Table + Ticket Price

**Source:** 04-07-SUMMARY (Unified VIP checkout)

**What to test:**
1. Navigate to VIP booking form
2. Select a VIP table (note the price)
3. Select a ticket tier (note the price)
4. Check the total displayed

**Expected:**
- Summary shows VIP table price line item
- Summary shows Entry ticket price line item
- Total = VIP table price + Entry ticket price

**Result:** ✅ PASSED
- Order Summary displays: VIP Table price + Entry Ticket price = Correct Total
- Both line items clearly shown in summary panel

---

## Test 3: VIP Floor Plan Shows "Live" Indicator

**Source:** 04-03-SUMMARY (Realtime floor plan)

**What to test:**
1. Navigate to VIP tables page with floor plan view
2. Look for visual indicator of realtime connection

**Expected:**
- Pulsing green dot visible near floor plan header
- "Live" text or indicator present
- Console logs show subscription status (optional check)

**Result:** ⏭️ SKIPPED (Known Gap)
- `VIPTableFloorPlan.tsx` has the Live indicator component
- `VIPTablesPage.tsx` uses its own inline floor plan without the indicator
- Realtime subscriptions DO work (tables update when booked), but no visual "Live" badge
- **Recommendation:** Integrate Live indicator in future iteration

---

## Test 4: VIP Host Can Re-enter (Second Scan Succeeds)

**Source:** 04-02-SUMMARY, 04-05-SUMMARY (VIP re-entry)

**What to test:**
1. Open VIP scanner
2. Scan a VIP host pass that has already been checked in
3. Observe result

**Expected:**
- Scan succeeds (green success overlay)
- Shows "RE-ENTRY GRANTED" message
- Shows last entry time
- VIP table info displayed

**Result:** _pending_

---

## Test 5: VIP Re-entry Shows Gold "RE-ENTRY GRANTED" Banner

**Source:** 04-05-SUMMARY (VIP scanner re-entry UI)

**What to test:**
1. Open VIP scanner
2. Scan an already-checked-in VIP pass
3. Observe the visual display

**Expected:**
- Green success overlay background (same as first entry)
- Gold/amber "RE-ENTRY GRANTED" banner at top
- Last entry time shown (format: HH:MM)
- Table name and guest info displayed

**Result:** _pending_

---

## Test 6: VIP-Linked GA Ticket Gets Re-entry Privilege

**Source:** 04-06-SUMMARY (GA scanner VIP link detection)

**What to test:**
1. Open GA scanner (main scanner)
2. Scan a GA ticket that was purchased through VIP unified checkout
3. Scan same ticket again

**Expected:**
- First scan: Success, green overlay
- Second scan: Success with "RE-ENTRY GRANTED" banner
- Shows VIP table info (e.g., "VIP GUEST - Table 5")
- NOT rejected as "already used"

**Result:** _pending_

---

## Test 7: Regular GA Ticket Rejected on Second Scan

**Source:** 04-06-SUMMARY (GA scanner VIP link detection)

**What to test:**
1. Open GA scanner
2. Scan a regular GA ticket (not linked to VIP)
3. Scan same ticket again

**Expected:**
- First scan: Success, green overlay
- Second scan: REJECTED with red overlay
- Message: "Ticket already used" or similar
- Clear feedback that re-entry not allowed

**Result:** _pending_

---

## Test 8: VIP Reservation Status Protected (No Backward Transitions)

**Source:** 04-01-SUMMARY (State transition enforcement)

**What to test:**
This is a database-level constraint. Can be verified by:
1. Finding a VIP reservation with status "checked_in"
2. Attempting to manually update status to "confirmed" via SQL

**Expected:**
- Direct SQL update to "confirmed" should fail
- Error message indicates invalid state transition
- Status remains "checked_in"

**Alternative verification:**
- Check migration file exists: `20260130000000_vip_state_transition_enforcement.sql`
- Check trigger is defined on vip_reservations table

**Result:** ✅ PASSED
- Trigger `enforce_vip_status_transition` confirmed active on `vip_reservations` table
- Used reservation `aaaaaaaa-...` (status: `checked_in`, "Test VIP Host", table 101)
- Attempted backward transition: `checked_in` → `confirmed`
- SQL UPDATE correctly rejected with error:
  `Invalid VIP status transition from checked_in to confirmed. Only forward transitions are allowed.`
- Hint returned valid transitions: `pending→confirmed, pending→cancelled, confirmed→checked_in, confirmed→cancelled, checked_in→completed`
- Verified status remained `checked_in` after rejected update

---

## Blocking Issues (Scanner Tests 4-8)

**Root Cause:** Phase 4 migrations exist locally but have NOT been applied to the remote Supabase database.

### Missing RPC Functions

| Function | Migration File | Status |
|----------|----------------|--------|
| `check_vip_linked_ticket_reentry` | `20260130100000_vip_reentry_support.sql` | ❌ Not on remote DB |
| `process_vip_scan_with_reentry` | `20260130100000_vip_reentry_support.sql` | ❌ Not on remote DB |
| `scan_ticket_atomic` | `20260130200000_add_scan_race_condition_handling.sql` | ❌ Not on remote DB |
| `increment_vip_checked_in` | `20260130300000_vip_increment_checked_in.sql` | ❌ Not on remote DB |

### Schema Drift Detected

- `scan_logs` table has `scan_result` column (NOT NULL) on remote DB
- Local migration adds `scan_success` column instead
- `tickets` table has renamed columns (`guest_name` → `attendee_name`)

### Required Actions

**To unblock scanner tests, apply these migrations to remote Supabase:**

```bash
cd maguey-pass-lounge

# Option 1: Via Supabase CLI (if linked)
npx supabase db push

# Option 2: Manual application via Supabase Dashboard SQL Editor
# Copy and execute each migration file in order:
# 1. 20260130000000_vip_state_transition_enforcement.sql
# 2. 20260130100000_vip_reentry_support.sql
# 3. 20260130200000_add_scan_race_condition_handling.sql
# 4. 20260130300000_vip_increment_checked_in.sql
# 5. 20260130700000_unified_vip_checkout.sql
```

---

## Notes

**Prerequisites for testing:**
- At least one event with VIP tables and ticket tiers configured
- Test VIP reservation with known QR code
- Test GA ticket linked to VIP reservation
- Test regular GA ticket (not linked to VIP)

**Test environment:**
- Local development OR staging
- Scanner app accessible
- VIP booking form accessible
