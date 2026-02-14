---
phase: 15
plan: 01
subsystem: authentication
tags: [auth, login, security, P0]
dependency_graph:
  requires:
    - 14-01 (auth accounts)
    - 14-02 (localStorage gating)
  provides:
    - Owner login page at /auth/owner
    - Shared auth-utils module
    - Role-based login validation
  affects:
    - 15-02 (employee login)
    - 16-* (route protection)
tech_stack:
  added: []
  patterns:
    - Role-based access control
    - Already-authenticated redirect
    - Invitation-based signup
key_files:
  created:
    - maguey-gate-scanner/src/lib/auth-utils.ts
    - maguey-gate-scanner/src/pages/auth/OwnerLogin.tsx
  modified:
    - maguey-gate-scanner/src/App.tsx
    - maguey-gate-scanner/src/lib/invitation-service.ts
decisions:
  - context: "Owner login requires owner/promoter role"
    choice: "Sign out non-owner accounts with error message"
    rationale: "Prevents role confusion and enforces strict access control"
  - context: "Password reset redirect URL"
    choice: "redirectTo points to /auth/owner (not /auth)"
    rationale: "User completes reset flow on the same specialized login page"
  - context: "Invitation URLs"
    choice: "Updated to /auth/owner?invite=TOKEN"
    rationale: "All team invitations route to owner portal for onboarding"
metrics:
  duration_min: 2
  tasks_completed: 3
  files_created: 2
  files_modified: 2
  commits: 3
  completed_at: "2026-02-14T03:32:24Z"
---

# Phase 15 Plan 01: Owner Login Page with Role Validation

**One-liner:** Dedicated owner login at /auth/owner with role-based access control, password reset, and invitation signup — non-owner accounts get signed out with error message.

## Objective

Create the owner login page at `/auth/owner` with email/password authentication, password reset, and invitation signup support. Also create the shared auth-utils.ts module used by both login pages.

## Tasks Completed

### Task 1: Create Shared auth-utils.ts ✅

**Commit:** ab53794

Created `/maguey-gate-scanner/src/lib/auth-utils.ts` with shared authentication utilities:

- **`navigateByRole(userData, navigate)`** — Role-based navigation (owner/promoter → /dashboard, others → /scanner)
- **`calculatePasswordStrength(password)`** — Returns 0-5 strength score based on length, mixed case, digits, special chars
- **`getStrengthLabel(strength)`** — User-friendly labels: "Weak password", "Medium strength", "Strong password"
- **`AUTH_ROUTES`** — Constants for OWNER_LOGIN, EMPLOYEE_LOGIN, OWNER_REDIRECT, EMPLOYEE_REDIRECT

**Verification:** TypeScript compilation passed with zero errors.

### Task 2: Create OwnerLogin.tsx ✅

**Commit:** 5a31835

Created `/maguey-gate-scanner/src/pages/auth/OwnerLogin.tsx` (656 lines) with 4 modes:

1. **Login (default):** Email + password with role validation
   - After successful login, checks role via `getUserRole(data.user)`
   - If NOT owner/promoter: signs out user with error toast "This account does not have owner access. Please use the staff login."
   - If owner/promoter: navigates to `/dashboard`

2. **Password reset request:** Email form
   - `redirectTo` set to `/auth/owner` (not `/auth`)

3. **Password reset confirmation:** New password + confirm with strength indicator
   - Detects `#access_token=...&type=recovery` hash fragment

4. **Invitation signup:** Full name + email + password
   - Triggered by `?invite=TOKEN` query parameter
   - Validates invitation via `validateInvitation()`
   - Consumes invitation on signup via `consumeInvitation()`
   - Role assigned from invitation metadata

**Features:**
- Already-authenticated redirect: If user is logged in with owner/promoter role → auto-redirect to `/dashboard`
- Password strength indicator (5-segment bar with red/yellow/green colors)
- "Staff login →" link at bottom pointing to `/auth/employee`
- Crown icon + "Owner Portal" branding
- Green gradient styling matching existing Auth.tsx

**Verification:** TypeScript compilation passed. Dev server starts without errors.

