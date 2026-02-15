---
phase: 14-auth-foundation
plan: 02
subsystem: authentication
tags: [security, localStorage, production-hardening, dev-mode]

dependency_graph:
  requires:
    - 14-01-real-supabase-accounts
  provides:
    - localStorage-gated-dev-mode
    - production-safe-auth
  affects:
    - phase-15-login-flows
    - phase-16-route-protection

tech_stack:
  added: []
  patterns:
    - import-meta-env-dev-gating
    - production-security-hardening

key_files:
  created: []
  modified:
    - maguey-gate-scanner/src/contexts/AuthContext.tsx
    - maguey-gate-scanner/src/lib/auth.ts
    - maguey-gate-scanner/src/pages/OwnerDashboard.tsx
    - maguey-gate-scanner/src/pages/Dashboard.tsx

decisions:
  - decision: "Gate all localStorage auth fallbacks behind import.meta.env.DEV"
    rationale: "Production builds must never trust localStorage for authentication — only real Supabase sessions are valid"
    impact: "Production builds reject localStorage auth manipulation, eliminating security risk from browser devtools"
  - decision: "Throw error in setUserRole when not configured in production"
    rationale: "Production code should fail fast if Supabase is not configured, rather than silently using localStorage"
    impact: "Clearer error messages for misconfiguration in production"
  - decision: "Return null in getCurrentUserRole when not configured in production"
    rationale: "Not configured = not authenticated in production context"
    impact: "Consistent null authentication state across production builds"

metrics:
  duration_minutes: 2
  tasks_completed: 2
  commits: 2
  files_modified: 4
  dev_checks_added: 10
  completed_at: "2026-02-14T02:40:46Z"
---

# Phase 14 Plan 02: Gate localStorage Auth Behind DEV Flag

**One-liner:** Production builds now ONLY use Supabase sessions — localStorage auth fallbacks are gated behind import.meta.env.DEV for development-only testing.

## Objective

Eliminate the security risk of localStorage-based authentication in production builds by gating all localStorage auth fallbacks behind `import.meta.env.DEV`. This ensures production builds reject localStorage manipulation while preserving development mode convenience.

## What Was Built

### 1. AuthContext.tsx — 4 DEV Gates Added

**File:** `maguey-gate-scanner/src/contexts/AuthContext.tsx`

**Changes:**
- **Lines 41-51:** `refreshRole` — `!isSupabaseConfigured()` localStorage fallback gated
- **Lines 68-76:** `refreshRole` — session null localStorage fallback gated
- **Lines 94-103:** `initAuth` — double-check localStorage fallback gated
- **Lines 128-139:** `onAuthStateChange` — session null localStorage fallback gated

**Pattern:**
```typescript
// BEFORE:
const localUser = localStorageService.getUser();
if (localUser) { /* use it */ }

// AFTER:
if (import.meta.env.DEV) {
  const localUser = localStorageService.getUser();
  if (localUser) { /* use it */ }
} else {
  setUser(null);
  setRole('employee');
}
```

**Result:** Production builds never check localStorage during auth initialization or session changes.

### 2. auth.ts — 2 DEV Gates Added

**File:** `maguey-gate-scanner/src/lib/auth.ts`

**Changes:**
- **setUserRole (lines 41-68):** Gated localStorage write behind DEV; throws error in production if Supabase not configured
- **getCurrentUserRole (lines 97-113):** Returns null in production if Supabase not configured (instead of DEFAULT_ROLE)

**Pattern:**
```typescript
// setUserRole
if (!isSupabaseConfigured() && import.meta.env.DEV) {
  // localStorage write (dev only)
}
if (!isSupabaseConfigured()) {
  throw new Error('Cannot set user role: Supabase not configured in production');
}

// getCurrentUserRole
if (!isSupabaseConfigured() && import.meta.env.DEV) {
  return DEFAULT_ROLE; // dev fallback
}
if (!isSupabaseConfigured()) {
  return null; // production: not configured = not authenticated
}
```

**Result:** Production builds fail fast with clear errors instead of silently using localStorage.

### 3. OwnerDashboard.tsx — 3 DEV Gates Added

**File:** `maguey-gate-scanner/src/pages/OwnerDashboard.tsx`

**Changes:**
- **Lines 187-190:** Session null fallback gated
- **Lines 199-204:** Catch block fallback gated
- **Lines 210-218:** `!isSupabaseConfigured()` fallback gated

