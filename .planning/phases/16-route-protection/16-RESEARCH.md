# Phase 16: Route Protection — Research

**Phase:** 16 — Route Protection
**Priority:** P0 | **Effort:** 1.5 days | **Dependencies:** Phase 14, 15
**Researcher:** GSD Phase Researcher
**Date:** 2026-02-13

---

## Executive Summary

Phase 16 requires implementing authentication guards for 30+ unprotected routes in maguey-gate-scanner. Currently, any visitor can access `/dashboard`, `/events`, `/analytics`, etc. without logging in. This phase creates a `ProtectedRoute` wrapper component with role-based authorization and applies it across all routes in `App.tsx`.

**Key Finding:** The existing auth infrastructure (Phases 14 & 15) provides everything needed — we just need to wire the guards. The maguey-pass-lounge site already has a working `ProtectedRoute` component we can adapt.

---

## 1. Current State Analysis

### 1.1 Routing Architecture

**File:** `maguey-gate-scanner/src/App.tsx` (lines 55-95)
- **40 total routes** defined in React Router v6
- **0 routes protected** with authentication checks
- BrowserRouter with `future` flags enabled (v7 migration prep)
- All routes rendered directly without authorization wrappers

**Route Inventory:**

| Route Type | Count | Examples |
|------------|-------|----------|
| Public (should remain) | 4 | `/`, `/auth`, `/auth/owner`, `/auth/employee` |
| Employee (needs auth) | 4 | `/scanner`, `/guest-list`, `/scan/vip`, `/scan/vip/:eventId` |
| Owner-only (needs auth + role) | 26 | `/dashboard`, `/events`, `/analytics`, `/team`, `/orders`, `/vip-tables` |
| Dev-only (needs env check) | 1 | `/test-qr` |
| Monitoring (owner-only) | 6 | `/monitoring/metrics`, `/monitoring/traces`, etc. |
| Catch-all | 1 | `*` (NotFound page) |

### 1.2 Auth Infrastructure (from Phases 14 & 15)

**AuthContext.tsx** (lines 1-167)
- Exports: `useAuth()`, `useRole()`
- Returns: `{ user, role, loading, refreshRole }`
- Supported roles: `'owner' | 'promoter' | 'employee'`
- **Loading state handling**: Critical for preventing flash redirects during session check
- **DEV mode fallback**: localStorage only activates when `import.meta.env.DEV === true`
- **Production behavior**: No user session = `user: null, role: 'employee', loading: false`

**auth.ts** (lines 1-118)
- `getUserRole(user)`: Extracts role from `user.user_metadata.role` or `user.app_metadata.role`
- `hasPermission(role, permission)`: Permission matrix for 'view_analytics', 'manage_events', etc.
- **Permissions:**
  - Owner: All permissions (always returns `true`)
  - Promoter: `['view_analytics', 'view_events', 'view_orders']`
  - Employee: No special permissions (scanner access only)

**auth-utils.ts** (lines 1-62)
- `AUTH_ROUTES`: Constants for redirect targets
  - `OWNER_LOGIN: '/auth/owner'`
  - `EMPLOYEE_LOGIN: '/auth/employee'`
  - `OWNER_REDIRECT: '/dashboard'`
  - `EMPLOYEE_REDIRECT: '/scanner'`
- `navigateByRole(userData, navigate)`: Auto-redirect helper used in login flows

**Login Pages** (Phase 15 output)
- `/auth/owner` → OwnerLogin.tsx (email/password)
- `/auth/employee` → EmployeeLogin.tsx (simplified auth)
- Both pages already redirect authenticated users (lines 26-35 in EmployeeLogin.tsx)

### 1.3 Existing ProtectedRoute Pattern (maguey-pass-lounge)

**File:** `maguey-pass-lounge/src/components/ProtectedRoute.tsx` (lines 1-34)

```typescript
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    // Redirect to login page, but save the attempted location
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
```

