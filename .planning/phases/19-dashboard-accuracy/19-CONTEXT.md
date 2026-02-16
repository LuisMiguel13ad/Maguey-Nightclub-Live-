# Phase 19: Dashboard Data Accuracy

**Priority:** P1 | **Effort:** 2 days | **Dependencies:** Phase 14
**Goal:** Fix hardcoded dashboard data and optimize real-time subscriptions.

## Issues Addressed

| GSD # | Issue | Requirement |
|-------|-------|-------------|
| 10 | Revenue trend percentages are hardcoded | R13 |
| 11 | ticket_count on orders always shows 0 | R14 |
| 12 | ticket_type on orders always shows 'General' | R15 |
| 13 | Staff performance uses raw user_id, not names | R16 |
| 14 | Real-time subscription refetches entire dashboard | R17 |

## Plans

| Plan | Objective | Wave |
|------|-----------|------|
| 19-01 | Calculate real revenue trend percentages | 1 |
| 19-02 | Fix ticket_count and ticket_type on orders | 1 |
| 19-03 | Display staff names instead of UUIDs | 1 |
| 19-04 | Optimize real-time subscriptions (targeted updates) | 2 |

## Key Files

- `maguey-gate-scanner/src/pages/OwnerDashboard.tsx` — 1025 lines, `@ts-nocheck`, hardcoded trends
- `maguey-gate-scanner/src/components/dashboard/` — Dashboard widget components
- `maguey-gate-scanner/src/hooks/useDashboardRealtime.ts` — Real-time subscription hook

## Success Criteria

- Revenue trends show real period-over-period deltas
- ticket_count shows actual ticket count per order
- ticket_type shows primary ticket type per order
- Staff names display instead of UUIDs
- Real-time updates only refresh affected widgets (not entire dashboard)
