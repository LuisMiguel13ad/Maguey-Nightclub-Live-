# Phase 18: Scanner Improvements

**Priority:** P1 | **Effort:** 2 days | **Dependencies:** Phase 17
**Goal:** Address the 6 scanner gaps identified in the system analysis.

## Issues Addressed

| GSD # | Issue | Requirement |
|-------|-------|-------------|
| 16 | No event date awareness (auto-detect tonight) | R19 |
| 17 | Event dropdown doesn't show dates | R20 |
| 18 | Offline mode accepts unknown tickets | R21 |
| 19 | Failed scans not logged to server scan_logs | R22 |
| 21 | No rate limiting on manual entry | R24 |
| 22 | No device ID shown to staff | R25 |

## Plans

| Plan | Objective | Wave |
|------|-----------|------|
| 18-01 | Auto-detect tonight's event + date display in dropdown | 1 |
| 18-02 | Offline mode: reject unknown tickets | 1 |
| 18-03 | Log failed scans to server scan_logs | 1 |
| 18-04 | Rate limit manual entry + display device ID | 1 |

## Key Files

- `maguey-gate-scanner/src/lib/simple-scanner.ts` — Core scan logic
- `maguey-gate-scanner/src/pages/Scanner.tsx` — Scanner page UI
- `maguey-gate-scanner/src/lib/offline-ticket-cache.ts` — Offline validation
- `maguey-gate-scanner/src/components/scanner/` — Scanner UI components

## Success Criteria

- Scanner auto-selects tonight's event on load
- Event dropdown shows event dates
- Offline mode rejects tickets not in IndexedDB cache
- All failed scans logged to scan_logs table
- Manual entry limited to 5 attempts per minute
- Device ID visible in scanner UI header
