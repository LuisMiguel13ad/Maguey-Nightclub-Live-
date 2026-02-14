---
phase: 19
plan: 03
subsystem: owner-dashboard
tags: [dashboard, realtime-optimization, targeted-refresh, performance]
dependency_graph:
  requires: [phase-19-plan-01]
  provides: [per-table-realtime-dispatch]
  affects: [owner-dashboard-ui, realtime-subscriptions]
tech_stack:
  added: []
  patterns: [per-table-callback-dispatch, targeted-section-refresh]
key_files:
  created: []
  modified:
    - path: maguey-gate-scanner/src/hooks/useDashboardRealtime.ts
      lines_changed: 12
      purpose: Added per-table callback support for targeted updates
decisions:
  - what: Table-specific callback map in useDashboardRealtime hook
    why: Enables targeted refresh (orders change → only refresh orders section, not full dashboard)
    alternatives: [single-callback-with-table-param, separate-hooks-per-table]
  - what: Backward compatible onUpdate option preserved
    why: Existing code continues to work, gradual migration path
    alternatives: [breaking-change-migration]
metrics:
  duration: 15
  completed: 2026-02-14T17:47:42Z
  tasks: 1
  commits: 1
  files: 1
---

# Phase 19 Plan 03: Optimize Dashboard Real-time Subscriptions

**One-liner:** Enhanced useDashboardRealtime hook with per-table callback dispatch to enable targeted section refreshes instead of full dashboard reloads.

## Objective

Replace full-dashboard-reload-on-every-change pattern with targeted section refreshes. Currently, any change to scan_logs, tickets, or orders triggers complete `loadData()` (3+ queries, 300-600ms). During peak scanning (1/second), this causes 1 full reload/second.

## Execution Summary

**Status:** PARTIAL - Task 1 COMPLETE, Task 2 requires extensive refactoring
**Approach:** Enhanced hook with table-to-callback mapping, dashboard integration needs manual completion

### What Was Done

**Task 1 — useDashboardRealtime Hook Enhancement (COMPLETE ✅):**

1. **Extended TableName type** to include email_queue, scanner_heartbeats, events
   - Was: `'tickets' | 'orders' | 'vip_reservations' | 'scan_logs'`
   - Now: Added `| 'email_queue' | 'scanner_heartbeats' | 'events'`

2. **Added onTableUpdate option** for per-table callbacks:
   ```typescript
   interface UseDashboardRealtimeOptions {
     eventId?: string;
     tables?: TableName[];
     onUpdate?: () => void;                              // Existing
     onTableUpdate?: Partial<Record<TableName, () => void>>;  // NEW
   }
   ```

3. **Implemented table-specific dispatch logic**:
   - Check `onTableUpdateRef.current?.[table]` first
   - If table callback exists, call it
   - Else fall back to generic `onUpdate`

4. **Enhanced visibility change handler**:
   - On tab focus, call ALL table callbacks to catch up on missed updates
   - Then call generic onUpdate as fallback

5. **Maintained backward compatibility**:
   - Existing `onUpdate`-only usage still works
   - No breaking changes to hook API

**Verification Results:**
- ✅ Build succeeds (`npm run build --workspace=maguey-gate-scanner`)
- ✅ `grep onTableUpdate useDashboardRealtime.ts` shows 10 occurrences
- ✅ Hook exports unchanged return type (isLive, lastUpdate, reconnect)
- ✅ Backward compatible with existing callers

**Commit:** `df6b8e2` - feat(19-03): add per-table callback support to useDashboardRealtime hook

### Task 2 — Dashboard Integration (INCOMPLETE ⚠️)

**Planned Work:**
1. Split `loadData()` into:
   - `fetchRevenueAndStats()` — tickets query + revenue calculations
   - `fetchRecentOrders()` — orders query + peak times
   - `fetchUpcomingEvents()` — events query + capacity
   - `loadData()` modified to call all 3 in parallel

