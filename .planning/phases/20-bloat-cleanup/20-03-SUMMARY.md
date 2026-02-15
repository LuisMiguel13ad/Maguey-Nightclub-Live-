---
phase: 20-bloat-cleanup
plan: 03
subsystem: owner-dashboard
tags: [ui-simplification, bloat-reduction, production-ready]
completed: 2026-02-15
duration_minutes: 7
status: complete

dependency_graph:
  requires: []
  provides:
    - simplified-analytics-tabs
    - security-alerts-layout
    - production-notification-toggles
  affects:
    - maguey-gate-scanner/src/pages/AdvancedAnalytics.tsx
    - maguey-gate-scanner/src/pages/FraudInvestigation.tsx
    - maguey-gate-scanner/src/pages/NotificationRules.tsx

tech_stack:
  added: []
  patterns:
    - import.meta.env.DEV gating for CRUD features
    - OwnerPortalLayout consistency across owner pages
    - Business-friendly terminology (Security Alerts vs Fraud Investigation)

key_files:
  created: []
  modified:
    - path: maguey-gate-scanner/src/pages/AdvancedAnalytics.tsx
      lines_changed: 8
      impact: Tab labels renamed, page title simplified
    - path: maguey-gate-scanner/src/pages/FraudInvestigation.tsx
      lines_changed: 15
      impact: Layout wrapper updated, title owner-friendly
    - path: maguey-gate-scanner/src/pages/NotificationRules.tsx
      lines_changed: 25
      impact: CRUD buttons gated, production shows toggles only

decisions:
  - decision: Renamed Analytics tabs to Revenue/Attendance/Staff
    rationale: Generic names (Overview/Sales/Operations) don't match nightclub owner mental model — Revenue/Attendance/Staff are clear business terms
    alternatives: [Money/Customers/Team, Sales/Visitors/Employees]
    chosen_because: Revenue/Attendance/Staff balance formality with clarity

  - decision: Changed Fraud Investigation to Security Alerts
    rationale: "Investigation" sounds punitive — owners want to see "alerts" and "flags" not "investigations"
    alternatives: [Fraud Alerts, Security Dashboard, Risk Monitoring]
    chosen_because: Security Alerts is reassuring and actionable

  - decision: Gate Notification Rules CRUD behind DEV mode
    rationale: v1 nightclub owner needs on/off toggles, not full rule creation — complex CRUD overwhelms and adds support burden
    alternatives: [Hide entirely, simplify create form, add tutorial]
    chosen_because: DEV gating preserves flexibility for future while shipping simple UX now

metrics:
  tasks_completed: 2
  files_modified: 3
  commits: 2
  lines_changed: 48
  test_coverage: N/A (UI label changes only)
---

# Phase 20 Plan 03: Simplify Owner-Facing Pages Summary

**One-liner:** Renamed Analytics tabs to business-friendly terms, changed Fraud page to "Security Alerts" with owner layout, and hid Notification Rules CRUD in production (toggles remain).

## Objective

Simplify three complex owner-facing pages: rename Analytics tabs, clean up Fraud page layout, and simplify Notification Rules to on/off toggles.

## What Changed

### Task 1: Analytics Tab Renaming ✅
**Commit:** `2e52505` — refactor(20-bloat-cleanup): rename Analytics tabs to Revenue/Attendance/Staff

**Changes:**
- Changed `defaultValue` from "overview" to "revenue"
- Renamed tab triggers:
  - Overview → Revenue
  - Sales → Attendance
  - Operations → Staff
- Renamed tab contents to match new values
- Simplified page title from "Analytics Dashboard" to "Analytics"

**Rationale:** Generic tab names don't match nightclub owner mental model. Revenue/Attendance/Staff are clear business terms that directly relate to owner concerns.

**Preserved:**
- All chart components unchanged
- All data fetching logic unchanged
- All display logic unchanged
- Zero functional regressions

### Task 2: Fraud & Notification Pages Cleanup ✅
**Commit:** `8168fa6` — refactor(20-bloat-cleanup): simplify Fraud and Notification pages

**Part A: Fraud Investigation → Security Alerts**

Changes:
- Replaced `Navigation` import with `OwnerPortalLayout`
- Updated page wrapper from `<Navigation>` to `<OwnerPortalLayout title="Security Alerts" subtitle="SECURITY">`
- Changed description to owner-friendly: "Review flagged scan attempts and fraud indicators"
- Removed old `<Navigation>` component usage

Result: Page now matches owner portal design system, uses friendly "Security Alerts" branding instead of forensic "Fraud Investigation" terminology.

**Part B: Notification Rules Simplification**

Changes:
- Replaced `Navigation` import with `OwnerPortalLayout`
- Gated CRUD features behind `import.meta.env.DEV`:
  - Create Rule button (header actions)
  - Create First Rule button (empty state)
  - Test Rule button (per rule)
  - Edit button (per rule)
  - Delete button (per rule)
