---
phase: 20-bloat-cleanup
plan: 04
subsystem: scanner
tags: [feature-flag, dead-code, cleanup]
dependency_graph:
  requires: []
  provides: [nfc-feature-flag]
  affects: [scanner-ui, fullscreen-scanner]
tech_stack:
  added: [VITE_ENABLE_NFC]
  patterns: [feature-flag-gating]
key_files:
  created: []
  modified:
    - maguey-gate-scanner/src/pages/Scanner.tsx
    - maguey-gate-scanner/src/components/scanner/FullScreenScanner.tsx
decisions:
  - nfc-feature-flag-pattern
  - dead-code-preservation
metrics:
  duration: 383
  completed: 2026-02-15
---

# Phase 20 Plan 04: Gate NFC and Verify Dead Code Summary

**One-liner:** NFC scan mode hidden behind VITE_ENABLE_NFC feature flag; 4 dead code modals confirmed unused and preserved per no-deletion constraint.

## Objective

Gate NFC scan mode behind a feature flag and confirm dead code component status for IDVerificationModal, OverrideActivationModal, OverrideReasonModal, and LowBatteryModal.

## Execution

### Task 1: Gate NFC scan mode behind VITE_ENABLE_NFC feature flag ✅

**Changes:**

1. **Scanner.tsx** (line 116):
   - Added `nfcEnabled` constant: `import.meta.env.VITE_ENABLE_NFC === 'true'`
   - Gated NFC view rendering (line 989): `{nfcEnabled && scanMode === "nfc" && ...}`
   - Gated NFC button in mode selector (line 1055): `{nfcEnabled && <button ...>}`

2. **FullScreenScanner.tsx** (line 141):
   - Added `nfcEnabled` constant: `import.meta.env.VITE_ENABLE_NFC === 'true'`
   - Gated NFC scanner rendering (line 230): `nfcEnabled && scanMethod === "nfc" ? ...`
   - Gated NFC toggle button (line 374): `{nfcEnabled && nfcAvailable && ...}`

**Pattern:** When `VITE_ENABLE_NFC` is not set or not `'true'`, NFC UI is hidden. QR and Manual modes work unchanged. To enable NFC, add `VITE_ENABLE_NFC=true` to `.env`.

**Verification:**
- Scanner.tsx: 3 `nfcEnabled` occurrences (constant + 2 UI gates) ✅
- FullScreenScanner.tsx: 3 `nfcEnabled` occurrences (constant + 2 UI gates) ✅
- TypeScript compilation: No errors ✅

**Commit:** `7f3b003` - feat(20-04): gate NFC scan mode behind VITE_ENABLE_NFC feature flag

### Task 2: Verify and document dead code component status ✅

**Verification Results:**

1. **IDVerificationModal.tsx** — Dead code confirmed
   - Component file: `/src/components/IDVerificationModal.tsx`
   - Imports: Only in its own file (self-reference)
   - Service imports: `id-verification-service` IS used in:
     - `scanner-service.ts` (service functions, not component)
     - `Dashboard.tsx` (`getIDVerificationStats` for analytics)
     - `TicketResult.tsx` (verification status checks)
   - JSX usage: **0 matches** — component never rendered
   - Status: Dead code, zero runtime impact

2. **OverrideActivationModal.tsx** — Dead code confirmed
   - Component file: `/src/components/OverrideActivationModal.tsx`
   - Imports: Only in its own file
   - JSX usage: **0 matches** — component never rendered
   - Status: Dead code, zero runtime impact

3. **OverrideReasonModal.tsx** — Dead code confirmed
   - Component file: `/src/components/OverrideReasonModal.tsx`
   - Imports: Only in its own file
   - JSX usage: **0 matches** — component never rendered
   - Status: Dead code, zero runtime impact

4. **LowBatteryModal.tsx** — Dead code confirmed
   - Component file: `/src/components/LowBatteryModal.tsx`
   - Imports: Only in its own file
   - JSX usage: **0 matches** — component never rendered
   - Status: Dead code, zero runtime impact