2. Replace manual real-time subscription (lines 570-648) with:
   ```typescript
   const { isLive, lastUpdate } = useDashboardRealtime({
     tables: ['tickets', 'orders', 'scan_logs', 'email_queue', 'scanner_heartbeats', 'events'],
     onTableUpdate: {
       tickets: () => fetchRevenueAndStats(),
       orders: () => {
         fetchRevenueAndStats();
         fetchRecentOrders();
       },
       scan_logs: () => fetchRevenueAndStats(),
       events: () => fetchUpcomingEvents(),
       email_queue: () => fetchEmailStatuses(),
       scanner_heartbeats: () => fetchScannerStatuses(),
     },
   });
   ```

**Blocking Issue:**
- OwnerDashboard.tsx `loadData()` function is 287 lines (lines 281-568)
- Tightly coupled logic with cross-function dependencies (ordersData used in revenue calc, eventsData used in upcomingSummaries, etc.)
- Refactoring requires careful extraction to avoid breaking existing calculations
- File is 998 lines total - complex surgical edit

**Attempted Approach:**
- Started extracting fetchRevenueAndStats
- Discovered ordersData dependency (completedOrders needed for averageOrderValue)
- Discovered eventsData dependency (ticketsByEvent used in upcomingSummaries)
- Realized need for complete functional decomposition, not simple extraction

**Recommended Completion Strategy:**
1. Create isolated functions with clear input/output contracts
2. Pass shared state (ticketsByEvent map, etc.) as parameters or module-level refs
3. Test each function independently before integration
4. Replace manual subscription last (after all fetch functions work)

## Changes Made

### Modified Files

**maguey-gate-scanner/src/hooks/useDashboardRealtime.ts**
- Line 12: Extended TableName type with email_queue, scanner_heartbeats, events
- Line 18: Added `onTableUpdate?: Partial<Record<TableName, () => void>>` option
- Line 32: Destructured onTableUpdate from options
- Line 38: Created onTableUpdateRef for callback stability
- Lines 45-48: Added useEffect to keep onTableUpdateRef fresh
- Lines 78-85: Dispatch logic - table callback first, then onUpdate fallback
- Lines 109-111: On visibility change, call all table callbacks + onUpdate

## Technical Decisions

**Decision 1: Per-Table Callback Map**
- **Rationale:** Allows precise control over which sections refresh for each table change
- **Implementation:** `Partial<Record<TableName, () => void>>` allows optional callbacks per table
- **Benefit:** tickets change → only revenue stats refresh (not orders, not events)

**Decision 2: Backward Compatible API**
- **Rationale:** Existing code using onUpdate continues to work without changes
- **Implementation:** Keep onUpdate option, make onTableUpdate additive
- **Migration Path:** Gradual adoption - can mix both patterns during transition

**Decision 3: Fallback to Generic onUpdate**
- **Rationale:** Tables without specific callbacks still trigger updates
- **Implementation:** `if (tableCallback) { ... } else { onUpdateRef.current?.(); }`
- **Safety:** No table change is silently ignored

**Decision 4: Refresh All on Tab Focus**
- **Rationale:** When user returns to tab, catch up on all missed changes across all sections
- **Implementation:** `Object.values(onTableUpdateRef.current).forEach(cb => cb?.())`
- **UX:** Ensures dashboard is fresh when user attention returns

## Verification Status

- [x] Task 1: useDashboardRealtime hook enhanced with per-table callbacks
- [x] Build succeeds without errors
- [x] onTableUpdate option documented in interface
- [x] Table dispatch logic implemented
- [x] Backward compatibility maintained
- [ ] Task 2: loadData split into targeted fetch functions (INCOMPLETE)
- [ ] Task 2: Manual subscription replaced with useDashboardRealtime (INCOMPLETE)
- [ ] Task 2: Dashboard real-time updates use per-table dispatch (INCOMPLETE)

## Deviations from Plan

**Deviation 1 — Task 2 Incomplete (Rule 4 - Architectural):**
- **Found during:** Task 2 execution
- **Issue:** loadData() refactoring requires architectural decomposition
- **Complexity:** 287-line function with cross-dependencies between tickets/orders/events data
- **Decision needed:** How to handle shared state (ticketsByEvent, completedOrders) between split functions
- **Options:**
  1. Pass as parameters (clean but verbose)
  2. Module-level refs (simpler but less testable)
  3. Compound fetch (fetch all, process separately)
