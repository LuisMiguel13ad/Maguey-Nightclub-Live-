# Phase 4 Testing Guide: VIP System Reliability

**Updated:** After legacy flow cleanup - only ONE VIP booking path now exists.

## Quick Reference

| App | URL | Purpose |
|-----|-----|---------|
| **Pass Lounge** | http://localhost:3016 | Customer ticket/VIP booking |
| **Gate Scanner** | http://localhost:3015 | Staff scanner app |

---

## Setup: Start the Apps

Open 2 terminal windows and run:

```bash
# Terminal 1: Customer App (VIP Booking)
cd maguey-pass-lounge && npm run dev

# Terminal 2: Scanner App
cd maguey-gate-scanner && npm run dev
```

---

## The Correct VIP Booking Flow

There is now **ONE** unified VIP booking flow:

```
/events                           ← Browse events
    ↓
/events/{eventId}/vip-tables      ← Select VIP table (floor plan)
    ↓
/events/{eventId}/vip-booking     ← Complete booking form (with GA ticket selection)
    ↓
Payment → Confirmation
```

**Key URL Pattern:** `/events/{eventId}/vip-tables`

---

## Test 1: VIP Checkout Requires GA Ticket Selection

### Steps:

1. **Go to:** http://localhost:3016/events
2. **Click** on an event (e.g., "Sexy Pijama PERREO")
3. Look for a "VIP Tables" link/button on the event page, OR manually go to:
   ```
   http://localhost:3016/events/{eventId}/vip-tables
   ```
   Replace `{eventId}` with the actual event ID (e.g., `b3fe7447-2908-42fc-a343-d4b8a8cefc6c`)

4. **Select** any available VIP table on the floor plan
5. **Click** "Reserve This Table" button at bottom
6. You should land on the **VIP Booking Form** page

### What to Look For on the Booking Form:

| Check | Expected | Where to Look |
|-------|----------|---------------|
| Entry ticket section visible? | ✅ Yes | Look for "Entry Ticket" section with radio buttons |
| First tier auto-selected? | ✅ Yes | First option should be pre-selected |
| Total shows combined price? | ✅ Yes | Order summary on right shows VIP table + Entry ticket |
| Validation enforced? | ✅ Yes | Cannot submit without ticket tier selected |

### Screenshot Reference:

The "Entry Ticket" section should look like:
- Header: "Entry Ticket" with "*REQUIRED" label
- Info box explaining VIP table = bottle service only
- Radio buttons for each ticket tier (e.g., General Admission $30, VIP Entry $50)
- Selected tier shows checkmark
- Order Summary shows both line items

---

## Test 2: Combined Price Calculation

### Steps:

1. On the VIP booking form from Test 1
2. Note the **VIP table price** in the Order Summary (e.g., $600)
3. Note the **selected entry ticket price** (e.g., $30)
4. Check the **Total** at bottom of Order Summary

### Expected:

```
VIP Table 5             $600.00
Entry Ticket (Host)      $30.00
─────────────────────────────────
Total                   $630.00
```

---

## Test 3: VIP Floor Plan (Live Indicator)

**Note:** The "Live" indicator component exists but is not integrated into the main floor plan page. This is a known gap.

### Current State:
- `VIPTableFloorPlan.tsx` has the Live indicator
- `VIPTablesPage.tsx` uses its own inline floor plan without the indicator

### Workaround Test:
- Open the floor plan in **two browser windows**
- Book a table in one window
- The other window should show the table as "RESERVED" after refresh

---

## Test 4: VIP Host Can Re-enter (Second Scan Succeeds)

### Prerequisites:
- A VIP reservation that's already been checked in once
- Access to VIP scanner

### Steps:

1. **Go to:** http://localhost:3015/scan/vip
2. Select the event if prompted
3. Scan the VIP host's QR code (one that's already been used)

### Expected:

| Check | Expected |
|-------|----------|
| Scan succeeds? | ✅ Green success overlay |
| Shows re-entry message? | ✅ Gold "RE-ENTRY GRANTED" banner |
| Shows last entry time? | ✅ e.g., "Last entry: 10:30 PM" |
| Audio feedback | ✅ Success sound plays |

---

## Test 5: VIP Re-entry Shows Gold Banner

### Steps:

