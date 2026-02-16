# Phase 4: VIP System Reliability - Research

**Researched:** 2026-01-30
**Domain:** VIP reservation lifecycle, state machines, concurrent check-in handling, real-time floor plan sync
**Confidence:** HIGH

## Summary

The maguey-nightclub codebase already has a robust foundation for VIP table reservations with atomic RPC functions for race condition prevention (`create_vip_reservation_atomic`, `check_in_vip_guest_atomic`, `verify_vip_pass_signature`), row-level locking via `FOR UPDATE`, and an offline queue service for VIP scanning. The current implementation handles VIP guest passes through the `vip_guest_passes` table and supports linking GA tickets to VIP reservations via `vip_linked_tickets`.

The main gaps between the current state and Phase 4 requirements are:
1. **Unified QR Code** - VIP purchaser must buy GA ticket; single scan should grant entry + mark table arrived + show VIP details. Current system has separate VIP guest passes.
2. **State Transition Enforcement** - Forward-only transitions (pending -> confirmed -> checked_in -> completed) not enforced at database level
3. **Re-entry Policy** - VIP/guests allow re-entry but current scanner treats all scans as first-scan-wins
4. **Floor Plan Real-time Updates** - Current floor plan fetches availability on demand; needs real-time subscription
5. **Cancellation Flow** - Owner-initiated cancellation with bulk refund not implemented

**Primary recommendation:** Extend existing atomic RPC functions to enforce forward-only state transitions, add database triggers for state machine validation, implement unified VIP+GA ticket scanning logic with re-entry detection, and wire up Supabase Realtime subscriptions for floor plan components.

## Standard Stack

The established libraries/tools already installed for this domain:

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | 2.77.0 | Database, RPC, Realtime | Already used for all VIP operations |
| dexie | 4.2.1 | IndexedDB for offline VIP queue | Already used in vip-offline-queue-service.ts |
| html5-qrcode | 2.3.8 | QR scanning | Already used in gate-scanner |

### Supporting (Already Installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| stripe | 20.0.0 | Refund processing | For owner-initiated event cancellation refunds |
| sonner | 1.7.4 | Toast notifications | Success/error feedback |
| lucide-react | 0.462.0 | Icons | Status indicators |

### No Additional Libraries Needed
The current stack is complete. Phase 4 work is primarily database constraints, RPC function enhancements, and wiring existing infrastructure together.

## Architecture Patterns

### Current Project Structure
```
maguey-pass-lounge/
├── src/
│   ├── lib/
│   │   ├── vip-tables-service.ts       # VIP service layer (has atomic functions)
│   │   └── supabase.ts                 # Types and client
│   ├── components/vip/
│   │   ├── VIPTableFloorPlan.tsx       # Floor plan display (needs realtime)
│   │   └── VIPPurchaseFlow.tsx         # Booking flow
│   └── pages/
│       ├── VIPBookingForm.tsx          # Customer booking
│       └── VIPTablesPage.tsx           # Admin management
├── supabase/
│   ├── functions/
│   │   ├── stripe-webhook/             # Handles VIP payments
│   │   └── create-vip-payment-intent/  # Creates VIP payment
│   └── migrations/
│       ├── 20260122000000_fix_vip_race_condition_and_rls.sql  # Atomic functions
│       └── 20260128110000_vip_ga_integration.sql              # GA linking

maguey-gate-scanner/
├── src/
│   ├── lib/
│   │   ├── vip-tables-admin-service.ts   # Scanner VIP operations
│   │   └── vip-offline-queue-service.ts  # Offline VIP queue
│   └── components/vip/
│       └── VIPScanner.tsx                # VIP pass scanning
```

### Pattern 1: Forward-Only State Machine with Database Constraint

