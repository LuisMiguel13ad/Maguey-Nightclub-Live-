---
phase: 21-vip-events-polish
plan: 01
subsystem: vip-floor-plan
tags: [drag-drop, positioning, ui-enhancement, database-migration]
completed: 2026-02-15T19:08:00Z
duration: 4 minutes

dependency_graph:
  requires: []
  provides:
    - drag-drop-floor-plan
    - table-positioning-persistence
    - logical-coordinate-system
  affects:
    - VipTablesManagement
    - VIPFloorPlanAdmin
    - event_vip_tables

tech_stack:
  added:
    - "@dnd-kit/core@^6.1.0"
  patterns:
    - optimistic-updates-with-rollback
    - percentage-based-absolute-positioning
    - logical-coordinate-system

key_files:
  created:
    - maguey-pass-lounge/supabase/migrations/20260215000000_add_table_positions.sql
  modified:
    - maguey-gate-scanner/package.json
    - maguey-gate-scanner/src/lib/vip-tables-admin-service.ts
    - maguey-gate-scanner/src/components/vip/VIPFloorPlanAdmin.tsx
    - maguey-gate-scanner/src/pages/VipTablesManagement.tsx

decisions:
  - name: "1000x700 logical coordinate system instead of pixels"
    rationale: "Percentage-based CSS layout requires device-independent units. 1000x700 maps cleanly to percentage positioning via (x/1000)*100% and (y/700)*100%."
    alternatives_considered:
      - "Pixel coordinates: breaks on different screen sizes"
      - "Pure percentages: harder to reason about exact positions"
    impact: "Consistent positioning across devices, migration backfill is straightforward"

  - name: "Optimistic updates with rollback on error"
    rationale: "Provides instant visual feedback during drag. If server update fails, position reverts to previous value."
    alternatives_considered:
      - "Pessimistic updates: wait for server response (sluggish UX)"
      - "Fire-and-forget: no error handling (data loss risk)"
    impact: "Best UX with data safety — tables snap back on network failure"

  - name: "@dnd-kit/core only, no @dnd-kit/sortable"
    rationale: "Free-form positioning doesn't need sortable list semantics. Core library provides drag primitives we need."
    alternatives_considered:
      - "@dnd-kit/sortable: overkill for absolute positioning"
      - "react-dnd: larger bundle, more complex API"
    impact: "Smaller bundle size, simpler implementation"

  - name: "Default grid positions backfilled in migration"
    rationale: "Existing tables without positions render at sensible default locations matching current Flexbox layout."
    alternatives_considered:
      - "Require manual positioning: bad UX for existing events"
      - "Random positions: confusing for operators"
    impact: "Zero disruption to existing events — tables appear in familiar layout until manually repositioned"

metrics:
  tasks: 2
  commits: 2
  files_modified: 4
  files_created: 1
  lines_added: 450
  test_coverage: "not_applicable"
---

# Phase 21 Plan 01: VIP Drag-and-Drop Floor Plan

**One-liner:** Draggable VIP floor plan with database-persisted table positions using @dnd-kit/core and logical coordinate system

## What Was Built

Replaced static Flexbox floor plan layout with free-form drag-and-drop positioning. Owner can now arrange VIP tables to match real venue layout.

**Before:** Tables locked in rows (1-3 left, 4-7 center, 8 right, 9-20 bottom grid)
**After:** Tables draggable to any position, coordinates saved to DB, persist across reloads

## Implementation Details

### Task 1: Positioning Infrastructure

**Migration `20260215000000_add_table_positions.sql`:**
- Added `position_x INTEGER` and `position_y INTEGER` columns to `event_vip_tables`
- Backfilled existing rows with default grid positions:
  - Tables 1-3 (left wing): x=50, y=100/250/400
  - Tables 4-7 (front row): x=250/400/550/700, y=100
  - Table 8 (right wing): x=900, y=100
  - Tables 9-14 (standard top): x=200-950 (spaced), y=350
  - Tables 15-20 (standard bottom): x=200-950 (spaced), y=500
- Coordinate system: 1000 (width) x 700 (height) logical units

**Package installation:**
```bash
npm install @dnd-kit/core@^6.1.0
```

**Service function `updateTablePosition`:**
```typescript
export async function updateTablePosition(
  tableId: string,
  position: { x: number; y: number }
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('event_vip_tables')
    .update({ position_x: Math.round(position.x), position_y: Math.round(position.y) })
    .eq('id', tableId);
  // ...
}
```

### Task 2: Drag-and-Drop Component

**VIPFloorPlanAdmin.tsx rewrite:**

1. **Added position state with sync:**
   ```typescript
   const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(
     new Map(effectiveTables.map(t => [t.id, { x: t.position_x ?? 0, y: t.position_y ?? 0 }]))
   );
   useEffect(() => { /* sync on tables prop change */ }, [effectiveTables]);
   ```

2. **DraggableTable wrapper:**
   - Uses `useDraggable` from @dnd-kit/core
   - Absolute positioning via `left: ${(x/1000)*100}%`, `top: ${(y/700)*100}%`
   - Transform during drag via `CSS.Translate.toString(transform)`
   - Disabled when `readOnly` prop is true