Same as Test 4 - scan an already-checked-in VIP pass

### Visual Checklist:

- [ ] Green background (success state)
- [ ] Gold/amber banner at top: "RE-ENTRY GRANTED"
- [ ] Last entry time displayed below banner
- [ ] Table name and guest info shown
- [ ] Auto-dismiss after ~1.5 seconds

---

## Test 6: VIP-Linked GA Ticket Gets Re-entry Privilege

### Prerequisites:
- A GA ticket purchased through unified VIP checkout
- This is the **purchaser's entry ticket** from a VIP table booking

### Steps:

1. **Go to:** http://localhost:3015/scanner (main GA scanner)
2. Select the event if prompted
3. Scan the VIP-linked GA ticket QR code
4. **First scan:** Should succeed (green overlay)
5. **Second scan:** Should ALSO succeed with re-entry banner

### Expected:

| Scan | Result |
|------|--------|
| First | ✅ Green success - "Welcome!" |
| Second | ✅ Green success + Gold "RE-ENTRY GRANTED" + VIP table info |

---

## Test 7: Regular GA Ticket Rejected on Second Scan

### Prerequisites:
- A regular GA ticket (NOT linked to VIP)

### Steps:

1. **Go to:** http://localhost:3015/scanner
2. Scan a regular GA ticket
3. **First scan:** Success
4. **Second scan:** Should be REJECTED

### Expected:

| Scan | Result |
|------|--------|
| First | ✅ Green success |
| Second | ❌ Red rejection - "Ticket already used" |

---

## Test 8: VIP Reservation Status Protected (Database Test)

### Option A: Via Supabase Dashboard

1. Open Supabase Dashboard → SQL Editor
2. Find a VIP reservation with status `checked_in`
3. Try to run:
   ```sql
   UPDATE vip_reservations
   SET status = 'confirmed'
   WHERE status = 'checked_in'
   LIMIT 1;
   ```
4. **Should FAIL** with error about invalid state transition

### Option B: Verify Migration Exists

```bash
ls maguey-pass-lounge/supabase/migrations/*state_transition*
```

Should show: `20260130000000_vip_state_transition_enforcement.sql`

---

## Quick Test Checklist

```
VIP BOOKING FLOW (http://localhost:3016)
[ ] Can navigate to /events/{eventId}/vip-tables
[ ] Can select a table on floor plan
[ ] Booking form shows entry ticket radio buttons
[ ] First ticket tier is auto-selected
[ ] Total = VIP table + Entry ticket price
[ ] Cannot submit without agreeing to terms

SCANNER TESTS (http://localhost:3015)
[ ] VIP host re-entry succeeds with gold banner
[ ] VIP-linked GA ticket allows re-entry
[ ] Regular GA ticket rejected on second scan
[ ] Re-entry shows last entry time
```

---

## Finding Test Event IDs

To find a valid event ID for testing:

```bash
# Check seed script for test events
grep -r "event_id\|eventId" maguey-pass-lounge/supabase/seed*.sql | head -10
```

Or use this known test event (if it exists):
- **Event:** Sexy Pijama PERREO
- **ID:** `b3fe7447-2908-42fc-a343-d4b8a8cefc6c`

**Test URL:**
```
http://localhost:3016/events/b3fe7447-2908-42fc-a343-d4b8a8cefc6c/vip-tables
```

---

## Troubleshooting

### "Event not found" or blank page
- Verify the event ID exists in the database
- Check browser console for errors

### No VIP tables showing
- Event may not have `vip_enabled = true`
- No `event_vip_tables` records for this event

### Scanner not working
- Check browser console for errors
- Ensure logged in as staff user
- Grant camera permissions

### Ticket tier selection not appearing
- Check that `ticket_types` exist for the event
- Browser console will log "No ticket tiers found" if missing

---

## What Was Cleaned Up

The following legacy files were **deleted** as they used an old VIP booking flow that didn't require GA ticket selection:

- `src/pages/VipTableReservation.tsx`
- `src/components/vip/VipReservationForm.tsx`
- `src/components/vip/VIPPurchaseFlow.tsx`
- Route `/vip-tables` removed from `App.tsx`

**Only flow remaining:** `/events/{eventId}/vip-tables` → `/events/{eventId}/vip-booking`