**What:** Enforce valid state transitions at database level
**When to use:** Every vip_reservations status update
**Example:**
```sql
-- Source: PostgreSQL CHECK constraint + trigger pattern
-- Based on: https://felixge.de/2017/07/27/implementing-state-machines-in-postgresql/

-- Define valid transitions
CREATE TABLE IF NOT EXISTS vip_status_transitions (
  from_status vip_reservation_status NOT NULL,
  to_status vip_reservation_status NOT NULL,
  PRIMARY KEY (from_status, to_status)
);

INSERT INTO vip_status_transitions VALUES
  ('pending', 'confirmed'),
  ('pending', 'cancelled'),   -- Payment failed/expired
  ('pending', 'expired'),     -- Timeout
  ('confirmed', 'checked_in'),
  ('confirmed', 'cancelled'), -- Owner cancellation only (pre-event)
  ('checked_in', 'completed');

-- Trigger to validate transitions
CREATE OR REPLACE FUNCTION validate_vip_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow if no status change
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Check if transition is valid
  IF NOT EXISTS (
    SELECT 1 FROM vip_status_transitions
    WHERE from_status = OLD.status AND to_status = NEW.status
  ) THEN
    RAISE EXCEPTION 'Invalid VIP reservation state transition: % -> %', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_vip_status_transition
  BEFORE UPDATE OF status ON vip_reservations
  FOR EACH ROW EXECUTE FUNCTION validate_vip_status_transition();
```

### Pattern 2: Row-Level Locking with FOR UPDATE for Concurrent Check-ins

