# GA + VIP Link UAT Test Script

**Phase:** 09-vip-end-to-end-testing
**Plan:** 09-05
**Created:** 2026-01-31
**Purpose:** Validate GA tickets with VIP link get re-entry privilege while regular GA tickets are rejected on second scan

## Prerequisites

1. Seed data applied from 09-01 (check: `vip_linked_tickets` has test records)
2. Scanner app running: `cd maguey-gate-scanner && npm run dev`
3. Browser open to http://localhost:5174
4. Test event selected in scanner dropdown

## Test Data Reference

| Token | Type | Expected Behavior |
|-------|------|-------------------|
| GA-VIP-LINKED-01 | GA linked to VIP Table | Re-entry allowed, shows VIP table info |
| GA-VIP-LINKED-02 | GA linked to VIP Table | Re-entry allowed, shows VIP table info |
| GA-VIP-LINKED-03 | GA linked to VIP Table | Re-entry allowed, shows VIP table info |
| GA-REGULAR-TEST-01 | Regular GA (no VIP link) | One-time entry only, rejected on re-scan |

## How to Execute Tests

For each test case:
1. Navigate to: `http://localhost:5174/scanner?qr=TOKEN`
2. Observe the scan result overlay
3. Record result in the "Actual" column
4. Mark Status as PASS or FAIL

---

## Linked GA Ticket Tests (VIP Privilege)

These tickets are linked to a VIP reservation and should inherit VIP re-entry privilege.

| ID | Test Case | Steps | Expected | Actual | Status | Notes |
|----|-----------|-------|----------|--------|--------|-------|
| TC-GAL-01 | First scan of linked GA | `?qr=GA-VIP-LINKED-01` | GREEN success overlay, shows "Guest of Table X" or VIP info | | | |
| TC-GAL-02 | Re-scan of linked GA (re-entry) | `?qr=GA-VIP-LINKED-01` again | GREEN success with GOLD "RE-ENTRY GRANTED" banner, shows VIP table info | | | |
| TC-GAL-03 | Third scan of linked GA | `?qr=GA-VIP-LINKED-01` third time | GREEN success with GOLD "RE-ENTRY GRANTED" banner (unlimited re-entries) | | | |
| TC-GAL-04 | First scan of second linked GA | `?qr=GA-VIP-LINKED-02` | GREEN success overlay, VIP guest count incremented | | | |
| TC-GAL-05 | Re-scan of second linked GA | `?qr=GA-VIP-LINKED-02` again | GREEN success with GOLD re-entry banner | | | |

---

## Regular GA Ticket Tests (No VIP Privilege)

These are standard GA tickets without VIP link - should be one-time entry only.

| ID | Test Case | Steps | Expected | Actual | Status | Notes |
|----|-----------|-------|----------|--------|--------|-------|
| TC-GAR-01 | First scan of regular GA | `?qr=GA-REGULAR-TEST-01` | GREEN success overlay, standard GA check-in (no VIP info) | | | |
| TC-GAR-02 | Re-scan of regular GA | `?qr=GA-REGULAR-TEST-01` again | RED rejection overlay, "Already used" error | | | |
| TC-GAR-03 | Third scan of regular GA | `?qr=GA-REGULAR-TEST-01` third time | RED rejection overlay, "Already used" error | | | |

---

## Comparison Tests

Verify visual differences between linked and regular GA tickets.

| ID | Test Case | Steps | Expected | Actual | Status | Notes |
|----|-----------|-------|----------|--------|--------|-------|
| TC-CMP-01 | Linked ticket shows VIP info | Scan GA-VIP-LINKED-01 | Success overlay displays "Guest of Table X" or VIP table details | | | |
| TC-CMP-02 | Regular ticket no VIP info | Scan GA-REGULAR-TEST-01 (fresh) | Success overlay shows only GA ticket info, NO VIP details | | | Requires fresh ticket |
| TC-CMP-03 | VIP checked_in_guests count | Check vip_reservations table after linked scans | `checked_in_guests` count includes linked GA scans | | | SQL verification |

---

## Edge Cases

| ID | Test Case | Steps | Expected | Actual | Status | Notes |
|----|-----------|-------|----------|--------|--------|-------|
| TC-EDG-01 | Linked ticket before VIP host | Scan GA-VIP-LINKED-03 before host scans | SUCCESS - linked tickets independent of host check-in | | | |
| TC-EDG-02 | Verify scan log entry type | Check vip_scan_logs after linked ticket scans | entry_type='first_entry' on first, 'reentry' on subsequent | | | SQL verification |
| TC-EDG-03 | Invalid token | `?qr=INVALID-TOKEN-XYZ` | RED rejection, "Not found" or "Invalid ticket" | | | |
| TC-EDG-04 | Empty token | `?qr=` | No action (empty parameter ignored) | | | |

---

## SQL Verification Queries

### Check VIP linked tickets exist
```sql
SELECT t.qr_code_token, vlt.*, vr.table_number
FROM vip_linked_tickets vlt
JOIN tickets t ON t.id = vlt.ticket_id
JOIN vip_reservations vr ON vr.id = vlt.reservation_id
WHERE t.qr_code_token LIKE 'GA-VIP-LINKED%';
```

### Check checked_in_guests count
```sql
SELECT id, table_number, checked_in_guests, guest_count
FROM vip_reservations
WHERE id = '[RESERVATION_ID]';
```

### Check scan log entries
```sql
SELECT entry_type, scanned_at, qr_code_token
FROM vip_scan_logs
WHERE qr_code_token LIKE 'GA-VIP-LINKED%'
ORDER BY scanned_at DESC;
```

---

## Critical Differences Summary

| Scenario | Linked GA Ticket | Regular GA Ticket |
|----------|------------------|-------------------|
| First scan | SUCCESS + VIP info | SUCCESS (no VIP info) |
| Second scan | RE-ENTRY GRANTED (gold banner) | REJECTED (already used) |
| Third scan | RE-ENTRY GRANTED | REJECTED |
| UI shows | "Guest of Table X" | Standard GA display |
| Haptic feedback | VIP triple pulse | Standard success |

---

## UAT Results Summary

**Executed by:** _______________
**Date:** _______________

| Category | Passed | Failed | Blocked |
|----------|--------|--------|---------|
| Linked GA Tests (TC-GAL) | /5 | /5 | /5 |
| Regular GA Tests (TC-GAR) | /3 | /3 | /3 |
| Comparison Tests (TC-CMP) | /3 | /3 | /3 |
| Edge Cases (TC-EDG) | /4 | /4 | /4 |
| **TOTAL** | /15 | /15 | /15 |

**Overall Result:** [ ] PASS [ ] FAIL

**Notes:**
_________________________
