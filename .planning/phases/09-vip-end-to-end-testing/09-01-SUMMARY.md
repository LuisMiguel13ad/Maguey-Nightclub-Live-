# Phase 9 Plan 01: Migration Verification and Seed Data Setup - SUMMARY

**Status:** ✅ Complete
**Date:** 2026-01-31

## Overview

This plan verified all VIP RPCs exist on the remote database and created idempotent test data for VIP E2E testing.

## Tasks Completed

### Task 1: Create Verification Script ✅
- Created `scripts/verify-vip-migrations.ts`
- Verifies 8 required VIP RPCs exist on remote Supabase

### Task 2: Create Seed Script ✅
- Created `scripts/apply-vip-seed.ts` (TypeScript, recommended)
- Created `maguey-pass-lounge/supabase/seed/vip-e2e-test-data.sql` (SQL)
- Both scripts are idempotent and can be run multiple times

### Task 3: Run Verification and Seed ✅
All 8 VIP RPCs verified on remote database:
- `check_vip_linked_ticket_reentry` ✓
- `process_vip_scan_with_reentry` ✓
- `scan_ticket_atomic` ✓
- `increment_vip_checked_in` ✓
- `create_unified_vip_checkout` ✓
- `verify_vip_pass_signature` ✓
- `link_ticket_to_vip` ✓
- `check_vip_capacity` ✓

## Schema Discovery

During implementation, discovered the actual database schema differs from migrations:

| Entity | Migration Column | Actual Column |
|--------|-----------------|---------------|
| events | `date`, `time` | `event_date`, `event_time` |
| event_vip_tables | `price`, `sort_order` | `price_cents`, `display_order` |
| event_vip_tables | (optional) | `table_template_id` (required FK) |
| vip_guest_passes | `qr_code_token`, `guest_number` | `qr_token`, `pass_number` |
| vip_guest_passes | `checked_in_at` | `scanned_at` |

The seed scripts have been updated to use the correct column names.

## Test Data Created

### Test Event
- **ID:** `99999999-9999-9999-9999-999999999999`
- **Name:** VIP E2E Test Event
- **Date:** 30 days from execution date
- **Status:** published, VIP-enabled

### VIP Tables (3)
| ID | Table # | Tier | Price | Capacity |
|----|---------|------|-------|----------|
| `11111111-...` | 101 | premium | $750 | 8 |
| `22222222-...` | 102 | front_row | $700 | 6 |
| `33333333-...` | 103 | standard | $600 | 6 |

### VIP Reservation
- **ID:** `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`
- **Table:** 101 (Premium)
- **Status:** confirmed
- **Host QR:** `VIP-RESERVATION-TEST-001`

### VIP Guest Passes (8)
| Pass # | QR Token | Status |
|--------|----------|--------|
| 1 | `VIP-TEST-GUEST-01` | active |
| 2 | `VIP-TEST-GUEST-02` | active |
| 3 | `VIP-TEST-GUEST-03` | active |
| 4 | `VIP-TEST-GUEST-04` | active |
| 5 | `VIP-TEST-GUEST-05` | active |
| 6 | `VIP-TEST-GUEST-06` | active |
| 7 | `VIP-TEST-GUEST-07` | active |
| 8 | `VIP-TEST-GUEST-08` | active |

## Usage

### Re-run Seed (if needed)
```bash
npx tsx scripts/apply-vip-seed.ts
```

### Scanner Testing
Use URL parameter to simulate QR scan:
```
http://localhost:3017/scanner?qr=VIP-TEST-GUEST-01
```

## Files Created/Modified

| File | Action |
|------|--------|
| `scripts/verify-vip-migrations.ts` | Created |
| `scripts/apply-vip-seed.ts` | Created |
| `scripts/check-schema.ts` | Created (utility) |
| `maguey-pass-lounge/supabase/seed/vip-e2e-test-data.sql` | Updated |

## Notes

1. **GA Ticket Linking**: The `vip_linked_tickets` table requires `order_id` (NOT NULL FK). Creating linked GA tickets for re-entry testing requires using:
   - The `create_unified_vip_checkout` RPC function
   - Or completing a real checkout flow in Pass Lounge

2. **Schema Cache**: The Supabase JS client and PostgREST use a schema cache that may not reflect recent migrations. Direct REST API calls or SQL Editor bypass this issue.

## Exit Criteria Met

- [x] Migration verification script created
- [x] All 8 VIP RPCs verified present on remote DB
- [x] Seed script created with predictable QR tokens
- [x] Test data applied to remote database
- [x] QR tokens documented for manual UAT