**What:** Lock the guest pass row during check-in to prevent dual-scanner race conditions
**When to use:** Every check-in attempt
**Source:** [PostgreSQL Row-Level Locks Guide](https://scalablearchitect.com/postgresql-row-level-locks-a-complete-guide-to-for-update-for-share-skip-locked-and-nowait/)

The current `check_in_vip_guest_atomic` function already implements this correctly:
```sql
-- Source: maguey-pass-lounge/supabase/migrations/20260122000000_fix_vip_race_condition_and_rls.sql
SELECT * INTO v_pass FROM vip_guest_passes WHERE id = p_pass_id FOR UPDATE;
-- ... validates status ...
SELECT * INTO v_reservation FROM vip_reservations WHERE id = v_pass.reservation_id FOR UPDATE;
```

This pattern ensures first-scan-wins: second scanner immediately sees "already checked in" error.

### Pattern 3: VIP Re-entry Detection (Allow Multiple Scans)

**What:** Distinguish re-entry from duplicate concurrent scans
**When to use:** When VIP purchaser or linked guest scans after already being checked in
**Decision from CONTEXT.md:** VIP purchasers and linked guests CAN re-enter

```typescript
// Source: User decision from 04-CONTEXT.md
interface VipScanResult {
  status: 'entry_granted' | 'reentry_granted' | 'already_inside' | 'invalid';
  isReentry: boolean;
  lastEntryTime?: string;
  message: string;
}

// Check-in logic for VIP/linked guests:
// 1. If pass status is 'issued' -> first entry, mark as 'checked_in'
// 2. If pass status is 'checked_in' AND isVipOrLinkedGuest -> allow re-entry, log scan
// 3. If pass status is 'checked_in' AND isRegularGA -> reject (no re-entry for GA)
```

### Pattern 4: Supabase Realtime for Floor Plan Updates

**What:** Subscribe to vip_reservations and event_vip_tables changes for real-time floor plan
**When to use:** Floor plan components that need to show live availability
**Source:** [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime)

```typescript
// Source: Supabase Realtime - Postgres Changes
// Apply in VIPTableFloorPlan.tsx
useEffect(() => {
  const channel = supabase
    .channel(`floor-plan:${eventId}`)
    .on('postgres_changes', {
      event: '*',  // INSERT, UPDATE, DELETE
      schema: 'public',
      table: 'vip_reservations',
      filter: `event_id=eq.${eventId}`
    }, (payload) => {
      // Refetch availability or update local state
      refetchTables();
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'event_vip_tables',
      filter: `event_id=eq.${eventId}`
    }, (payload) => {
      refetchTables();
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [eventId]);
```

### Pattern 5: Unified VIP + GA Ticket Handling in Scanner

**What:** Single scan flow that handles both VIP passes and linked GA tickets
**When to use:** Scanner should treat linked GA tickets as VIP-adjacent
**Decision from CONTEXT.md:** Unified QR code for VIP purchaser, linked guests show "Guest of Table X"

The current `getGuestPassByQrToken` in vip-tables-admin-service.ts already has fallback logic to check `vip_linked_tickets`. This pattern should be extended:

```typescript
// Source: maguey-gate-scanner/src/lib/vip-tables-admin-service.ts (lines 791-868)
// Enhanced scanner flow:

async function processVipScan(qrToken: string): Promise<ScanResult> {
  // 1. Check vip_guest_passes first (direct VIP pass)
  // 2. Fallback to tickets table + vip_linked_tickets join
  // 3. Return unified result with VIP context

  const result = await getGuestPassByQrToken(qrToken);

  if (!result) {
    return { status: 'invalid', message: 'Not a valid VIP pass' };
  }

  const { pass, reservation } = result;
  const isLinkedTicket = pass.guest_number === 0; // Mock pass from linked ticket

  // Determine display type
  const displayType = isLinkedTicket
    ? 'vip_linked_guest'  // Show "Guest of Table X"
    : pass.guest_number === 1
      ? 'vip_host'        // Show full VIP details
      : 'vip_guest';      // Show "VIP Guest - Table X"

  return {
    status: 'valid',
    displayType,
    tableName: reservation.event_vip_table?.table_name,
    tier: reservation.package_snapshot?.tier,
    holderName: reservation.purchaser_name,
    guestNumber: pass.guest_number,
    totalGuests: reservation.package_snapshot?.guestCount,
    checkedInGuests: reservation.checked_in_guests,
  };
}
```

### Anti-Patterns to Avoid
- **Checking status in application code before updating:** Use atomic RPC functions that lock and validate in single transaction
- **Polling for floor plan updates:** Use Supabase Realtime subscriptions instead
- **Building custom state machine validation:** Use database triggers + transition table pattern
- **Storing re-entry timestamps in separate table:** Log in existing scan_logs table, query for re-entry detection

## Don't Hand-Roll

Problems that have existing solutions in the codebase:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Race condition on VIP booking | Custom mutex/semaphore | `create_vip_reservation_atomic` RPC | Already uses FOR UPDATE row locking |
| Race condition on check-in | Application-level lock | `check_in_vip_guest_atomic` RPC | Already uses FOR UPDATE, returns checked_in_guests count |
| Offline VIP scanning | Custom localStorage queue | `vip-offline-queue-service.ts` | Already has Dexie.js, exponential backoff, auto-sync |
| Signature verification | Custom HMAC | `verify_vip_pass_signature` RPC | Already in database, handles multiple signature formats |
| GA-VIP linking | Manual ticket lookup | `vip_linked_tickets` table + `getGuestPassByQrToken` fallback | Already implemented |
| Real-time updates | Polling interval | Supabase Realtime channels | Built into @supabase/supabase-js |

**Key insight:** The hardest concurrency problems (reservation race conditions, check-in conflicts) are already solved with atomic RPC functions. Phase 4 work is about enforcing state transitions, extending scanner logic for re-entry, and wiring up realtime subscriptions.

## Common Pitfalls

### Pitfall 1: State Transition Without Database Enforcement
**What goes wrong:** Application code allows going from `checked_in` back to `confirmed`, corrupting reservation state
**Why it happens:** Only checking transitions in TypeScript service layer, not at database level
**How to avoid:** Add state transition trigger on vip_reservations table (see Pattern 1)
**Warning signs:** Reservations with impossible status history, checked_in_at populated but status is 'confirmed'

### Pitfall 2: Re-entry Treated as Duplicate Scan Error
**What goes wrong:** VIP host re-enters venue, scanner shows "Already checked in" rejection
**Why it happens:** Current check_in_vip_guest_atomic returns error on already-checked-in status
**How to avoid:** Create separate `process_vip_scan_with_reentry` function that distinguishes first-entry vs re-entry
**Warning signs:** Support complaints about VIP being rejected at gate after stepping out

### Pitfall 3: Floor Plan Not Updating After Cancellation
**What goes wrong:** Owner cancels reservation, floor plan still shows table as reserved
**Why it happens:** Floor plan fetches on mount, no subscription to status changes
**How to avoid:** Subscribe to vip_reservations changes via Supabase Realtime
**Warning signs:** Staff manually refreshing page to see updated availability

### Pitfall 4: Linked GA Ticket Checked In But VIP Status Not Updated
**What goes wrong:** Linked guest checks in via their GA ticket, but VIP reservation `checked_in_guests` count doesn't update
**Why it happens:** GA ticket scan uses regular ticket flow, doesn't call VIP check-in function
**How to avoid:** In scanner, detect linked tickets via vip_linked_tickets lookup, update VIP reservation after successful GA scan
**Warning signs:** VIP dashboard shows "0 of 6 guests arrived" but guests are inside

### Pitfall 5: Concurrent Cancellation Race Condition
**What goes wrong:** Two admins try to cancel same reservation simultaneously, both see success, but refund may double-process
**Why it happens:** No locking on cancellation flow
**How to avoid:** Add FOR UPDATE to cancellation function, check status before proceeding
**Warning signs:** Double refunds in Stripe, customer receives multiple cancellation emails

### Pitfall 6: Unified QR Not Created for VIP Purchaser
**What goes wrong:** VIP purchaser buys table but doesn't get GA ticket included, has to buy separately
**Why it happens:** VIP booking flow doesn't create GA ticket for purchaser
**How to avoid:** Per CONTEXT.md decision, VIP purchaser MUST buy GA ticket at time of VIP table purchase - enforce in checkout flow
**Warning signs:** VIP purchasers with no entry ticket, separate GA purchase confusion

## Code Examples

### Example 1: State Transition Validation Trigger

```sql
-- Source: PostgreSQL state machine patterns
-- Reference: https://blog.lawrencejones.dev/state-machines/

-- Status enum (if not exists)
DO $$ BEGIN
  CREATE TYPE vip_reservation_status AS ENUM (
    'pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'expired', 'no_show'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Forward-only transition validation
CREATE OR REPLACE FUNCTION validate_vip_status_transition()
RETURNS TRIGGER AS $$
DECLARE
  valid_transitions text[][] := ARRAY[
    ['pending', 'confirmed'],
    ['pending', 'cancelled'],
    ['pending', 'expired'],
    ['confirmed', 'checked_in'],
    ['confirmed', 'cancelled'],  -- Owner cancellation pre-event only
    ['checked_in', 'completed']
  ];
  transition_valid boolean := false;
BEGIN
  -- Skip if no status change
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Check all valid transitions
  FOR i IN 1..array_length(valid_transitions, 1) LOOP
    IF OLD.status::text = valid_transitions[i][1] AND NEW.status::text = valid_transitions[i][2] THEN
      transition_valid := true;
      EXIT;
    END IF;
  END LOOP;

  IF NOT transition_valid THEN
    RAISE EXCEPTION 'Invalid VIP status transition: % -> %. Reservation ID: %',
      OLD.status, NEW.status, OLD.id;
  END IF;

  -- Additional business rule: can only cancel confirmed if event hasn't started
  IF OLD.status = 'confirmed' AND NEW.status = 'cancelled' THEN
    DECLARE
      event_started boolean;
    BEGIN
      SELECT (event_date || ' ' || event_time)::timestamp < NOW()
      INTO event_started
      FROM events WHERE id = OLD.event_id;

      IF event_started THEN
        RAISE EXCEPTION 'Cannot cancel reservation after event has started';
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Example 2: VIP Scan with Re-entry Support

```typescript
// Source: User decisions from 04-CONTEXT.md
// Enhanced scanner logic for VIP re-entry

interface VipScanResult {
  success: boolean;
  entryType: 'first_entry' | 'reentry' | 'rejected';
  displayType: 'vip_host' | 'vip_guest' | 'vip_linked_guest';
  message: string;
  pass?: VipGuestPass;
  reservation?: VipReservation;
  checkedInGuests?: number;
  totalGuests?: number;
  lastEntryTime?: string;
}

async function processVipScanWithReentry(
  qrToken: string,
  scannedBy: string
): Promise<VipScanResult> {
  // Get pass and reservation
  const result = await getGuestPassByQrToken(qrToken);

  if (!result) {
    return {
      success: false,
      entryType: 'rejected',
      displayType: 'vip_guest',
      message: 'Invalid VIP pass'
    };
  }

  const { pass, reservation } = result;

  // Check reservation status
  if (!['confirmed', 'checked_in'].includes(reservation.status)) {
    return {
      success: false,
      entryType: 'rejected',
      displayType: 'vip_guest',
      message: `Reservation is ${reservation.status}`,
      reservation
    };
  }

  const isLinkedTicket = pass.guest_number === 0;
  const displayType = isLinkedTicket
    ? 'vip_linked_guest'
    : pass.guest_number === 1
      ? 'vip_host'
      : 'vip_guest';

  // First entry - check in
  if (pass.status === 'issued') {
    const checkedIn = await checkInGuestPass(pass.id, scannedBy);
    return {
      success: true,
      entryType: 'first_entry',
      displayType,
      message: `Welcome! Guest ${pass.guest_number} checked in`,
      pass: checkedIn,
      reservation,
      checkedInGuests: reservation.checked_in_guests + 1,
      totalGuests: reservation.package_snapshot?.guestCount
    };
  }

  // Re-entry - allow for VIP and linked guests
  if (pass.status === 'checked_in') {
    // Log re-entry (don't update status)
    await logVipReentry(pass.id, scannedBy);

    return {
      success: true,
      entryType: 'reentry',
      displayType,
      message: 'Re-entry granted',
      pass,
      reservation,
      lastEntryTime: pass.checked_in_at || undefined,
      checkedInGuests: reservation.checked_in_guests,
      totalGuests: reservation.package_snapshot?.guestCount
    };
  }

  return {
    success: false,
    entryType: 'rejected',
    displayType,
    message: `Pass status is ${pass.status}`,
    pass,
    reservation
  };
}
```

### Example 3: Floor Plan with Realtime Subscription

```typescript
// Source: Supabase Realtime documentation
// For VIPTableFloorPlan.tsx

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getAvailableTablesForEvent } from '@/lib/vip-tables-service';

