---
phase: 18-scanner-improvements
plan: 03
subsystem: scanner
tags: [scanner, logging, audit-trail, security]
dependency_graph:
  requires: []
  provides: [failed-scan-logging]
  affects: [simple-scanner, scan-logs-table]
tech_stack:
  added: []
  patterns: [fire-and-forget-logging, sha256-hashing]
key_files:
  created: []
  modified:
    - maguey-gate-scanner/src/lib/simple-scanner.ts
decisions:
  - decision: "Fire-and-forget logging to never block scan flow"
    rationale: "Gate throughput is critical — logging must not add latency to scan response"
  - decision: "Hash scan input before logging for security"
    rationale: "Don't store raw QR data in logs — hash provides audit trail without exposing ticket tokens"
metrics:
  duration: 0
  tasks_completed: 3
  files_modified: 1
  commits: 0
  completed_date: "2026-02-15"
  note: "Pre-existing implementation — verified, not executed"
---

# Phase 18 Plan 03: Log failed scans to server scan_logs Summary

**One-liner:** All scan rejections now logged to scan_logs table via fire-and-forget logFailedScan() at every rejection point

## What Was Done

**Status: Pre-existing implementation** — All tasks were already implemented in the codebase prior to Phase 18 planning. Verified during execution.

### Implementation Found

1. `hashInput()` helper in simple-scanner.ts hashes scan input via `crypto.subtle.digest('SHA-256')` for secure logging
2. `logFailedScan()` function inserts into scan_logs with `scan_success: false`, device_id, scan_method, and metadata — wrapped in try/catch to never block scan flow
3. Fire-and-forget `logFailedScan()` calls at each rejection point:
   - Invalid/tampered QR → `invalid_signature` / `invalid_format`
   - No token → `invalid_input`
   - Unsigned QR → `unsigned_qr`
   - Not found → `not_found`
   - Already scanned (non-VIP) → `already_scanned`

## Requirements Resolved

- R22: Failed scans not logged to server scan_logs — RESOLVED

## Deviations from Plan

None — implementation matched plan exactly (code predated plan).

## Files Verified

### maguey-gate-scanner/src/lib/simple-scanner.ts
- `hashInput()` helper for SHA-256 hashing
- `logFailedScan()` with fire-and-forget pattern
- Calls at all rejection points in `scanTicket()`

## Self-Check: PASSED

- ✅ All failed scans logged to scan_logs table
- ✅ Logging never blocks or delays scan response
- ✅ Successful scans still log with scan_success=true (unchanged)