**Pattern:**
```typescript
if (!session) {
  if (import.meta.env.DEV) {
    const localUser = localStorageService.getUser();
    if (localUser && (localUser.role === 'owner' || localUser.role === 'promoter')) {
      loadData();
      return;
    }
  }
  navigate("/auth");
  return;
}
```

**Result:** Production builds always redirect to `/auth` when no Supabase session exists.

### 4. Dashboard.tsx — 1 DEV Gate Added

**File:** `maguey-gate-scanner/src/pages/Dashboard.tsx`

**Changes:**
- **Lines 243-251:** `!isSupabaseConfigured()` fallback gated

**Pattern:**
```typescript
} else {
  if (import.meta.env.DEV) {
    const localUser = localStorageService.getUser();
    if (!localUser) {
      navigate("/auth");
      return;
    }
  } else {
    navigate("/auth");
    return;
  }
}
```

**Result:** Production builds always redirect to `/auth` when Supabase not configured.

## Verification Results

### TypeScript Compilation
```bash
cd maguey-gate-scanner && npx tsc --noEmit
# ✓ No type errors
```

### localStorage.getUser() Gating Audit
```bash
grep -n 'localStorageService.getUser' src/contexts/AuthContext.tsx src/lib/auth.ts src/pages/OwnerDashboard.tsx src/pages/Dashboard.tsx
```

**Result:** All 8 occurrences are inside `if (import.meta.env.DEV)` blocks.

### DEV Check Count
- **AuthContext.tsx:** 4 `import.meta.env.DEV` checks
- **auth.ts:** 2 `import.meta.env.DEV` checks
- **OwnerDashboard.tsx:** 3 `import.meta.env.DEV` checks
- **Dashboard.tsx:** 1 `import.meta.env.DEV` check
- **Total:** 10 DEV gates

### Success Criteria
- ✅ Every `localStorageService.getUser()` call is gated behind `import.meta.env.DEV`
- ✅ Production builds (import.meta.env.DEV === false) ONLY use Supabase sessions
- ✅ Development builds retain full localStorage fallback for testing
- ✅ No TypeScript compilation errors
- ✅ Scanner site builds without errors

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| 1ba63d8 | feat | Gate AuthContext localStorage fallback behind DEV (4 locations) |
| 19c4713 | feat | Gate auth.ts and dashboard pages localStorage behind DEV (6 locations) |

## Production Impact

**Before this plan:**
- User could open browser devtools in production
- Set `localStorage.setItem('user', JSON.stringify({role: 'owner', email: 'fake@test.com'}))`
- Gain unauthorized access to owner dashboard

**After this plan:**
- Production builds ignore localStorage entirely
- Only valid Supabase sessions grant authentication
- localStorage manipulation has zero effect in production

## Development Impact

**No change to dev workflow:**
- `npm run dev` still uses localStorage fallback
- Demo buttons on `/auth` still work
- Role switching still works via localStorage
- Development mode remains convenient

## Next Steps

This plan sets the foundation for Phase 15 (Auth Hardening & Login Flows):
- **Plan 15-01:** Remove demo buttons from Auth.tsx (only accessible in DEV mode)
- **Plan 15-02:** Create separate login flows for owner vs employee
- **Plan 15-03:** Implement session timeout and refresh logic

And Phase 16 (Route Protection):
- **Plan 16-01:** Create ProtectedRoute wrapper component
- **Plan 16-02:** Apply route protection to all dashboard routes

## Self-Check: PASSED

**Files modified:**
```bash
[FOUND] maguey-gate-scanner/src/contexts/AuthContext.tsx (4 DEV gates)
[FOUND] maguey-gate-scanner/src/lib/auth.ts (2 DEV gates)
[FOUND] maguey-gate-scanner/src/pages/OwnerDashboard.tsx (3 DEV gates)
[FOUND] maguey-gate-scanner/src/pages/Dashboard.tsx (1 DEV gate)
```

**Commits exist:**
```bash
[FOUND] 1ba63d8 (Task 1: AuthContext localStorage gating)
[FOUND] 19c4713 (Task 2: auth.ts and dashboard pages gating)
```

**TypeScript compilation:**
```bash
[PASS] npx tsc --noEmit — no type errors
```

**localStorage gating:**
```bash
[PASS] All 8 localStorageService.getUser() calls are inside import.meta.env.DEV blocks
```

All claims verified. Plan execution complete.