function useRealtimeFloorPlan(eventId: string) {
  const [tables, setTables] = useState<VipTableWithAvailability[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTables = useCallback(async () => {
    const data = await getAvailableTablesForEvent(eventId);
    setTables(data);
    setIsLoading(false);
  }, [eventId]);

  useEffect(() => {
    // Initial fetch
    fetchTables();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`floor-plan-${eventId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'vip_reservations',
        filter: `event_id=eq.${eventId}`
      }, () => {
        console.log('[floor-plan] Reservation changed, refetching');
        fetchTables();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'event_vip_tables',
        filter: `event_id=eq.${eventId}`
      }, () => {
        console.log('[floor-plan] Table updated, refetching');
        fetchTables();
      })
      .subscribe((status) => {
        console.log('[floor-plan] Subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, fetchTables]);

  return { tables, isLoading, refetch: fetchTables };
}
```

### Example 4: Owner Event Cancellation with Refunds

```typescript
// Source: Phase 1 Stripe patterns + user decision from 04-CONTEXT.md
// Edge function for owner-initiated cancellation

interface CancelEventResult {
  success: boolean;
  refundsProcessed: number;
  totalRefunded: number;
  errors: string[];
}

async function cancelEventWithRefunds(
  eventId: string,
  ownerId: string
): Promise<CancelEventResult> {
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
  const supabase = createClient(/* ... */);

  // Get all confirmed VIP reservations for this event
  const { data: reservations } = await supabase
    .from('vip_reservations')
    .select('id, stripe_payment_intent_id, amount_paid_cents, purchaser_email')
    .eq('event_id', eventId)
    .in('status', ['confirmed', 'checked_in']);

  const errors: string[] = [];
  let refundsProcessed = 0;
  let totalRefunded = 0;

  for (const reservation of reservations || []) {
    if (!reservation.stripe_payment_intent_id) {
      // Walk-in or manual payment - no Stripe refund
      continue;
    }

    try {
      // Create Stripe refund
      const refund = await stripe.refunds.create({
        payment_intent: reservation.stripe_payment_intent_id,
        reason: 'requested_by_customer', // Event cancellation
      });

      // Update reservation status
      await supabase
        .from('vip_reservations')
        .update({
          status: 'cancelled',
          cancellation_reason: 'event_cancelled',
          refund_id: refund.id,
          refunded_at: new Date().toISOString(),
        })
        .eq('id', reservation.id);

      refundsProcessed++;
      totalRefunded += reservation.amount_paid_cents / 100;
    } catch (error) {
      errors.push(`Refund failed for ${reservation.id}: ${error.message}`);
    }
  }

  // Reset table availability
  await supabase
    .from('event_vip_tables')
    .update({ is_available: true })
    .eq('event_id', eventId);

  return {
    success: errors.length === 0,
    refundsProcessed,
    totalRefunded,
    errors,
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Application-level state validation | Database triggers + transition tables | 2020+ | Impossible invalid states, audit trail |
| Polling for floor plan updates | Supabase Realtime websockets | 2024+ | Instant updates, lower battery drain |
| Custom offline sync | Dexie.js + IndexedDB | 2023+ | Already in codebase |
| Separate VIP and GA flows | Unified ticket with VIP linking | 2025+ | Better UX, single QR code |

**Current in codebase:**
- Atomic RPC functions for race conditions (create, check-in, verify) - already implemented
- Row-level locking with FOR UPDATE - already implemented
- VIP offline queue with Dexie.js - already implemented
- vip_linked_tickets table for GA-VIP linking - already exists

**Missing (Phase 4 scope):**
- Database trigger for forward-only state transitions
- Re-entry detection and handling
- Realtime subscriptions for floor plan
- Owner cancellation with bulk refund

## Open Questions

Things that need validation during implementation:

1. **Guest Linking Mechanism**
   - What we know: vip_linked_tickets table exists, invite_code column exists on vip_reservations
   - What's unclear: Exact UX flow for guests to link their GA tickets to VIP table
   - Recommendation (Claude's Discretion): Invite code approach - VIP purchaser shares code, guest enters at checkout to auto-link
   - Alternative: Staff manual linking at door if guest arrives without linking

2. **Over-Capacity Handling**
   - What we know: `check_vip_capacity` function exists in migration
   - What's unclear: What happens when table is at capacity and more guests try to link
   - Recommendation (Claude's Discretion): Soft cap with warning, allow owner override

3. **Floor Plan Guest Count Display**
   - What we know: checked_in_guests tracked on vip_reservations
   - What's unclear: Should floor plan show arrived count per table?
   - Recommendation (Claude's Discretion): Show on hover/tap - "Table 5: 4/6 arrived"

4. **Late Linking Behavior**
   - What we know: VIP purchaser can manage guest list until event starts
   - What's unclear: Can existing GA ticket holders link late (at the door)?
   - Recommendation (Claude's Discretion): Allow staff manual linking capability

5. **Unified QR Implementation**
   - What we know: VIP purchaser must buy GA at time of VIP purchase
   - What's unclear: Single transaction or sequential (VIP first, then GA auto-added)?
   - Recommendation: Single checkout session that creates both VIP reservation + GA ticket

## Sources

### Primary (HIGH confidence)
- Codebase analysis: maguey-pass-lounge/src/lib/vip-tables-service.ts
- Codebase analysis: maguey-gate-scanner/src/lib/vip-tables-admin-service.ts
- Codebase analysis: maguey-pass-lounge/supabase/migrations/20260122000000_fix_vip_race_condition_and_rls.sql
- Codebase analysis: maguey-pass-lounge/supabase/migrations/20260128110000_vip_ga_integration.sql
- User decisions: .planning/phases/04-vip-system-reliability/04-CONTEXT.md
- Phase 3 research: .planning/phases/03-scanner-system-hardening/03-RESEARCH.md (offline patterns)
- Phase 1 research: .planning/phases/01-payment-flow-hardening/01-RESEARCH.md (refund patterns)

### Secondary (MEDIUM confidence)
- [PostgreSQL Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html) - FOR UPDATE patterns
- [PostgreSQL Row-Level Locks Guide](https://scalablearchitect.com/postgresql-row-level-locks-a-complete-guide-to-for-update-for-share-skip-locked-and-nowait/) - NOWAIT, SKIP LOCKED patterns
- [State Machines in PostgreSQL](https://felixge.de/2017/07/27/implementing-state-machines-in-postgresql/) - Transition table pattern
- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime) - Postgres changes subscription
- [Race Conditions in Booking Systems](https://hackernoon.com/how-to-solve-race-conditions-in-a-booking-system) - Distributed locking patterns

### Tertiary (LOW confidence)
- WebSearch results for VIP ticketing patterns - General industry guidance

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and in use
- Architecture: HIGH - Patterns derived from existing codebase atomic functions
- State machine: HIGH - PostgreSQL trigger/constraint patterns well-documented
- Realtime: HIGH - Supabase Realtime extensively documented
- Pitfalls: HIGH - Based on existing code gaps and CONTEXT.md requirements

**Research date:** 2026-01-30
**Valid until:** 60 days (stable domain, PostgreSQL patterns don't change)

---

## Gap Analysis Summary

| Requirement | Current State | Gap | Effort |
|-------------|---------------|-----|--------|
| VIP-01: Status transitions correct | No DB enforcement | Add transition trigger | Medium |
| VIP-02: Concurrent checkin no corruption | Atomic RPC exists | Need re-entry handling | Low |
| VIP-03: Guest passes link correctly | vip_linked_tickets exists | Scanner fallback needs work | Low |
| VIP-04: Floor plan real-time | Fetches on demand | Add Realtime subscription | Low |
| Floor plan cancellation updates | Not wired | Subscribe to status changes | Low |
| Unified VIP QR | Separate passes | Checkout flow change | Medium |
| Re-entry for VIP | Rejected on second scan | New scan function | Medium |
| Owner cancellation with refund | Not implemented | New edge function | Medium |
| Forward-only transitions | App-level only | DB trigger | Low |