**Key patterns:**
1. Loading state shows spinner (prevents flash of login page)
2. `useLocation()` preserves attempted route for post-login redirect
3. `<Navigate replace>` ensures no back-button to protected page after logout
4. No role checking — only authentication (we need to add this)

**Usage in maguey-pass-lounge/src/App.tsx** (lines 86-92):
```typescript
<Route
  path="/account"
  element={
    <ProtectedRoute>
      <Account />
    </ProtectedRoute>
  }
/>
```

---

## 2. Requirements Deep Dive

### 2.1 GSD-6 / R06: Dashboard routes not protected

**From Maguey-GSD-Framework.xlsx:**
- Priority: P0 (blocker)
- Effort: 2 days
- Verification: "Unauthenticated users redirected to /auth for any protected route"

**Security Risk:**
- Anyone can visit `https://staff.magueynightclub.com/dashboard` without login
- Sensitive data (revenue, customer info, analytics) exposed to public
- Owner dashboard shows real-time financial metrics

**Scope:** 30+ routes (see Route Classification table in CONTEXT.md)

### 2.2 Phase-Specific Success Criteria

From `.planning/phases/16-route-protection/16-CONTEXT.md`:
1. Unauthenticated users → redirected to `/auth`
2. Employee role sees **403 page** when accessing owner-only routes
3. Owner role can access all routes
4. `/test-qr` only accessible when `import.meta.env.DEV === true`

