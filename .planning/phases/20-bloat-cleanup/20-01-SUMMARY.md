---
phase: 20-bloat-cleanup
plan: 01
subsystem: dashboard-ui
tags: [bloat-cleanup, dev-only, monitoring, sidebar]
dependency_graph:
  requires: []
  provides: [monitoring-routes-gated, monitoring-sidebar-hidden]
  affects: [owner-portal-layout, app-routes]
tech_stack:
  added: []
  patterns: [requireDev-gating, import.meta.env.DEV-filtering]
key_files:
  created: []
  modified:
    - maguey-gate-scanner/src/App.tsx
    - maguey-gate-scanner/src/components/layout/OwnerPortalLayout.tsx
decisions:
  - decision: "Use requireDev prop on ProtectedRoute for monitoring routes"
    rationale: "Consistent with existing pattern from /test-qr route, leverages existing infrastructure"
  - decision: "Filter devOnly sections client-side using import.meta.env.DEV"
    rationale: "Simple boolean check at runtime, no build-time complexity, sidebar items filtered before rendering"
  - decision: "Use (section as any).devOnly for TypeScript compatibility"
    rationale: "Inline object literals infer types from values - cleaner than defining separate interface for single use case"
metrics:
  duration: 79
  tasks_completed: 2
  files_modified: 2
  commits: 2
  completed_date: "2026-02-15"
---

# Phase 20 Plan 01: Gate Monitoring Pages Behind DEV Mode Summary

**One-liner:** Monitoring routes and sidebar section now hidden in production builds via requireDev flag and import.meta.env.DEV filter

## What Was Done

### Task 1: Gate Monitoring Routes Behind requireDev (Commit: c04752b)

**Changes:**
- Added `requireDev` prop to all 6 monitoring routes in App.tsx
- Updated comment from "Owner/Promoter only" to "DEV-ONLY: Hidden in production"

**Affected Routes:**
- `/monitoring/metrics` (MetricsPage)
- `/monitoring/traces` (TracesPage)
- `/monitoring/errors` (ErrorsPage)
- `/monitoring/circuit-breakers` (CircuitBreakersPage)
- `/monitoring/rate-limits` (RateLimitsPage)
- `/monitoring/query-performance` (QueryPerformancePage)

**Behavior:**
- Production builds: navigating to `/monitoring/*` shows Unauthorized page
- Dev mode: routes work normally for owner/promoter roles
- Tree-shaking: page components automatically removed from production bundle when unreachable

### Task 2: Hide MONITORING Sidebar Section (Commit: bae84c6)

**Changes:**
- Added `devOnly: true` property to MONITORING section in OwnerPortalLayout.tsx
- Updated `filteredSections` logic to filter out `devOnly` sections when `!import.meta.env.DEV`
- Updated comment: "Only show in development mode"

**Behavior:**
- Production builds: MONITORING section completely hidden from sidebar
- Dev mode: MONITORING section visible for owner users (hidden for promoters via existing ownerOnly filter)
- Filter order: devOnly check → ownerOnly check → item filtering → empty section removal

## Deviations from Plan

None - plan executed exactly as written.

## Files Modified

### maguey-gate-scanner/src/App.tsx
- Lines 97-103: Added `requireDev` prop to 6 monitoring routes
- Updated comment to "DEV-ONLY: Hidden in production"

### maguey-gate-scanner/src/components/layout/OwnerPortalLayout.tsx
- Line 75: Added `devOnly: true` to MONITORING section
- Lines 119-120: Added devOnly filter to `filteredSections` logic
- Updated comment: "Only show in development mode"

## Verification Results

1. **requireDev count:** 7 (1 for /test-qr + 6 for monitoring routes) ✅
2. **devOnly property:** Present in MONITORING section ✅
3. **import.meta.env.DEV check:** Present in filter logic ✅
4. **Monitoring page files:** All 6 files still exist in `src/pages/monitoring/` ✅
5. **TypeScript compilation:** Compiles cleanly with no errors ✅

## Key Decisions

1. **Pattern consistency:** Used existing `requireDev` pattern from `/test-qr` route instead of inventing new mechanism
2. **Client-side filtering:** Used `import.meta.env.DEV` for sidebar filtering (simple boolean, no build complexity)
3. **Type handling:** Used `(section as any).devOnly` for inline object literal compatibility
4. **Zero deletions:** All monitoring page files and service files preserved for debugging in dev mode

## Production Impact

**Before:**
- 6 monitoring pages accessible in production at `/monitoring/*`
- MONITORING sidebar section visible to owner users
- Developer debugging tools exposed in production UI

**After:**
- Monitoring routes return Unauthorized page in production builds
- MONITORING sidebar section hidden in production builds
- Clean owner-facing UI without debugging clutter
- Full debugging capability preserved in dev mode

## Technical Notes

**Tree-shaking:**
Import statements for monitoring pages remain in App.tsx. Vite's tree-shaker will automatically remove unused page components from production bundles when routes are gated behind `requireDev` and unreachable.

**Filter order:**
```typescript
.filter(devOnly check)     // Remove dev-only sections in production
.filter(ownerOnly check)   // Remove owner-only sections for non-owners
.map(filter items)         // Filter items within visible sections
.filter(empty sections)    // Remove sections with no visible items
```

**ProtectedRoute behavior:**
`requireDev` check happens BEFORE auth check (see ProtectedRoute.tsx line 39-42). This makes dev-only routes completely invisible in production, even if user is authenticated with correct role.

## Self-Check: PASSED

**Created files:**
None - no new files created

**Modified files:**
- ✅ maguey-gate-scanner/src/App.tsx exists
- ✅ maguey-gate-scanner/src/components/layout/OwnerPortalLayout.tsx exists

**Commits:**
- ✅ c04752b exists (Task 1: gate monitoring routes)
- ✅ bae84c6 exists (Task 2: hide sidebar section)

**Verification:**
- ✅ All 6 monitoring routes have `requireDev` prop
- ✅ MONITORING section has `devOnly: true` property
- ✅ Filter logic includes `import.meta.env.DEV` check
- ✅ All monitoring page files exist
- ✅ TypeScript compiles without errors

## Next Steps

Continue to Plan 20-02: Simplify owner dashboard sidebar (remove bloat candidates from non-dev builds).
