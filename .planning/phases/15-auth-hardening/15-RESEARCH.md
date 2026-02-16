# Phase 15: Auth Hardening & Login Flows — Research

**Phase:** 15
**Created:** 2026-02-13
**Status:** RESEARCH COMPLETE

---

## Current Auth State (Post-Phase 14)

### Auth.tsx (1,110 lines) — Single Unified Login Page
- **Location:** `maguey-gate-scanner/src/pages/Auth.tsx`
- Single `/auth` route handles: login, signup, password reset, invitation, demo access
- `handleAuth()` (lines 214-349): Login via `supabase.auth.signInWithPassword()`, signup via `supabase.auth.signUp()`
- `handleDemoLogin()` (lines 351-577): Tries 3 hardcoded demo credentials, creates demo accounts, uses localStorage
- Quick Access buttons (lines 656-816): "Employee" and "Owner" buttons — **NOT gated behind DEV**
- "Demo Login" button (lines 1071-1086): Visible to all users
- "Promote to Owner" (lines 1088-1103): Any employee can self-promote — **no authorization check**
- `navigateByRole()` (lines 44-56): owner/promoter → `/dashboard`, employee → `/scanner`
- Password reset: request (lines 122-155), confirmation (lines 157-212), hash fragment detection (lines 106-120)
- Invitation: validation (lines 76-104), role assignment (lines 282-286), consumption (lines 288-291)
- Password strength calculator (lines 58-73): 5-level visual indicator
- Uses shadcn/ui: Card, Input, Button, Label, Alert + Lucide icons

### App.tsx (124 lines) — Route Configuration
- **Location:** `maguey-gate-scanner/src/App.tsx`
- React Router v6 with `<BrowserRouter>`
- Single auth route: `<Route path="/auth" element={<Auth />} />` (line 55)
- No nested auth routes exist
- No route guards or protection (that's Phase 16)

### auth.ts (118 lines) — Role Management
- **Location:** `maguey-gate-scanner/src/lib/auth.ts`
- Types: `UserRole = 'owner' | 'promoter' | 'employee'`
- `getUserRole(user)`: reads from user_metadata → app_metadata → default 'employee'
- `setUserRole(role)`: Supabase `updateUser()`, DEV-gated localStorage fallback (Phase 14)
- `hasPermission(role, perm)`: owner=all, promoter=view, employee=none
- `getCurrentUserRole()`: gets role from session, DEV-gated localStorage fallback

### AuthContext.tsx (167 lines) — Session Provider
- **Location:** `maguey-gate-scanner/src/contexts/AuthContext.tsx`
- Exports: `useAuth()` → { user, role, loading, refreshRole }, `useRole()` → role
- All 4 localStorage fallbacks DEV-gated (Phase 14 work)
- Supabase `onAuthStateChange` subscription for real-time auth updates

### Index.tsx (76 lines) — Landing Page
- **Location:** `maguey-gate-scanner/src/pages/Index.tsx`
- Two buttons: "Owner Login" → `/auth?role=owner`, "Staff Login" → `/auth?role=staff`
- Auto-redirect to `/auth` after 2 seconds
- Maguey logo + green gradient styling

### Sign-Out Targets (navigate to /auth)
- `OwnerPortalLayout.tsx:111` — owner sign-out
- `EmployeePortalLayout.tsx:65` — employee sign-out
- `Navigation.tsx:61` — general navigation sign-out
- `Scanner.tsx:721` — scanner sign-out
- `OwnerDashboard.tsx:194,206,213,217` — auth checks
- `Dashboard.tsx:233,238,246,250` — auth checks
- Multiple other pages (NotificationRules, NotificationAnalytics, CrewSettings, etc.)

### invitation-service.ts — Invitation URL
- `getInvitationUrl()` at line 300-302: returns `${baseUrl}/auth?invite=${token}`
- Used in `TeamManagement.tsx` when generating invite links

---

## Implementation Decisions

### 1. Split Auth.tsx vs Route-Based Mode Switching
**Decision: Split into separate page components**
- Auth.tsx is 1,110 lines — adding mode-switching makes it worse
- Owner and employee have fundamentally different UIs
- ~450 lines of demo code will be removed, making remaining logic small enough for lean components
- Shared utilities extract cleanly into `auth-utils.ts`

### 2. Employee "Simplified Auth" Approach
**Decision: Email/password with minimal UI (NOT PIN-based)**
- PIN auth requires custom backend (mapping PINs to users) — not built
- Supabase Auth doesn't natively support PIN login
- "Simplified" = reduced UI, not a different auth mechanism
- Employee logs in once per shift, not repeatedly
- Pre-filled email via "remember me" localStorage (just email, not password)

### 3. Backward Compatibility
**Decision: Auth.tsx becomes a redirect component**
- Existing bookmarks to `/auth` still work
- Password reset emails pointing to `/auth?token=X` still work via redirect
- Invitation URLs at `/auth?invite=TOKEN` redirect to `/auth/owner`

### 4. Password Reset / Invitation Routing
**Decision: Owner-only**
- Password reset form lives on `/auth/owner` only
- Invitation signup routes to `/auth/owner` (team members join owner portal)
- Employee login shows "Need help? Contact your manager" instead

---

## Files to Create

| File | Lines (est.) | Purpose |
|------|-------------|---------|
| `maguey-gate-scanner/src/lib/auth-utils.ts` | ~80 | Shared: navigateByRole, password strength, redirect constants |
| `maguey-gate-scanner/src/pages/auth/OwnerLogin.tsx` | ~250 | Owner login + password reset + invitation |
| `maguey-gate-scanner/src/pages/auth/EmployeeLogin.tsx` | ~150 | Streamlined employee login |

## Files to Modify

| File | Change |
|------|--------|
| `maguey-gate-scanner/src/pages/Auth.tsx` | Replace 1,110 lines with ~35-line redirect component |
| `maguey-gate-scanner/src/App.tsx` | Add `/auth/owner` and `/auth/employee` routes |
| `maguey-gate-scanner/src/pages/Index.tsx` | Update button targets to new routes |
| `maguey-gate-scanner/src/lib/invitation-service.ts` | Change invitation URL to `/auth/owner?invite=` |
| `maguey-gate-scanner/src/components/layout/OwnerPortalLayout.tsx` | Sign-out → `/auth/owner`, DEV-gate localStorage |
| `maguey-gate-scanner/src/components/layout/EmployeePortalLayout.tsx` | Sign-out → `/auth/employee`, DEV-gate localStorage |
| `maguey-gate-scanner/src/components/Navigation.tsx` | DEV-gate localStorage in sign-out |
| `maguey-gate-scanner/src/pages/Scanner.tsx` | Sign-out → `/auth/employee` |

---

## Risks & Mitigations

1. **Hash fragment handling for password reset**: Supabase uses URL hash (`#access_token=...&type=recovery`). The redirect component must detect these and forward to `/auth/owner`.
2. **Existing password reset emails**: Already-sent emails link to `/auth?...`. The redirect handles this.
3. **Role validation on wrong page**: An employee logging in at `/auth/owner` should get an error. An owner at `/auth/employee` should redirect to `/dashboard`.