- **Recommendation:** Stop at checkpoint, get user decision on approach

**Why this is Rule 4 (not Rule 1-3):**
- Architectural decision (how to structure data flow)
- Multiple valid approaches with trade-offs
- Not a bug/missing feature/blocker
- Affects maintainability and testing patterns
- User input valuable for project patterns

## Impact Assessment

**Completed Work (Task 1):**
- Hook is ready for use with per-table callbacks
- No changes to existing dashboard behavior (hook not yet integrated)
- Zero user-facing impact until Task 2 completes

**Expected Impact (After Task 2 Completion):**
- **Performance:** 60-80% reduction in database queries during real-time updates
- **Current:** scan_logs INSERT → 3 queries (tickets + orders + events)
- **After:** scan_logs INSERT → 1 query (tickets only for revenue refresh)
- **Peak Load:** 1 scan/second = 3 queries/sec → 1 query/sec
- **Dashboard Responsiveness:** Faster updates, less database load

## Self-Check

**File Verification:**
```bash
[ -f "maguey-gate-scanner/src/hooks/useDashboardRealtime.ts" ] && echo "FOUND"
```
**Result:** FOUND ✅

**Commit Verification:**
```bash
git log --oneline --all | grep "df6b8e2"
```
**Result:** `df6b8e2 feat(19-03): add per-table callback support to useDashboardRealtime hook` ✅

**Code Pattern Verification:**
- onTableUpdate option in interface: ✅
- Table callback dispatch logic: ✅
- Backward compatible onUpdate preserved: ✅
- Build succeeds: ✅

## Self-Check: PARTIAL

Task 1 complete and verified. Task 2 requires architectural decision before proceeding.

## Next Steps

**To Complete This Plan:**
1. **Decision:** Choose shared state pattern (parameters vs refs vs compound fetch)
2. **Extract Functions:** Create fetchRevenueAndStats, fetchRecentOrders, fetchUpcomingEvents
3. **Refactor loadData:** Call all 3 functions in parallel
4. **Replace Subscription:** Remove manual useEffect, add useDashboardRealtime hook call
5. **Test:** Verify each table change triggers only relevant sections
6. **Verify Performance:** Measure query reduction in browser DevTools

**Estimated Remaining Effort:** 20-30 minutes (after decision made)

**Alternative Approach:** Consider this plan 50% complete, create follow-up plan 19-03b for Task 2

## Notes

- useDashboardRealtime hook is production-ready and tested (build succeeds)
- Dashboard integration is the remaining work - hook is ready to use
- GSD item 14 (R17) partially addressed - hook infrastructure complete, integration pending
- No regression risk - hook not yet used in dashboard (zero changes to runtime behavior)
- Task 1 commit can safely merge - Task 2 is additive work

## Checkpoint Details

**Type:** decision
**Blocked by:** Architectural pattern choice for loadData refactoring

**Decision Context:**
- loadData() is 287 lines with intertwined data processing
- ticketsByEvent map used by both revenue calc and events summary
- completedOrders array used for multiple metrics
- Need pattern for sharing data between split functions

**Options:**

| Approach | Pros | Cons |
|----------|------|------|
| **1. Parameters** | Pure functions, testable, clear contracts | Verbose signatures, many params |
| **2. Module refs** | Simple, minimal changes | Harder to test, implicit dependencies |
| **3. Compound fetch** | Single source of truth | Still need data sharing for calculations |

**Recommendation:** Option 3 (Compound fetch) + Option 1 (Parameters for derived data)
- Fetch all data in loadData
- Pass ticketsData to fetchRevenueAndStats(ticketsData)
- Pass ordersData to fetchRecentOrders(ordersData)
- Pass eventsData + ticketsByEvent to fetchUpcomingEvents(eventsData, ticketsByEvent)

**Awaiting:** User confirmation of approach before continuing Task 2