**New requirement:** We need a 403/Unauthorized page (doesn't exist yet)

### 2.3 Role-Based Access Matrix

| Route Pattern | Owner | Promoter | Employee | Unauthenticated |
|---------------|-------|----------|----------|-----------------|
| `/` (Index) | ✅ | ✅ | ✅ | ✅ (auto-redirects to /auth/employee) |
| `/auth/*` | ✅ | ✅ | ✅ | ✅ |
| `/scanner` | ✅ | ✅ | ✅ | ❌ → /auth |
| `/scan/vip` | ✅ | ✅ | ✅ | ❌ → /auth |
| `/guest-list` | ✅ | ✅ | ✅ | ❌ → /auth |
| `/dashboard` | ✅ | ✅ | ❌ → 403 | ❌ → /auth |
| `/events` | ✅ | ✅ | ❌ → 403 | ❌ → /auth |
| `/analytics` | ✅ | ✅ | ❌ → 403 | ❌ → /auth |
| `/team` | ✅ | ❌ → 403 | ❌ → 403 | ❌ → /auth |
| `/audit-log` | ✅ | ❌ → 403 | ❌ → 403 | ❌ → /auth |
| `/monitoring/*` | ✅ | ❌ → 403 | ❌ → 403 | ❌ → /auth |
| `/test-qr` | ✅ (DEV only) | ❌ (always) | ❌ (always) | ❌ → /auth |

**Note:** Promoter role exists in auth.ts but is not actively used. Treat as owner-equivalent for MVP.

---

## 3. React Router v6 Best Practices

### 3.1 Protected Route Patterns (Industry Standard)

**Source:** [LogRocket: Authentication with React Router v6](https://blog.logrocket.com/authentication-react-router-v6/)

**Recommended approach:**
```typescript
<Route
  path="/dashboard"
  element={
    <ProtectedRoute allowedRoles={['owner', 'promoter']}>
      <OwnerDashboard />
    </ProtectedRoute>
  }
/>
```

**Anti-pattern (avoid):**
```typescript
// Don't do route-level logic inside page components
const Dashboard = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/auth" />;
  // ...
}
```
**Why avoid:** Duplicates logic across 30+ pages, violates DRY, harder to audit.

### 3.2 Navigate Component Best Practices

**Source:** [ui.dev: Protected Routes and Authentication](https://ui.dev/react-router-protected-routes-authentication)

**Critical props:**
1. `replace`: Prevents back-button navigation to protected page
2. `state={{ from: location }}`: Preserves attempted URL for post-login redirect

**Example:**
```typescript
<Navigate
  to="/auth"
  state={{ from: location }}
  replace
/>
```

**Post-login redirect implementation** (in login page):
```typescript
const location = useLocation();
const from = location.state?.from?.pathname || '/dashboard';
navigate(from);
```

### 3.3 Loading State Handling

**Source:** [Medium: React Router V6 — Simplified Protected Routes](https://medium.com/@shirisha95/react-router-v6-simplified-protected-routes-85b209326a55)

**Problem:** Without loading state, unauthenticated users see flash of protected content before redirect.

**Solution:**
```typescript
if (loading) {
  return <LoadingSpinner />;
}
```

**Timing:**
- Session check: ~100-300ms
- Supabase `getSession()`: async operation
- Without spinner: user sees protected page → flash → redirect (bad UX)

### 3.4 Role-Based Guards

**Source:** [Adarsha Acharya: Role Based Authorization](https://www.adarsha.dev/blog/role-based-auth-with-react-router-v6)

**Pattern:**
```typescript
interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/auth" replace />;

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
```

**Design decision:** Default behavior (no `allowedRoles` prop) = any authenticated user. Explicit prop required for role restriction.

---

## 4. Implementation Strategy

### 4.1 ProtectedRoute Component Design

**File:** `maguey-gate-scanner/src/components/ProtectedRoute.tsx` (new file)

**Interface:**
```typescript
interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];  // Optional: if omitted, any auth'd user can access
  requireDev?: boolean;        // Optional: gate behind import.meta.env.DEV
}
```

**Logic flow:**
```
1. Check loading state
   → If true: render <Loader2 /> spinner

2. Check DEV mode requirement (if requireDev === true)
   → If production: render 403 Unauthorized page

3. Check user authentication
   → If no user: <Navigate to="/auth" state={{ from }} replace />

4. Check role authorization (if allowedRoles defined)
   → If user.role not in allowedRoles: render 403 Unauthorized page

5. All checks passed: render {children}
```

**Redirect target decision:**
- Default: `/auth` (redirects to `/auth/employee` per Phase 15)
- Alternative: Could route based on attempted URL (owner routes → `/auth/owner`, employee routes → `/auth/employee`)
- **Recommendation:** Use single `/auth` target for simplicity. Let Index.tsx auto-redirect handle routing.

### 4.2 Unauthorized Page Component

**File:** `maguey-gate-scanner/src/pages/Unauthorized.tsx` (new file)

**Purpose:** 403 error page for role-based access denial

**Design considerations:**
- Similar styling to NotFound.tsx
- Clear message: "You don't have permission to access this page"
- **Critical distinction from NotFound:**
  - NotFound (404): Page doesn't exist
  - Unauthorized (403): Page exists but user lacks permission
- Action buttons:
  - "Return to Dashboard" (if role === 'owner' or 'promoter')
  - "Return to Scanner" (if role === 'employee')
  - "Sign Out" (always)

**Pattern from NotFound.tsx** (can reuse structure):
```typescript
<div className="flex min-h-screen items-center justify-center bg-gray-100">
  <div className="text-center">
    <h1 className="mb-4 text-4xl font-bold">403</h1>
    <p className="mb-4 text-xl text-gray-600">Unauthorized Access</p>
    // ... buttons
  </div>
</div>
```

### 4.3 Route Wrapping Strategy

**File:** `maguey-gate-scanner/src/App.tsx`

**Approach:** Wrap each protected route's `element` prop.

**Example transformations:**

**Before (unprotected):**
```typescript
<Route path="/dashboard" element={<OwnerDashboard />} />
```

**After (owner-only):**
```typescript
<Route
  path="/dashboard"
  element={
    <ProtectedRoute allowedRoles={['owner', 'promoter']}>
      <OwnerDashboard />
    </ProtectedRoute>
  }
/>
```

**Employee routes:**
```typescript
<Route
  path="/scanner"
  element={
    <ProtectedRoute>
      <Scanner />
    </ProtectedRoute>
  }
/>
```

**Dev-only routes:**
```typescript
<Route
  path="/test-qr"
  element={
    <ProtectedRoute requireDev>
      <TestQrGenerator />
    </ProtectedRoute>
  }
/>
```

**Public routes (no wrapper):**
```typescript
<Route path="/" element={<Index />} />
<Route path="/auth" element={<Auth />} />
<Route path="/auth/owner" element={<OwnerLogin />} />
<Route path="/auth/employee" element={<EmployeeLogin />} />
<Route path="*" element={<NotFound />} />
```

### 4.4 Route Classification (Complete Inventory)

**Public (4 routes — no protection):**
- `/` — Index (auto-redirects to /auth/employee)
- `/auth` — Auth redirect page
- `/auth/owner` — Owner login
- `/auth/employee` — Employee login

**Employee (4 routes — auth required, any role):**
- `/scanner` — Ticket scanner
- `/guest-list` — Guest list check-in
- `/scan/vip` — VIP scanner (base)
- `/scan/vip/:eventId` — VIP scanner (event-specific)

**Owner-only (26 routes — auth required + owner/promoter role):**

*Main:*
- `/dashboard` — Owner dashboard

*Management:*
- `/events` — Event management
- `/vip-tables` — VIP table management
- `/orders` — Order management

*Analytics:*
- `/analytics` — Advanced analytics

*Team:*
- `/team` — Team management
- `/audit-log` — Audit log viewer
- `/staff-scheduling` — Staff scheduling

*Settings:*
- `/security` — Security settings
- `/branding` — Branding customization
- `/devices` — Device management
- `/door-counters` — Door counter management
- `/sites` — Site management

*Operations:*
- `/queue` — Queue management
- `/queue-status/:eventId` — Queue status (event-specific)
- `/waitlist` — Waitlist management
- `/customers` — Customer management
- `/fraud-investigation` — Fraud investigation

*Notifications:*
- `/notifications/preferences` — Notification preferences
- `/notifications/rules` — Notification rules
- `/notifications/analytics` — Notification analytics

*Monitoring:*
- `/monitoring/metrics` — Metrics dashboard
- `/monitoring/traces` — Traces viewer
- `/monitoring/errors` — Error logs
- `/monitoring/circuit-breakers` — Circuit breaker status
- `/monitoring/rate-limits` — Rate limit status
- `/monitoring/query-performance` — Query performance

*Other:*
- `/crew/settings` — Crew settings

**Dev-only (1 route — DEV mode + auth required):**
- `/test-qr` — QR code generator

**Catch-all (1 route — public):**
- `*` — NotFound page

**Total:** 36 routes (4 public + 4 employee + 26 owner + 1 dev + 1 catch-all)

---

## 5. Technical Considerations

### 5.1 Performance Implications

**Session check timing:**
- `supabase.auth.getSession()`: ~50-200ms (cached)
- `loading` state duration: Brief (< 300ms)
- **Impact:** Minimal — spinner shows during check

**Re-render optimization:**
- `useAuth()` returns memoized context value
- React Router only re-renders on route change
- ProtectedRoute renders once per route navigation

### 5.2 Edge Cases & Error Handling

**Case 1: Supabase session expires mid-session**
- AuthContext listens to `supabase.auth.onAuthStateChange()`
- Session expiry triggers `user: null` update
- ProtectedRoute re-evaluates → auto-redirect to `/auth`
- **Status:** Already handled (AuthContext lines 118-149)

**Case 2: localStorage fallback in production**
- Phase 14 gated all localStorage behind `import.meta.env.DEV`
- Production builds: `if (import.meta.env.DEV)` is tree-shaken out
- **Status:** Resolved in Phase 14

**Case 3: Role metadata missing on user object**
- `getUserRole(user)` defaults to `'employee'` (auth.ts line 16)
- Employee role has minimal permissions
- **Fallback behavior:** Secure by default (least privilege)

**Case 4: User navigates directly to protected URL**
- `useLocation()` captures attempted path
- `state={{ from: location }}` passed to Navigate
- Login page can redirect to `location.state?.from` post-auth
- **Status:** Pattern exists in maguey-pass-lounge, need to implement in owner/employee login pages

**Case 5: /test-qr accessed in production**
- `requireDev` prop checks `import.meta.env.DEV`
- Production: Shows 403 Unauthorized page
- Dev mode: Requires authentication but allows access
- **Consideration:** Should QR generator require owner role? (Recommend: yes, add to allowedRoles)

### 5.3 TypeScript Considerations

**Type safety:**
- `UserRole` type already defined in auth.ts (lines 5-8)
- ProtectedRoute props interface should import this type
- `allowedRoles` prop typed as `UserRole[] | undefined`

**Import paths:**
```typescript
import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@/lib/auth";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
```

### 5.4 Testing Considerations

**Manual testing checklist:**
1. Unauthenticated user visits `/dashboard` → redirected to `/auth`
2. Employee logs in, visits `/dashboard` → sees 403 Unauthorized
3. Owner logs in, visits `/dashboard` → sees dashboard
4. Owner logs out → dashboard immediately redirects to `/auth`
5. Employee visits `/scanner` → sees scanner (authorized)
6. Production build: `/test-qr` → 403 Unauthorized
7. Dev mode: `/test-qr` → requires auth, then shows page

**Automated testing:**
- Not in scope for Phase 16 (no test suite for auth flows)
- Phase 22 (Code Quality) may add tests

---

## 6. Dependencies & Integrations

### 6.1 Phase Dependencies

**Phase 14 (Complete):**
- ✅ Real Supabase auth accounts created
- ✅ AuthContext wired to Supabase
- ✅ localStorage gated behind DEV mode
- **Status:** Provides `useAuth()` hook with `{ user, role, loading }`

**Phase 15 (Complete):**
- ✅ Separate login flows (/auth/owner, /auth/employee)
- ✅ Demo shortcuts removed
- ✅ Role-based redirects implemented
- **Status:** Provides dedicated login pages for redirect targets

**What Phase 16 needs from them:**
- `useAuth()` hook (AuthContext.tsx)
- `UserRole` type (auth.ts)
- `AUTH_ROUTES` constants (auth-utils.ts)
- Login pages at `/auth/owner` and `/auth/employee`

### 6.2 Impact on Downstream Phases

**Phase 17 (Security Lockdown):**
- Will add server-side QR validation
- ProtectedRoute ensures only authenticated users reach scanner
- **Synergy:** Defense in depth (client + server auth)

**Phase 18 (Scanner Improvements):**
- Scanner page already protected after Phase 16
- Auto-detect event feature assumes authenticated user
- **Dependency:** Must complete Phase 16 first

**Phase 20 (Bloat Cleanup):**
- Will remove 5 monitoring routes
- Those routes already protected by Phase 16
- **Impact:** Fewer routes to maintain protection on

**Phase 23 (CI/CD):**
- E2E tests should verify route protection
- **Consideration:** Add test step for unauthenticated access attempts

### 6.3 UI Component Dependencies

**Needed from shadcn/ui:**
- `<Loader2>` (lucide-react) — already used in Scanner.tsx
- No new UI components required

**Layout components:**
- OwnerPortalLayout.tsx already has role-based sidebar filtering (lines 60-84)
- ProtectedRoute works independently of layout components
- **No changes needed** to layout components

---

## 7. Alternative Approaches Considered

### 7.1 Route-Level HOC vs Wrapper Component

**Wrapper approach (recommended):**
```typescript
<Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
```
**Pros:** Clear in App.tsx, easy to audit, explicit protection per route
**Cons:** Verbose (adds 2 lines per protected route)

**HOC approach:**
```typescript
const ProtectedDashboard = withProtection(Dashboard, ['owner']);
<Route path="/dashboard" element={<ProtectedDashboard />} />
```
**Pros:** Cleaner route definitions
**Cons:** Harder to trace, creates new components, less idiomatic for React Router v6

**Decision:** Use wrapper approach (industry standard for React Router v6)

### 7.2 Nested Route Groups vs Individual Wrapping

**Nested approach:**
```typescript
<Route element={<ProtectedRoute allowedRoles={['owner']} />}>
  <Route path="/dashboard" element={<Dashboard />} />
  <Route path="/events" element={<Events />} />
  // ... 26 more owner routes
</Route>
```
**Pros:** DRY, single ProtectedRoute instance
**Cons:** Requires refactoring App.tsx structure, harder to have mixed permissions

**Individual wrapping (recommended):**
```typescript
<Route path="/dashboard" element={<ProtectedRoute allowedRoles={['owner']}><Dashboard /></ProtectedRoute>} />
<Route path="/scanner" element={<ProtectedRoute><Scanner /></ProtectedRoute>} />
```
**Pros:** Granular control, easy to modify individual routes, clear permissions
**Cons:** More repetition

**Decision:** Use individual wrapping for MVP. Phase 22 (Code Quality) can refactor to nested groups if needed.

### 7.3 Client-Only vs Server-Side Auth Verification

**Current approach (client-only):**
- ProtectedRoute checks `user` from AuthContext
- Supabase session token stored in browser
- RLS policies enforce server-side data access

**Full server verification:**
- Every page load verifies session server-side
- Requires server-side rendering or API calls

**Decision:** Client-only is sufficient because:
1. All data queries go through Supabase (RLS enforces access)
2. Front-end route protection is UX layer, not security layer
3. Sensitive operations (payments, admin actions) already verify server-side

**Quote from research:** *"Front-end protected route solutions are for UX purposes only. You should have proper checks in place on the server side to make sure users aren't getting access to data they shouldn't be."* — [CoreUI: How to protect routes](https://coreui.io/answers/how-to-protect-routes-in-react-router/)

---

## 8. Migration & Rollout Plan

### 8.1 Implementation Sequence

**Plan 16-01: Create ProtectedRoute Component**
1. Create `src/components/ProtectedRoute.tsx`
2. Create `src/pages/Unauthorized.tsx`
3. Add both to App.tsx imports
4. Test in isolation with `/dashboard` route

**Plan 16-02: Wrap All Routes**
1. Public routes (4) — no changes
2. Employee routes (4) — wrap with `<ProtectedRoute>`
3. Owner routes (26) — wrap with `<ProtectedRoute allowedRoles={['owner', 'promoter']}>`
4. Dev routes (1) — wrap with `<ProtectedRoute requireDev allowedRoles={['owner']}>`
5. Catch-all route — no changes

**Testing between plans:**
- After 16-01: Verify `/dashboard` redirects work
- After 16-02: Full smoke test of all route types

### 8.2 Backward Compatibility

**Breaking changes:**
- **None for authenticated users** (existing flows unchanged)
- **Breaks:** Direct URL access for unauthenticated users (intentional)

**Session preservation:**
- Existing Supabase sessions remain valid
- Logged-in users experience no disruption

### 8.3 Rollback Strategy

**If ProtectedRoute causes issues:**
1. Remove `<ProtectedRoute>` wrappers from App.tsx
2. Revert to unprotected routes
3. System returns to Phase 15 state

**Git strategy:**
- Commit Plan 16-01 separately from 16-02
- Allows reverting route wrapping without losing component

---

## 9. Open Questions for Planning

### 9.1 Post-Login Redirect Behavior

**Question:** Should login pages redirect to attempted URL or role-default route?

**Option A (preserve attempted URL):**
- User visits `/analytics` → redirected to `/auth/owner` → logs in → lands on `/analytics`
- **Requires:** Modifying OwnerLogin.tsx and EmployeeLogin.tsx to use `location.state?.from`

**Option B (role-based default):**
- User visits `/analytics` → redirected to `/auth/owner` → logs in → lands on `/dashboard`
- **Current behavior** in Phase 15 login pages (lines 74-80 OwnerLogin.tsx)

**Recommendation:** Implement Option A in Plan 16-01 (update login pages to respect `state.from`). Better UX.

### 9.2 Promoter Role Treatment

**Question:** Should promoter be treated as owner-equivalent or restricted?

**Current state:**
- `hasPermission()` gives promoter: `['view_analytics', 'view_events', 'view_orders']`
- OwnerPortalLayout hides entire sections for non-owners (lines 60-84)
- **No promoter accounts exist** in Supabase (only owner + employee)

**Recommendation:** Treat promoter as owner-equivalent in ProtectedRoute (`allowedRoles={['owner', 'promoter']}`). Sidebar already handles fine-grained hiding. Can tighten later if promoter accounts are created.

### 9.3 Dev-Only QR Generator Access

**Question:** Should `/test-qr` require owner role or any authenticated user in dev mode?

**Current context:**
- QR generator creates signed tickets (security-sensitive)
- Only needed for testing, not production ops
- Employee role shouldn't generate test tickets

**Recommendation:** `<ProtectedRoute requireDev allowedRoles={['owner']}>` — restrict to owner even in dev mode.

### 9.4 Unauthorized Page Design

**Question:** Should 403 page match marketing site branding or scanner site branding?

**Context:**
- NotFound.tsx uses generic gray background
- Scanner site has dark theme with green accents
- Owner dashboard has light theme

**Recommendation:** Match scanner site branding (dark + green). File lives in maguey-gate-scanner, most 403s will be employees accessing owner routes.

---

## 10. Key Files & Line References

| File | Purpose | Key Lines |
|------|---------|-----------|
| `App.tsx` | Route definitions | 55-95 (all unprotected routes) |
| `AuthContext.tsx` | Auth state provider | 7-12 (interface), 38-85 (refreshRole), 87-159 (initialization) |
| `auth.ts` | Role management | 5 (UserRole type), 15-35 (getUserRole), 79-95 (hasPermission) |
| `auth-utils.ts` | Auth helpers | 7-12 (AUTH_ROUTES), 19-30 (navigateByRole) |
| `OwnerLogin.tsx` | Owner login page | 46-52 (redirect), 73-80 (post-login navigation) |
| `EmployeeLogin.tsx` | Employee login page | 26-35 (redirect), 72-80 (post-login navigation) |
| `NotFound.tsx` | 404 error page | 1-25 (full file — template for Unauthorized page) |
| `OwnerPortalLayout.tsx` | Sidebar navigation | 60-84 (role-based section filtering) |
| `maguey-pass-lounge/ProtectedRoute.tsx` | Reference implementation | 14-32 (full component logic) |

**New files to create:**
- `maguey-gate-scanner/src/components/ProtectedRoute.tsx`
- `maguey-gate-scanner/src/pages/Unauthorized.tsx`

---

## 11. Resources & References

### Industry Best Practices
- [LogRocket: Authentication with React Router v6](https://blog.logrocket.com/authentication-react-router-v6/) — Comprehensive guide to protected routes
- [ui.dev: Protected Routes and Authentication](https://ui.dev/react-router-protected-routes-authentication) — Navigate component best practices
- [Adarsha Acharya: Role Based Authorization](https://www.adarsha.dev/blog/role-based-auth-with-react-router-v6) — Role-based guard implementation
- [Medium: React Router V6 — Simplified Protected Routes](https://medium.com/@shirisha95/react-router-v6-simplified-protected-routes-85b209326a55) — Loading state handling
- [CoreUI: How to protect routes in React Router](https://coreui.io/answers/how-to-protect-routes-in-react-router/) — Security considerations

### Internal Documentation
- `CLAUDE.md` — Project overview, credentials, architecture
- `.planning/milestones/v2.0-REQUIREMENTS.md` — R06 requirement definition
- `.planning/phases/14-auth-foundation/14-CONTEXT.md` — Auth infrastructure setup
- `.planning/phases/15-auth-hardening/15-CONTEXT.md` — Login flow decisions
- `Maguey-GSD-Framework.xlsx` — GSD-6 issue tracker entry

---

## 12. Summary & Recommendations

### What We Know
1. **Auth infrastructure ready:** Phases 14 & 15 provide `useAuth()`, `UserRole`, and login pages
2. **40 routes in App.tsx:** 4 public, 4 employee, 26 owner, 1 dev, 1 catch-all
3. **Pattern exists:** maguey-pass-lounge has working ProtectedRoute (authentication-only)
4. **React Router v6 standard:** Wrapper components around route elements

### What to Build
1. **ProtectedRoute component** with:
   - Loading state spinner
   - Auth check → redirect to `/auth`
   - Role check → show 403 Unauthorized page
   - DEV mode check for `/test-qr`
2. **Unauthorized page** (403 error with role-based action buttons)
3. **Route wrapping** in App.tsx (30+ route updates)
4. **Post-login redirect** enhancement in OwnerLogin.tsx and EmployeeLogin.tsx

### Critical Design Decisions
1. **allowedRoles prop:** Optional array — omit for "any authenticated user", specify for role restriction
2. **requireDev prop:** Boolean flag for dev-only routes
3. **Redirect target:** Single `/auth` for all (Index.tsx auto-routes to /auth/employee)
4. **Unauthorized behavior:** Show 403 page (not redirect) for role mismatches
5. **Promoter role:** Treat as owner-equivalent in route guards

### Risk Mitigation
- **Session expiry:** Already handled by AuthContext listener
- **localStorage leakage:** Already gated in Phase 14
- **Server-side security:** RLS policies enforce data access (route protection is UX layer)
- **Testing:** Manual smoke test checklist (automated tests deferred to Phase 22)

### Effort Estimate Validation
- **Phase estimate:** 1.5 days
- **Plan 16-01:** 4 hours (ProtectedRoute component + Unauthorized page + initial testing)
- **Plan 16-02:** 8 hours (30+ route updates + smoke testing + post-login redirect enhancement)
- **Total:** 12 hours ≈ 1.5 days ✅

---

## Conclusion

Phase 16 is well-scoped and has clear implementation path. The auth foundation from Phases 14 & 15 provides all necessary hooks and types. The main work is creating the ProtectedRoute wrapper and methodically applying it to 30+ routes. The pattern is proven (exists in maguey-pass-lounge), we just need to add role-based logic.

**Blocker status:** This is the final P0 auth blocker. After Phase 16, the scanner site will have:
- ✅ Real Supabase accounts (Phase 14)
- ✅ Separate login flows (Phase 15)
- ✅ Route-level protection (Phase 16)

**Ready to plan:** All research questions answered, technical approach validated, dependencies verified.

---

**Sources:**
- [LogRocket: Authentication with React Router v6](https://blog.logrocket.com/authentication-react-router-v6/)
- [ui.dev: Protected Routes and Authentication](https://ui.dev/react-router-protected-routes-authentication)
- [Adarsha Acharya: Role Based Authorization with React Router v6](https://www.adarsha.dev/blog/role-based-auth-with-react-router-v6)
- [Medium: React Router V6 — Simplified Protected Routes](https://medium.com/@shirisha95/react-router-v6-simplified-protected-routes-85b209326a55)
- [CoreUI: How to protect routes in React Router](https://coreui.io/answers/how-to-protect-routes-in-react-router/)
