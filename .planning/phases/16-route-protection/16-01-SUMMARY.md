---
phase: 16-route-protection
plan: 01
subsystem: auth-infrastructure
tags: [P0, auth, route-protection, authorization]
dependency_graph:
  requires: [Phase 15 (Auth Hardening)]
  provides: [ProtectedRoute wrapper, 403 error page]
  affects: [App.tsx routing, Phase 16-02 implementation]
tech_stack:
  added: []
  patterns: [Route wrapper components, Role-based authorization, DEV-only gating]
key_files:
  created:
    - maguey-gate-scanner/src/components/ProtectedRoute.tsx
    - maguey-gate-scanner/src/pages/Unauthorized.tsx
  modified: []
decisions:
  - decision: "ProtectedRoute accepts allowedRoles as optional array (flexible ['owner'], ['owner', 'promoter'], etc.)"
    rationale: "Provides maximum flexibility for route definition without creating separate wrapper components per role"
  - decision: "Loading state shows centered spinner (prevents flash of login page)"
    rationale: "Better UX than briefly showing login page during auth state resolution"
  - decision: "Redirect to /auth (not /auth/employee or /auth/owner)"
    rationale: "Central /auth page auto-redirects to /auth/employee, providing consistent entry point"
  - decision: "requireDev check happens BEFORE auth check"
    rationale: "DEV-only routes should be invisible in production regardless of authentication status"
  - decision: "Unauthorized page has role-aware navigation (owner->Dashboard, employee->Scanner)"
    rationale: "Returns users to their appropriate home page based on role for better UX"
metrics:
  duration: 63 seconds
  completed: 2026-02-14
  tasks: 2
  files_created: 2
  commits: 2
---

# Phase 16 Plan 01: ProtectedRoute & Unauthorized Page

**One-liner:** Created ProtectedRoute wrapper with auth/role/DEV guards and 403 Unauthorized page with role-aware navigation.

## What Was Built

Created two foundational components for Phase 16 route protection:

### ProtectedRoute Wrapper (`src/components/ProtectedRoute.tsx`)
- **Authentication guard:** Redirects unauthenticated users to `/auth` with `state.from` preserved for post-login redirect
- **Role authorization:** Accepts optional `allowedRoles` array, shows 403 when user role not permitted
- **DEV-only gating:** `requireDev` prop blocks routes in production builds (for test/debug routes)
- **Loading spinner:** Full-screen centered spinner while auth state resolves (prevents flash of login page)
- **Named export:** `ProtectedRoute` for consistency with wrapper component patterns

**Logic flow (order matters):**
1. Loading → spinner
2. DEV check → 403 if requireDev && !import.meta.env.DEV (checked before auth to hide route in production)
3. Auth check → redirect to /auth with state.from if !user
4. Role check → 403 if allowedRoles defined and role not in array
5. All pass → render children

### Unauthorized Page (`src/pages/Unauthorized.tsx`)
- **403 UI:** ShieldAlert icon, "Access Denied" heading and message
- **Role-aware navigation:**
  - Owner/Promoter: "Back to Dashboard" button → `/dashboard`
  - Employee: "Back to Scanner" button → `/scanner`
  - No user (edge case): "Back to Login" button → `/auth`
- **Sign out:** Always present for account switching
- **Mobile-friendly:** Vertically stacked buttons with `space-y-3`
- **Theme:** Uses `bg-background`, `text-muted-foreground` (scanner site dark theme)
- **Default export:** Consistent with all other page components

## Deviations from Plan

None - plan executed exactly as written.

## Integration Points

**ProtectedRoute integrates with:**
- `@/contexts/AuthContext` → `useAuth()` for user, role, loading state
- `@/lib/auth` → `UserRole` type definition
- `react-router-dom` → `Navigate` with state.from, `useLocation` for current path
- `@/pages/Unauthorized` → renders when role check fails or DEV-only route in production

**Unauthorized integrates with:**
- `@/contexts/AuthContext` → `useAuth()` for role-based navigation
- `@/lib/supabase` → `supabase.auth.signOut()` for logout
- `react-router-dom` → `useNavigate()` for button actions
- `@/components/ui/button` → shadcn/ui Button component

**Used by (next plan):**
- Phase 16-02 will wrap all dashboard routes with `<ProtectedRoute allowedRoles={['owner', 'promoter']}>` in App.tsx

## Verification Results

**Files Created:**
- ✅ `/Users/luismiguel/Desktop/Maguey-Nightclub-Live/maguey-gate-scanner/src/components/ProtectedRoute.tsx` (57 lines)
- ✅ `/Users/luismiguel/Desktop/Maguey-Nightclub-Live/maguey-gate-scanner/src/pages/Unauthorized.tsx` (77 lines)

**TypeScript Compilation:**
- ✅ Full project compiles without errors (`npx tsc --noEmit`)

**Logic Validation:**
- ✅ ProtectedRoute has all 5 logic paths (loading, DEV, auth, role, success)
- ✅ Unauthorized page has role-aware navigation (3 variants based on role)
- ✅ Both components use scanner site theme classes (`bg-background`, `text-muted-foreground`)

**Commits:**
- ✅ `33cd6cc` - feat(16-01): create ProtectedRoute wrapper component
- ✅ `0f0f51a` - feat(16-01): create 403 Unauthorized error page

## Self-Check: PASSED

**Created files exist:**
```bash
FOUND: maguey-gate-scanner/src/components/ProtectedRoute.tsx
FOUND: maguey-gate-scanner/src/pages/Unauthorized.tsx
```

**Commits exist:**
```bash
FOUND: 33cd6cc
FOUND: 0f0f51a
```

**Features verified:**
- ProtectedRoute exports named function
- Loading spinner uses bg-background (scanner theme)
- DEV check precedes auth check
- Navigate includes state.from for post-login redirect
- Unauthorized has 3 role-aware navigation variants
- Sign out button always present

## Next Steps

**Phase 16-02:** Apply ProtectedRoute to all dashboard routes in App.tsx:
- Wrap `/dashboard`, `/events`, `/analytics`, `/team`, `/settings`, etc. with `allowedRoles={['owner', 'promoter']}`
- Wrap `/test-qr` with `requireDev={true}`
- Leave `/scanner`, `/auth/*` unwrapped (public entry points)
- Update navigation guards to remove manual checks (centralized in ProtectedRoute)

**P0 Blocker Status:**
- ✅ R06 (ProtectedRoute wrapper): Foundation complete
- ⬜ R06 (Apply to routes): Next plan
- ⬜ R07 (Separate login flows): Complete (Phase 15)
- ⬜ R08 (Remove demo shortcuts): Complete (Phase 15)

## Performance Metrics

- **Duration:** 63 seconds (1.05 minutes)
- **Tasks completed:** 2/2
- **Files created:** 2
- **Commits:** 2
- **Lines added:** 134

## Key Decisions

1. **allowedRoles is optional array:** Provides flexibility for role combinations without creating multiple wrapper components
2. **Loading spinner prevents login flash:** Better UX than briefly showing login page during auth resolution
3. **Redirect to /auth (not specialized pages):** Central entry point auto-redirects to employee login
4. **DEV check before auth:** Makes DEV-only routes invisible in production builds
5. **Role-aware navigation on 403:** Returns users to their appropriate home (Dashboard vs Scanner)
