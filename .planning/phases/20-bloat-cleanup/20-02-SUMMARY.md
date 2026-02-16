---
phase: 20-bloat-cleanup
plan: 02
subsystem: dashboard-ui
tags: [bloat-cleanup, sidebar, system-health, production-ux]
dependency_graph:
  requires: [20-01]
  provides: [simplified-sidebar, system-health-indicator]
  affects: [owner-portal-layout, app-routes]
tech_stack:
  added: []
  patterns: [system-health-indicator, error-monitoring-production]
key_files:
  created: []
  modified:
    - maguey-gate-scanner/src/components/layout/OwnerPortalLayout.tsx
    - maguey-gate-scanner/src/App.tsx
decisions:
  - decision: "Add System Health to SETTINGS section linking to /monitoring/errors"
    rationale: "Provides owner-facing error visibility without exposing full developer monitoring suite"
  - decision: "Remove requireDev from /monitoring/errors route only"
    rationale: "System Health is the only monitoring page useful to nightclub owners - other 5 pages remain dev-only"
  - decision: "Use HeartPulse icon for System Health"
    rationale: "Conveys health/status monitoring visually, consistent with lucide-react icon library"
metrics:
  duration: 90
  tasks_completed: 1
  files_modified: 2
  commits: 1
  completed_date: "2026-02-15"
---

# Phase 20 Plan 02: Simplify Owner Dashboard Sidebar Summary

**One-liner:** Production sidebar now shows 9 focused items across 4 sections (MAIN/SALES/TEAM/SETTINGS) with System Health indicator replacing developer monitoring clutter

## What Was Done

### Task 1: Add System Health item to SETTINGS section and verify sidebar structure (Commit: 46be6be)

**Changes to OwnerPortalLayout.tsx:**
- Added `HeartPulse` icon import from lucide-react
- Added "System Health" item to SETTINGS section:
  - Title: "System Health"
  - Path: `/monitoring/errors`
  - Icon: `HeartPulse`
  - Access: `ownerOnly: true`

**Changes to App.tsx:**
- Removed `requireDev` prop from `/monitoring/errors` route
- Updated route comment to clarify errors page is exception to dev-only pattern
- 5 other monitoring routes remain dev-only with `requireDev`

**Final Sidebar Structure (Production):**

```
MAIN (2 items):
  - Dashboard (/dashboard)
  - Events (/events)

SALES (3 items):
  - Ticket Sales (/orders)
  - VIP Tables (/vip-tables)
  - Analytics (/analytics)

TEAM (2 items, ownerOnly):
  - Staff (/team)
  - Audit Log (/audit-log)

SETTINGS (2 items, ownerOnly):
  - Notifications (/notifications/preferences)
  - System Health (/monitoring/errors) ✅ NEW

MONITORING (6 items, devOnly):
  - Hidden in production via import.meta.env.DEV filter
```

**Total Production Items:** 9 items across 4 sections (exactly matches recommended structure from planning context)

## Deviations from Plan

None - plan executed exactly as written.

## Files Modified

### maguey-gate-scanner/src/components/layout/OwnerPortalLayout.tsx
- Line 12: Added `HeartPulse` to lucide-react imports
- Line 72: Added System Health item to SETTINGS section with HeartPulse icon

### maguey-gate-scanner/src/App.tsx
- Line 97: Updated comment to clarify errors page exception
- Line 100: Removed `requireDev` from `/monitoring/errors` route (kept `allowedRoles={['owner', 'promoter']}`)

## Verification Results

1. **System Health item exists:** ✅ Confirmed via grep
2. **requireDev count:** ✅ 6 occurrences (1 test-qr + 5 monitoring routes, errors excluded)
3. **HeartPulse icon:** ✅ Imported and used in System Health item
4. **Sidebar structure:** ✅ 9 items across 4 sections (MAIN 2, SALES 3, TEAM 2, SETTINGS 2)
5. **TypeScript compilation:** ✅ Build succeeded in 6.13s
6. **Production accessibility:** ✅ /monitoring/errors now accessible without requireDev gate

## Key Decisions

1. **System Health as simplified indicator:** Instead of exposing all 6 monitoring pages, owners get a single "System Health" entry point to error monitoring
2. **HeartPulse icon choice:** Conveys health/status monitoring visually without being alarming like AlertTriangle
3. **SETTINGS section placement:** Groups System Health with Notifications as owner-facing configuration/monitoring
4. **Exception to dev-only pattern:** Errors page is the only monitoring route useful for production nightclub operations

## Production Impact

**Before (Plan 20-01):**
- 8 production sidebar items
- No error visibility for owners in production
- MONITORING section hidden (dev-only)

**After (Plan 20-02):**
- 9 production sidebar items
- System Health provides error monitoring without developer clutter
- Sidebar matches recommended simplified structure exactly
- Owner can check system health without navigating to hidden dev routes

**User Experience:**
- Owner sees "System Health" in SETTINGS section
- Clicking navigates to `/monitoring/errors` page
- Page shows error logs, status indicators, and system alerts
- No access to technical monitoring (circuit breakers, rate limits, query performance, traces, metrics)

## Technical Notes

**Why errors page is production-accessible:**
The errors monitoring page provides actionable visibility into system issues that nightclub owners need to know about:
- Payment failures
- Email delivery issues
- Scanner connectivity problems
- Critical system errors

The other 5 monitoring pages (Metrics, Traces, Circuit Breakers, Rate Limits, Query Performance) are developer tools with no actionable value for nightclub operators.

**ProtectedRoute behavior:**
- `/monitoring/errors` now checks: auth + owner/promoter role (no dev check)
- Other monitoring routes check: dev + auth + owner/promoter role
- Tree-shaking: only ErrorsPage is included in production bundle; other monitoring pages are eliminated

**Icon selection:**
Initially considered `Activity` (already imported), but `HeartPulse` better conveys "health check" semantics. HeartPulse is a standard lucide-react icon available in all recent versions.

## Self-Check: PASSED

**Created files:**
None - no new files created

**Modified files:**
- ✅ maguey-gate-scanner/src/components/layout/OwnerPortalLayout.tsx exists
- ✅ maguey-gate-scanner/src/App.tsx exists

**Commits:**
- ✅ 46be6be exists (Task 1: Add System Health and update routes)

**Verification:**
- ✅ System Health item exists in SETTINGS section
- ✅ HeartPulse icon imported and used
- ✅ /monitoring/errors route accessible in production (no requireDev)
- ✅ 5 other monitoring routes still dev-only (requireDev count = 6)
- ✅ Sidebar structure matches recommended layout (9 items, 4 sections)
- ✅ TypeScript compiles without errors
- ✅ Build succeeds

## Next Steps

Continue to Plan 20-03: Simplify Analytics/Fraud/Notifications pages (rename tabs, rebrand pages, gate CRUD operations).
