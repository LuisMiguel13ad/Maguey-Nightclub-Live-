---
phase: 18-scanner-improvements
plan: 01
subsystem: scanner
tags: [scanner, auto-detect, event-dropdown, ux]
dependency_graph:
  requires: []
  provides: [auto-detect-tonight-event, event-dates-in-dropdown]
  affects: [scanner-page]
tech_stack:
  added: []
  patterns: [date-comparison, tonight-badge]
key_files:
  created: []
  modified:
    - maguey-gate-scanner/src/pages/Scanner.tsx
decisions:
  - decision: "Auto-select tonight's event by comparing event_date to today"
    rationale: "Staff at the door need instant scanning without manual event selection"
metrics:
  duration: 0
  tasks_completed: 5
  files_modified: 1
  commits: 0
  completed_date: "2026-02-15"
  note: "Pre-existing implementation — verified, not executed"
---

# Phase 18 Plan 01: Auto-detect tonight's event + date display Summary

**One-liner:** Scanner auto-selects tonight's event on load with "TONIGHT" badge and formatted dates in the event dropdown

## What Was Done

**Status: Pre-existing implementation** — All tasks were already implemented in the codebase prior to Phase 18 planning. Verified during execution.

### Implementation Found

1. `getActiveEvents()` in simple-scanner.ts queries events table with date filtering, returns `{id, name, event_date}`
2. Scanner.tsx auto-detects tonight's event by comparing `event_date` to today's date
3. Event dropdown shows formatted dates next to event names
4. Green "TONIGHT" badge appears on the current day's event
5. "All Events" remains the fallback when no event matches today

## Requirements Resolved

- R19: No event date awareness (auto-detect tonight) — RESOLVED
- R20: Event dropdown doesn't show dates — RESOLVED

## Deviations from Plan

None — implementation matched plan exactly (code predated plan).

## Files Verified

### maguey-gate-scanner/src/pages/Scanner.tsx
- Auto-detection logic in loadEvents effect
- Dropdown shows formatted dates with TONIGHT badge
- Auto-selects today's event via setSelectedEvent + setSelectedEventId

## Self-Check: PASSED

- ✅ Tonight's event auto-selected on scanner load
- ✅ Event dates visible in dropdown
- ✅ "TONIGHT" badge appears on today's event
- ✅ "All Events" works as default when no event today