**No deletions:** Per the no-deletion constraint, all 4 component files left in place. They will be tree-shaken during production builds (zero bundle size impact). No commit needed for this verification task.

## Deviations from Plan

None. Plan executed exactly as written.

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| **NFC feature flag pattern** | Use `VITE_ENABLE_NFC === 'true'` check. Env var must be explicitly set to enable NFC (fail-safe default). |
| **Dead code preservation** | Per no-deletion constraint, all 4 modal components left in place. Modern bundlers tree-shake unused exports, so zero runtime impact. |
| **Service vs component distinction** | id-verification-service (functions) is actively used; IDVerificationModal (component) is not. Service imports don't count as component usage. |

## Files Modified

| File | Changes | Lines |
|------|---------|-------|
| `maguey-gate-scanner/src/pages/Scanner.tsx` | Added `nfcEnabled` constant, gated NFC view + button | +3 feature flag checks |
| `maguey-gate-scanner/src/components/scanner/FullScreenScanner.tsx` | Added `nfcEnabled` constant, gated NFC scanner + toggle | +3 feature flag checks |

## Files Verified (No Changes)

| File | Status | Reason |
|------|--------|--------|
| `maguey-gate-scanner/src/components/IDVerificationModal.tsx` | Dead code, preserved | Not imported for rendering |
| `maguey-gate-scanner/src/components/OverrideActivationModal.tsx` | Dead code, preserved | Not imported for rendering |
| `maguey-gate-scanner/src/components/OverrideReasonModal.tsx` | Dead code, preserved | Not imported for rendering |
| `maguey-gate-scanner/src/components/LowBatteryModal.tsx` | Dead code, preserved | Not imported for rendering |

## Verification Results

1. ✅ NFC mode hidden in Scanner.tsx when VITE_ENABLE_NFC is not set
2. ✅ NFC toggle hidden in FullScreenScanner.tsx when VITE_ENABLE_NFC is not set
3. ✅ QR and Manual scan modes work unchanged
4. ✅ NFCScanner component file still exists (not deleted)
5. ✅ 4 dead code components confirmed: not rendered anywhere
6. ✅ 4 dead code component files still exist (not deleted)
7. ✅ TypeScript compiles without errors

## Success Criteria

- ✅ NFC scan mode gated behind `VITE_ENABLE_NFC` env var (default: hidden)
- ✅ QR and Manual modes fully functional
- ✅ Dead code components confirmed and documented (not deleted)
- ✅ Zero files deleted, zero functional regressions

## Notes

**NFC Hardware Dependency:** NFC scanning requires physical NFC tags that Maguey does not currently have. The feature flag allows future re-enabling when hardware is acquired by adding `VITE_ENABLE_NFC=true` to the environment configuration.

**Bundle Size Impact:** Dead code components (IDVerificationModal, OverrideActivationModal, OverrideReasonModal, LowBatteryModal) have zero bundle size impact in production builds due to tree-shaking. They are not imported for rendering, so modern bundlers (Vite/Rollup) exclude them from the final bundle automatically.

**Service vs Component:** The `id-verification-service` is actively used throughout the codebase (scanner-service.ts, Dashboard.tsx, TicketResult.tsx), but the `IDVerificationModal` component itself is never rendered. This is expected behavior — the service provides verification logic, while the modal would provide UI (currently unused).

## Self-Check: PASSED

**Files created:** None (plan only modified 2 existing files)

**Files modified:**
- `/Users/luismiguel/Desktop/Maguey-Nightclub-Live/maguey-gate-scanner/src/pages/Scanner.tsx` — FOUND ✅
- `/Users/luismiguel/Desktop/Maguey-Nightclub-Live/maguey-gate-scanner/src/components/scanner/FullScreenScanner.tsx` — FOUND ✅

**Commits:**
- `7f3b003` — FOUND ✅
