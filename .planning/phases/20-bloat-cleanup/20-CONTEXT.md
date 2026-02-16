# Phase 20: Dashboard & UI Bloat Cleanup

**Priority:** P1 + Bloat | **Effort:** 2 days | **Dependencies:** Phase 16
**Goal:** Remove unnecessary monitoring pages, simplify complex features, implement recommended sidebar.

## Issues Addressed

| GSD # | Issue | Requirement |
|-------|-------|-------------|
| 15 | Advanced Analytics too many tabs | R18 |
| Bloat 1-4 | Circuit Breakers, Rate Limits, Query Perf, Traces | R39-R42 |
| Bloat 5-7 | Errors, Metrics, Fraud pages too complex | R44-R46 |
| Bloat 12-13 | Notification Rules, Analytics too complex | R47-R48 |
| Bloat 14-19 | NFC, ID Verify, Override, Battery, Scan Speed | R50-R54 |
| Bloat 18 | Scan Speed Analytics | R43 |

## Plans

| Plan | Objective | Wave |
|------|-----------|------|
| 20-01 | Remove 5 monitoring pages from routes and sidebar | 1 |
| 20-02 | Implement simplified sidebar structure | 2 |
| 20-03 | Simplify Analytics, Fraud, Notifications | 1 |
| 20-04 | Assess/clean remaining bloat (NFC, ID, Override, Battery) | 1 |

## Key Files

- `maguey-gate-scanner/src/App.tsx` — Route definitions
- `maguey-gate-scanner/src/components/layout/OwnerPortalLayout.tsx` — Sidebar (lines 42-85)
- `maguey-gate-scanner/src/pages/monitoring/` — 6 monitoring pages
- `maguey-gate-scanner/src/pages/AdvancedAnalytics.tsx` — 6 tabs → 3

## Recommended Simplified Sidebar

```
MAIN
  Dashboard
  Events
SALES
  Ticket Sales
  VIP Tables
  Analytics (3 tabs: Revenue, Attendance, Staff)
TEAM
  Staff
  Audit Log
SETTINGS
  Notifications
  System Health (single indicator)
```

## Success Criteria

- 5 monitoring pages removed from sidebar (backend code kept)
- Sidebar matches simplified structure
- Analytics reduced from 6 to 3 tabs
- Fraud → "Security Alerts" card
- Notification Rules → simple on/off toggles
- NFC hidden behind feature flag