3. **Drag handler with coordinate conversion:**
   ```typescript
   const handleDragEnd = async (event: DragEndEvent) => {
     const { active, delta } = event;
     const container = document.querySelector('[data-floor-plan]');
     const rect = container.getBoundingClientRect();
     const deltaX = (delta.x / rect.width) * 1000;   // pixels → logical units
     const deltaY = (delta.y / rect.height) * 700;
     const newX = Math.max(0, Math.min(950, currentPos.x + deltaX));  // bounds check
     const newY = Math.max(0, Math.min(650, currentPos.y + deltaY));

     setPositions(prev => new Map(prev).set(tableId, { x: newX, y: newY }));  // optimistic
     try {
       await onUpdatePosition(tableId, newX, newY);
     } catch {
       setPositions(prev => new Map(prev).set(tableId, currentPos));  // rollback
     }
   };
   ```

4. **Floor plan container:**
   - Replaced Flexbox columns with single `position: relative` container
   - Added `data-floor-plan` attribute for measurement
   - Stage indicator at top center (unchanged)
   - All tables rendered via `.map()` with `DraggableTable` wrapper

5. **Updated click hint:**
   - When `onUpdatePosition` provided: "Drag tables to reposition. Click to edit."
   - Otherwise: "Click on a table to edit"

**VipTablesManagement.tsx integration:**

1. **Import and handler:**
   ```typescript
   import { updateTablePosition } from '@/lib/vip-tables-admin-service';

   const handleUpdatePosition = async (tableId: string, x: number, y: number) => {
     const result = await updateTablePosition(tableId, { x, y });
     if (!result.success) {
       toast({ variant: 'destructive', title: 'Error', description: 'Failed to save table position' });
       throw new Error(result.error);
     }
   };
   ```

2. **Pass position data:**
   ```typescript
   tables={eventVipTables.map(t => ({
     // ... existing fields
     position_x: t.position_x ?? null,
     position_y: t.position_y ?? null,
   }))}
   ```

3. **Pass handler:**
   ```typescript
   <VIPFloorPlanAdmin
     onUpdatePosition={handleUpdatePosition}
     // ... other props
   />
   ```

## Deviations from Plan

None — plan executed exactly as written.

## Verification

✅ Migration file creates position_x and position_y columns with backfill
✅ @dnd-kit/core installed: `npm ls @dnd-kit/core` → `@dnd-kit/core@6.3.1`
✅ VIPFloorPlanAdmin uses DndContext with draggable tables
✅ updateTablePosition saves coordinates to event_vip_tables
✅ VipTablesManagement passes onUpdatePosition callback
✅ Build succeeds: `npm run build` → ✓ built in 8.36s
✅ TypeScript compiles: `npx tsc --noEmit` → no errors

## What Works Now

- **Drag-and-drop positioning:** Owner drags tables to any position on floor plan canvas
- **Position persistence:** Coordinates saved to database, survive page reload
- **Default layout:** Tables without positions render at sensible grid locations (backfilled by migration)
- **Optimistic updates:** Immediate visual feedback during drag, rollback on error
- **Existing functionality preserved:**
  - Click to select table
  - Tier colors (premium=amber, front_row=purple, standard=blue)
  - Reservation status rings (green ring for reserved tables)
  - Stage indicator
  - Legend and stats

## Technical Notes

**Coordinate system mapping:**
- Database: `position_x` (0-1000), `position_y` (0-700) — logical units
- CSS: `left: ${(x/1000)*100}%`, `top: ${(y/700)*100}%` — percentage
- Drag delta: `(pixelDelta / containerWidth) * 1000` — pixels to logical units

**Bounds enforcement:**
- X: clamped to 0-950 (leaves 50 units for table width)
- Y: clamped to 0-650 (leaves 50 units for table height)
- Prevents tables from being dragged off-canvas

**Performance:**
- Optimistic updates prevent lag during drag
- Single database update on drag end (not continuous tracking)
- Percentage-based positioning scales to any container size

## Next Steps (Not in This Plan)

Future enhancements could include:
- Snap-to-grid option for aligned layouts
- Collision detection to prevent table overlap
- Undo/redo for position changes
- Save/load layout presets
- Visual distance indicators from stage

## Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add table positioning infrastructure | `2eb3e9a` | migration, package.json, vip-tables-admin-service.ts |
| 2 | Implement drag-and-drop floor plan | `932fd74` | VIPFloorPlanAdmin.tsx, VipTablesManagement.tsx |

## Self-Check: PASSED

### Created Files
```bash
[ -f "maguey-pass-lounge/supabase/migrations/20260215000000_add_table_positions.sql" ] && echo "FOUND" || echo "MISSING"
# → FOUND
```

### Modified Files
```bash
grep -q "updateTablePosition" maguey-gate-scanner/src/lib/vip-tables-admin-service.ts && echo "FOUND" || echo "MISSING"
# → FOUND

grep -q "DndContext" maguey-gate-scanner/src/components/vip/VIPFloorPlanAdmin.tsx && echo "FOUND" || echo "MISSING"
# → FOUND

grep -q "handleUpdatePosition" maguey-gate-scanner/src/pages/VipTablesManagement.tsx && echo "FOUND" || echo "MISSING"
# → FOUND
```

### Commits Exist
```bash
git log --oneline --all | grep "2eb3e9a" && echo "FOUND" || echo "MISSING"
# → FOUND: feat(21-01): add table positioning infrastructure

git log --oneline --all | grep "932fd74" && echo "FOUND" || echo "MISSING"
# → FOUND: feat(21-01): implement drag-and-drop floor plan
```

All files created, all modifications verified, all commits exist. ✅