- Switch toggle remains fully functional in production

Result: Production shows clean list of notification rules with on/off toggles. Dev mode retains full CRUD for configuration. Zero functional regressions.

## Deviations from Plan

None — plan executed exactly as written.

## Verification

### Analytics Tabs
```bash
# Verify new tab values appear 6 times (3 triggers + 3 contents)
grep -c 'value="revenue"\|value="attendance"\|value="staff"' maguey-gate-scanner/src/pages/AdvancedAnalytics.tsx
# Output: 6 ✅

# Verify old values are gone
grep 'value="overview"\|value="sales"\|value="operations"' maguey-gate-scanner/src/pages/AdvancedAnalytics.tsx
# Output: (empty) ✅
```

### Fraud Investigation
```bash
# Verify OwnerPortalLayout used
grep "OwnerPortalLayout" maguey-gate-scanner/src/pages/FraudInvestigation.tsx
# Output: import OwnerPortalLayout, <OwnerPortalLayout ✅

# Verify Security Alerts title
grep "Security Alerts" maguey-gate-scanner/src/pages/FraudInvestigation.tsx
# Output: title="Security Alerts" ✅

# Verify Navigation removed
grep "Navigation" maguey-gate-scanner/src/pages/FraudInvestigation.tsx
# Output: (empty) ✅
```

### Notification Rules
```bash
# Verify OwnerPortalLayout used
grep "OwnerPortalLayout" maguey-gate-scanner/src/pages/NotificationRules.tsx
# Output: import OwnerPortalLayout, <OwnerPortalLayout ✅

# Verify DEV gating exists
grep -c "import.meta.env.DEV" maguey-gate-scanner/src/pages/NotificationRules.tsx
# Output: 4 ✅

# Verify Navigation removed
grep "Navigation" maguey-gate-scanner/src/pages/NotificationRules.tsx
# Output: (empty) ✅
```

All verification criteria passed. TypeScript compiles without errors.

## Impact Assessment

**User Impact:**
- Analytics: Owners see clearer tab labels (Revenue/Attendance/Staff vs Overview/Sales/Operations)
- Fraud: Consistent layout, less intimidating "Security Alerts" branding
- Notifications: Simpler production UI (toggle-based) reduces cognitive load

**Developer Impact:**
- All pages now use OwnerPortalLayout consistently
- DEV-only CRUD maintains flexibility for future configuration needs
- Zero breaking changes to underlying functionality

**Technical Debt:**
- REDUCED: Eliminated duplicate Navigation component usage
- REDUCED: Aligned all owner pages to consistent layout pattern
- MAINTAINED: Preserved all data fetching and display logic

## Success Criteria

- [x] Analytics tabs renamed to Revenue/Attendance/Staff with no content changes
- [x] Fraud page consistently uses OwnerPortalLayout and friendly "Security Alerts" branding
- [x] Notification Rules shows simple toggle list in production, full CRUD in dev mode
- [x] Zero regressions in data display or functionality
- [x] TypeScript compiles without errors

## Files Modified

| File | Changes | Impact |
|------|---------|--------|
| AdvancedAnalytics.tsx | 8 lines | Tab labels + page title |
| FraudInvestigation.tsx | 15 lines | Layout wrapper + title |
| NotificationRules.tsx | 25 lines | DEV gating + layout wrapper |

**Total:** 3 files, 48 lines changed, 2 commits

## Self-Check: PASSED ✅

### Files Exist
```bash
[ -f "maguey-gate-scanner/src/pages/AdvancedAnalytics.tsx" ] && echo "FOUND: AdvancedAnalytics.tsx"
# FOUND: AdvancedAnalytics.tsx ✅

[ -f "maguey-gate-scanner/src/pages/FraudInvestigation.tsx" ] && echo "FOUND: FraudInvestigation.tsx"
# FOUND: FraudInvestigation.tsx ✅

[ -f "maguey-gate-scanner/src/pages/NotificationRules.tsx" ] && echo "FOUND: NotificationRules.tsx"
# FOUND: NotificationRules.tsx ✅
```

### Commits Exist
```bash
git log --oneline --all | grep -q "2e52505" && echo "FOUND: 2e52505"
# FOUND: 2e52505 ✅

git log --oneline --all | grep -q "8168fa6" && echo "FOUND: 8168fa6"
# FOUND: 8168fa6 ✅
```

All files and commits verified.

## Next Steps

Continue to **20-04** (final bloat cleanup plan).

## Notes

- No data fetching logic was modified — only labels, layout wrappers, and visibility controls
- Switch toggles in NotificationRules remain fully functional in production (only CRUD is hidden)
- "Security Alerts" terminology aligns with owner-facing language throughout the dashboard
- Revenue/Attendance/Staff match the actual metrics displayed in each tab
