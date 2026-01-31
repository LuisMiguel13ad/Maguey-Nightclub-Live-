# Phase 9: VIP End-to-End Testing - Context

**Created:** 2026-01-31
**Status:** Context gathered, ready for planning

## Overview

Phase 9 validates the complete VIP reservation flow from purchase to gate entry, including guest passes and re-entry scenarios.

## Success Criteria (from ROADMAP.md)

1. Test VIP booking completes: payment → webhook → reservation confirmed → email with table details
2. VIP floor plan shows table as booked immediately after confirmation
3. VIP QR code scans successfully and marks reservation as checked-in
4. Guest passes link correctly and scan independently at gate
5. Multiple concurrent check-ins for same reservation handled correctly

## Dependencies

- Phase 1: Payment Flow Hardening (complete)
- Phase 2: Email Reliability (complete)
- Phase 3: Scanner System Hardening (complete)
- Phase 4: VIP System Reliability (complete)
- Phase 7: UX Polish (pending - not blocking)

## Gray Area Decisions

### 1. Migration Prerequisites

**Decision:** Verify first

Phase 9 Plan 1 will verify all VIP RPCs exist on remote Supabase DB before testing. Fails fast if any are missing.

**Required RPCs to verify:**
- `check_vip_linked_ticket_reentry`
- `process_vip_scan_with_reentry`
- `scan_ticket_atomic`
- `increment_vip_checked_in`
- `create_unified_vip_checkout`
- `verify_vip_pass_signature`
- `link_ticket_to_vip`
- `check_vip_capacity`

### 2. Testing Approach

**Decision:** Hybrid

| Flow Type | Test Method | Reason |
|-----------|-------------|--------|
| VIP checkout | Playwright E2E | Browser-based, automatable |
| Floor plan updates | Playwright E2E | Observable in browser |
| Scanner validation | Manual UAT | Requires QR input or camera |
| Re-entry scenarios | Manual UAT | Scanner-based |
| Guest pass linking | Playwright + Manual | Checkout in browser, scan manual |

### 3. Scanner Testing Strategy

**QR Input Decision:** URL parameter

Scanner page accepts `?qr=TOKEN` query parameter for testing purposes. This bypasses camera requirement.

Example: `/scanner?qr=VIP-PASS-ABC123`

Implementation note: Scanner already parses QR tokens - URL param just provides alternative input source.

**Offline Testing Decision:** DevTools Network offline

Use browser DevTools > Network > Offline toggle to simulate network failure during scan. Verify:
- Scan queues locally
- UI shows offline indicator
- Scans sync when network restored

### 4. Test Data Setup

**Decision:** SQL seed script

Create `seed-vip-e2e-test.sql` that:
1. Creates test event (future date)
2. Creates 3 VIP tables (different tiers)
3. Creates VIP reservation (confirmed status)
4. Creates guest passes (3 guests)
5. Creates linked GA tickets
6. Creates regular GA ticket (for comparison)

Script outputs QR tokens for use in manual testing.

### 5. Email Verification Scope

**Decision:** Full delivery verification

Verify actual email delivery using Resend webhooks:
1. Check email_queue entry created
2. Wait for Resend webhook with delivery status
3. Verify email_delivery_status updated to "delivered"
4. Check Resend dashboard for email content if needed

### 6. Concurrent Check-in Testing

**Decision:** Database-level test

Create SQL script that:
1. Sets up VIP reservation with 5 guest passes
2. Uses `pg_background` or parallel connections to call `process_vip_scan_with_reentry` concurrently
3. Verifies:
   - No duplicate check-ins
   - `checked_in_guests` count is accurate
   - All scans logged to `vip_scan_logs`
   - No race condition errors

## Existing Test Infrastructure

### Playwright Setup
- Config: `maguey-pass-lounge/playwright.config.ts`
- Tests: `maguey-pass-lounge/playwright/tests/`
- Existing GA checkout test: `checkout.spec.ts`
- Base URL: `http://localhost:5173`

### Scanner App
- Location: `maguey-gate-scanner/`
- VIP Scanner: `src/components/vip/VIPScanner.tsx`
- Main Scanner: `src/pages/Scanner.tsx`
- VIP Tables Admin: `src/pages/VipTablesManagement.tsx`

## VIP System Architecture Summary

### State Machine
```
pending → confirmed → checked_in → completed
   ↓
cancelled (from pending or confirmed only)
```

### Key Tables
- `event_vip_tables` - VIP table inventory
- `vip_reservations` - Bookings with state machine
- `vip_guest_passes` - Individual guest passes
- `vip_linked_tickets` - GA tickets linked to VIP
- `vip_scan_logs` - Audit trail for all scans

### Re-entry Support
- VIP guests can re-enter unlimited times
- `entry_type: 'first_entry' | 'reentry'`
- Linked GA tickets inherit VIP re-entry privilege

## Test Scenarios to Cover

### Happy Path
1. VIP booking with GA ticket selection
2. Payment completion via Stripe
3. Confirmation email with QR codes
4. Floor plan shows table booked
5. First guest scan (first_entry)
6. Re-entry scan (reentry)
7. Linked GA ticket scan with VIP privilege

### Error Scenarios
1. Invalid QR code rejected
2. Cancelled pass rejected
3. Unconfirmed reservation rejected
4. Regular GA ticket rejected on second scan

### Edge Cases
1. Multiple guests scanning simultaneously
2. Offline scan with sync
3. Capacity limit enforcement for linked tickets

## Plan Structure (Proposed)

| Plan | Focus |
|------|-------|
| 09-01 | Migration verification and seed data setup |
| 09-02 | Playwright: VIP checkout E2E test |
| 09-03 | Playwright: Floor plan realtime updates test |
| 09-04 | Manual UAT: VIP scanner flows (first entry, re-entry) |
| 09-05 | Manual UAT: GA ticket with VIP link re-entry |
| 09-06 | Concurrency test: Multiple simultaneous check-ins |
| 09-07 | Email delivery verification |

## Notes

- Phase 4 UAT (`04-UAT.md`) shows 5/8 tests blocked due to unapplied migrations
- Priority is verifying migrations are applied before any testing
- Scanner tests require either physical device or `?qr=TOKEN` URL parameter
