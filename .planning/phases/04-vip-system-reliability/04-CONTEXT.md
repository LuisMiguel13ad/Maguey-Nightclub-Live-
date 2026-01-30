# Phase 4: VIP System Reliability - Context

**Gathered:** 2026-01-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Ensure VIP reservations maintain correct state through their entire lifecycle — from booking to check-in to completion. Fix race conditions, validate state transitions, and ensure floor plan accuracy. This is hardening work on existing VIP functionality, not new feature development.

</domain>

<decisions>
## Implementation Decisions

### Unified VIP QR Code
- VIP table purchaser MUST buy a GA ticket at time of VIP table purchase
- This creates ONE unified QR code that: grants entry + marks table as "arrived" + identifies them as VIP
- No separate QR codes — single scan does everything
- Scanner shows full VIP details: table number, tier, guest list

### Concurrent Checkin Handling
- First scan wins, second scanner sees "already checked in"
- Use database row-level locking (same pattern as Phase 3 GA scanning)
- VIP reservations pre-downloaded to scanner cache for offline use
- When linked guest scans, show "Guest of Table X" on scanner display

### Re-entry Policy
- VIP purchasers: can re-enter (allow multiple scans)
- Linked guests: can re-enter (same as VIP treatment)
- Regular GA tickets: one-time entry only (no re-entry)
- Re-entry is a VIP perk

### State Transitions
- Forward-only transitions: pending → confirmed → checked-in → completed
- No reverse transitions (can't go from confirmed back to pending)
- Once checked-in, status stays checked-in all night (no tracking in/out)
- Completed status set automatically when event ends

### Guest Pass Behavior
- VIP guests must buy their own GA tickets (owner's business requirement)
- GA tickets can be linked to VIP tables
- Guest limit based on table tier/capacity
- One GA ticket can only link to one VIP table
- Guests can check in before host arrives (as long as table is paid)
- Unlinking a guest before event: their ticket becomes regular GA (no table access)
- VIP purchaser can manage guest list until event starts (no changes during event)
- Notify VIP purchaser when linked guests check in (Phase 7 implementation)

### Cancellation Handling
- Customer-initiated cancellation: No refunds, all sales final
- Owner-initiated event cancellation: Full refund for all reservations
- Cancellation flow: Owner clicks Cancel → Confirmation with refund total → Approve → Auto-refund via Stripe
- Mid-event cancellation not supported (can only cancel before event starts)
- Floor plan resets to "available" when event is cancelled

### Claude's Discretion
- Guest linking mechanism (invite code vs email matching vs staff manual)
- Over-capacity handling when too many guests linked
- Floor plan guest count display (show arrived count or not)
- Late linking of existing GA tickets to VIP tables
- Staff manual linking capability at the door

</decisions>

<specifics>
## Specific Ideas

- VIP purchaser should get "VIP treatment" display on scanner — full details, not minimal like GA
- Guests should see their table assignment when they scan
- Floor plan should update in real-time when VIP/guests arrive
- Ensure Supabase data consistency for all cancellation flows

</specifics>

<deferred>
## Deferred Ideas

- Push notification to VIP when guests arrive — Phase 7 (UX Polish)
- Cancel Event button placement in dashboard — Phase 5 (Dashboard Accuracy)
- Guest arrival notifications via SMS — Phase 7 (UX Polish)

</deferred>

---

*Phase: 04-vip-system-reliability*
*Context gathered: 2026-01-30*