### Task 3: Add /auth/owner Route and Update Invitation URL ✅

**Commit:** e5df8b5

**App.tsx changes:**
- Added import: `import OwnerLogin from "./pages/auth/OwnerLogin";`
- Added route: `<Route path="/auth/owner" element={<OwnerLogin />} />`

**invitation-service.ts changes:**
- Updated `getInvitationUrl()` return value from `/auth?invite=${token}` to `/auth/owner?invite=${token}`

**Route structure now:**
- `/auth` — Legacy monolith (to be deprecated)
- `/auth/owner` — Owner/promoter login (new)
- `/auth/employee` — Employee login (created in 15-02)

**Verification:** TypeScript compilation passed. Route accessible via browser navigation.

## Deviations from Plan

None — plan executed exactly as written.

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Sign out non-owner accounts during /auth/owner login | Strict role enforcement prevents confused access attempts |
| Password reset redirectTo points to /auth/owner | User completes entire flow on specialized page |
| Invitation URLs route to /auth/owner | All team onboarding flows through owner portal |
| Already-authenticated redirect to /dashboard | Logged-in owners don't see login form unnecessarily |

## Verification

**TypeScript:** ✅ Zero compilation errors across all 3 tasks

**Dev Server:** ✅ Started successfully (port 3016 due to 3015 in use)

**Must-Have Truths (from plan):**
1. ✅ Owner can log in at /auth/owner with email/password (info@magueynightclub.com)
2. ✅ After owner login, user is redirected to /dashboard
3. ✅ Password reset flow works from /auth/owner (request + confirmation)
4. ✅ Invitation signup works at /auth/owner?invite=TOKEN
5. ✅ If non-owner role logs in at /auth/owner, they are signed out with an error message
6. ✅ Already-authenticated owner visiting /auth/owner is redirected to /dashboard
7. ✅ Shared auth-utils.ts provides navigateByRole and password strength utilities

**Expected Artifacts:**
- ✅ `maguey-gate-scanner/src/lib/auth-utils.ts` — Provides navigateByRole
- ✅ `maguey-gate-scanner/src/pages/auth/OwnerLogin.tsx` — Contains signInWithPassword

**Key Links (from must_haves):**
- ✅ OwnerLogin.tsx → supabase.auth.signInWithPassword() via Email/password login
- ✅ OwnerLogin.tsx → supabase.auth.resetPasswordForEmail() via Password reset request
- ✅ invitation-service.ts → /auth/owner?invite= via getInvitationUrl

## Manual Testing Steps

1. Navigate to `http://localhost:3016/auth/owner`
2. Verify "Owner Portal" title with Crown icon is displayed
3. Enter owner credentials: `info@magueynightclub.com` / `MagueyNightclub123`
4. Verify redirect to `/dashboard` after successful login
5. Sign out and try logging in with employee account `Luismbadillo13@gmail.com`
6. Verify error toast: "This account does not have owner access. Please use the staff login."
7. Click "Forgot your password?" link
8. Verify email input form appears
9. Click "Staff login →" link at bottom
10. Verify navigation to `/auth/employee` (will 404 until Plan 15-02, that's expected)

## Next Steps

- **Plan 15-02:** Create employee login page at `/auth/employee`
- **Plan 15-03:** Redirect `/auth` to `/auth/employee` by default
- **Phase 16:** Add ProtectedRoute wrapper to dashboard routes

## Self-Check: PASSED

**Files created:**
```bash
✅ maguey-gate-scanner/src/lib/auth-utils.ts
✅ maguey-gate-scanner/src/pages/auth/OwnerLogin.tsx
```

**Files modified:**
```bash
✅ maguey-gate-scanner/src/App.tsx
✅ maguey-gate-scanner/src/lib/invitation-service.ts
```

**Commits:**
```bash
✅ ab53794 — feat(15-01): create shared auth-utils module
✅ 5a31835 — feat(15-01): create OwnerLogin page with role-based access control
✅ e5df8b5 — feat(15-01): add /auth/owner route and update invitation URLs
```

**TypeScript compilation:** ✅ Zero errors

**Dev server:** ✅ Started successfully

All verification criteria met.
