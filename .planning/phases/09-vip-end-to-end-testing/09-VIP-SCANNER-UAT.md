# VIP Scanner UAT Script

**Phase:** 09-vip-end-to-end-testing
**Plan:** 04
**Date:** 2026-01-31

## Prerequisites

Before running these test cases:

1. **Seed data applied** - 09-01-PLAN.md must be complete (VIP reservation and guest passes created)
2. **Scanner app running** - `cd maguey-gate-scanner && npm run dev`
3. **Browser open** - http://localhost:5174
4. **Event selected** - Select "VIP Test Event" from the event list
5. **Navigate to VIP scanner** - Click on VIP Scanner tab or navigate to /vip-scanner

## Test Data Reference

| Token | Guest # | Purpose |
|-------|---------|---------|
| VIP-TEST-GUEST-01 | 1 | First entry, then re-entry test |
| VIP-TEST-GUEST-02 | 2 | First entry, then re-entry test |
| VIP-TEST-GUEST-03 | 3 | Offline mode test |
| VIP-TEST-GUEST-04 | 4 | Available for additional tests |
| VIP-TEST-GUEST-05 | 5 | Available for additional tests |
| VIP-TEST-GUEST-06 | 6 | Available for additional tests |
| VIP-TEST-GUEST-07 | 7 | Available for additional tests |
| VIP-TEST-GUEST-08 | 8 | Available for additional tests |

**Reservation ID:** aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
**Host QR Token:** VIP-RESERVATION-TEST-001

## URL Pattern

Navigate to VIP scanner with QR token:
```
http://localhost:5174/vip-scanner?qr=TOKEN
```

Example:
```
http://localhost:5174/vip-scanner?qr=VIP-TEST-GUEST-01
```

---

## Test Cases

### First Entry Tests

| ID | Test Case | Steps | Expected Result | Actual | Status | Notes |
|----|-----------|-------|-----------------|--------|--------|-------|
| TC-VIP-01 | First guest scans VIP-TEST-GUEST-01 | 1. Navigate to `http://localhost:5174/vip-scanner?qr=VIP-TEST-GUEST-01` | Success overlay with "Guest 1 of X checked in successfully!" | | | |
| TC-VIP-02 | Second guest scans VIP-TEST-GUEST-02 | 1. Wait for TC-VIP-01 to complete<br>2. Navigate to `http://localhost:5174/vip-scanner?qr=VIP-TEST-GUEST-02` | Success overlay with "Guest 2 of X checked in successfully!" | | | |
| TC-VIP-03 | Verify checked_in_guests count | 1. Check Supabase: `SELECT checked_in_guests FROM vip_reservations WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'` | checked_in_guests = 2 | | | |

### Re-entry Tests

| ID | Test Case | Steps | Expected Result | Actual | Status | Notes |
|----|-----------|-------|-----------------|--------|--------|-------|
| TC-VIP-04 | Re-scan VIP-TEST-GUEST-01 | 1. Reset scanner (click "Scan Another")<br>2. Navigate to `http://localhost:5174/vip-scanner?qr=VIP-TEST-GUEST-01` | Re-entry granted with gold banner and "Guest 1 re-entry granted" | | | |
| TC-VIP-05 | Re-scan VIP-TEST-GUEST-02 | 1. Reset scanner<br>2. Navigate to `http://localhost:5174/vip-scanner?qr=VIP-TEST-GUEST-02` | Re-entry granted with gold banner and "Guest 2 re-entry granted" | | | |
| TC-VIP-06 | Verify vip_scan_logs entry_type | 1. Check Supabase: `SELECT entry_type FROM vip_scan_logs WHERE pass_id IN (SELECT id FROM vip_guest_passes WHERE qr_token IN ('VIP-TEST-GUEST-01', 'VIP-TEST-GUEST-02')) ORDER BY scanned_at DESC LIMIT 4` | Should have 2 'entry' and 2 'reentry' records | | | |

### Error Tests

| ID | Test Case | Steps | Expected Result | Actual | Status | Notes |
|----|-----------|-------|-----------------|--------|--------|-------|
| TC-VIP-07 | Scan invalid token | 1. Navigate to `http://localhost:5174/vip-scanner?qr=INVALID-TOKEN-12345` | Red rejection overlay with "Invalid VIP guest pass. QR code not found." | | | |
| TC-VIP-08 | Scan empty string | 1. Navigate to `http://localhost:5174/vip-scanner?qr=` | No action (empty param should be ignored) or rejection | | | |

### Offline Tests

| ID | Test Case | Steps | Expected Result | Actual | Status | Notes |
|----|-----------|-------|-----------------|--------|--------|-------|
| TC-VIP-09 | Queue scan while offline | 1. Open DevTools (F12)<br>2. Go to Network tab<br>3. Check "Offline" checkbox<br>4. Navigate to `http://localhost:5174/vip-scanner?qr=VIP-TEST-GUEST-03`<br>5. Observe result | - Offline banner displayed<br>- Scan queued message<br>- "1 pending" badge shown | | | |
| TC-VIP-10 | Sync when back online | 1. Uncheck "Offline" in DevTools<br>2. Wait for auto-sync or click "Sync Now" | - Pending scans synced<br>- Success confirmation<br>- Badge cleared | | | |

---

## Summary

| Category | Total | Passed | Failed | Blocked |
|----------|-------|--------|--------|---------|
| First Entry | 3 | | | |
| Re-entry | 3 | | | |
| Error | 2 | | | |
| Offline | 2 | | | |
| **Total** | **10** | | | |

## Test Execution Notes

**Tester:**
**Date:**
**Browser:**
**Scanner Version:**

### Issues Found

1. (None yet)

### Observations

- (Add observations during testing)
