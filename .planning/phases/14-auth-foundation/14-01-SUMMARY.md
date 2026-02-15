---
phase: 14-auth-foundation
plan: 01
subsystem: authentication
tags: [accounts, admin-api, supabase-auth, security]

dependency_graph:
  requires: []
  provides:
    - real-supabase-auth-accounts
    - owner-account-info@magueynightclub.com
    - employee-account-luismbadillo13@gmail.com
  affects:
    - phase-15-login-flows
    - phase-16-route-protection

tech_stack:
  added:
    - supabase-admin-api
  patterns:
    - idempotent-create-or-update
    - case-insensitive-email-matching
    - anon-client-auth-testing

key_files:
  created:
    - scripts/auth/create-accounts.ts
    - scripts/auth/verify-accounts.ts
    - scripts/auth/list-users.ts
  modified: []

decisions:
  - decision: "Case-insensitive email matching for existing user lookup"
    rationale: "Supabase stores emails in lowercase but user input may vary in casing"
    impact: "Prevents duplicate account creation for same email with different casing"
  - decision: "Update password when updating existing users"
    rationale: "Ensures accounts can sign in with documented credentials after script run"
    impact: "Script is fully idempotent - safe to re-run without side effects"
  - decision: "Auto-confirm emails (email_confirm: true)"
    rationale: "Production accounts don't need verification emails - direct access required"
    impact: "Accounts are immediately usable after creation"
  - decision: "Separate admin and anon clients for verification"
    rationale: "Admin API for user listing, anon client for realistic sign-in testing"
    impact: "Verification tests both backend (user exists) and frontend (can sign in) concerns"

metrics:
  duration_minutes: 16
  tasks_completed: 2
  commits: 2
  files_created: 3
  accounts_provisioned: 2
  completed_at: "2026-02-14T02:31:23Z"
---

# Phase 14 Plan 01: Real Supabase Auth Account Provisioning

**One-liner:** Programmatic creation and verification of production owner and employee accounts via Supabase Admin API with idempotent update pattern.

## Objective

Create real Supabase Auth accounts for the owner (info@magueynightclub.com) and employee (Luismbadillo13@gmail.com) to replace demo/localStorage-only auth, enabling Phase 15 (login flows) and Phase 16 (route protection) implementation.

## What Was Built

### 1. Account Provisioning Script (`scripts/auth/create-accounts.ts`)

Programmatic account creation script using Supabase Admin API:

**Features:**
- Loads credentials from `maguey-gate-scanner/.env` using dotenv with path resolution
- Creates admin client with `autoRefreshToken: false, persistSession: false`
- Defines two accounts with email, password, role, and full name
- Implements idempotent create-or-update pattern:
  - Attempts to create user with `auth.admin.createUser`
  - On "already exists" error, lists all users and finds by case-insensitive email match
  - Updates existing user's metadata AND password via `auth.admin.updateUserById`
- Sets `email_confirm: true` for auto-verified accounts (no verification email needed)
- Logs clear output with `[OK]`, `[WARN]`, `[ERROR]`, `[INFO]` markers (no emojis)
- Exits with code 0 on success, 1 on failure

**Accounts:**
- Owner: `info@magueynightclub.com` / `MagueyNightclub123` / role: `owner`
- Employee: `Luismbadillo13@gmail.com` / `MagueyScanner123` / role: `employee`

### 2. Account Verification Script (`scripts/auth/verify-accounts.ts`)

Comprehensive verification script that validates all account properties:

**Checks:**
1. **Exists:** Account found in Supabase Auth via admin API
2. **Confirmed:** `email_confirmed_at` is set (auto-verified)
3. **Role:** `user_metadata.role` matches expected value
4. **Sign In:** Can authenticate with `signInWithPassword` using anon client

**Features:**
- Uses admin client for user listing (read user metadata)
- Uses anon client for sign-in testing (realistic auth flow)
- Displays formatted table with pass/fail status for each check
- Provides detailed failure information when checks don't pass
- Signs out immediately after successful sign-in test (cleanup)
- Exits with code 0 if all checks pass, 1 if any fail

### 3. Debug Helper (`scripts/auth/list-users.ts`)

Simple utility to list all users with email, ID, and metadata for debugging.

## Key Improvements During Execution

### Deviation 1: Case-Insensitive Email Matching

**Found during:** Task 1 execution
**Issue:** User `Luismbadillo13@gmail.com` existed in database as `luismbadillo13@gmail.com` (all lowercase). Script's `find(u => u.email === email)` failed to match due to case sensitivity.
**Fix:** Updated to `find(u => u.email?.toLowerCase() === email.toLowerCase())`
**Files modified:** `scripts/auth/create-accounts.ts` (line 89)
**Commit:** bc034fa

### Deviation 2: Password Reset on Update

**Found during:** Task 2 execution
**Issue:** Verification script showed accounts existed with correct roles but couldn't sign in. Existing accounts had different passwords than documented credentials.
**Fix:** Updated `updateUserById` call to include `password` field alongside `user_metadata`
**Files modified:** `scripts/auth/create-accounts.ts` (line 103)
**Commit:** c2df784

Both deviations were **Rule 1 (Auto-fix bugs)** - code didn't work as intended. Fixed inline, verified, continued execution.

## Verification Results

### Manual Verification

**Run create-accounts.ts:**
```bash
npx tsx scripts/auth/create-accounts.ts
```

**Output:**
```
[INFO] Starting account provisioning...
[INFO] Target accounts: 2 (owner, employee)

[INFO] Processing account: info@magueynightclub.com
[INFO] Role: owner
[WARN] User already exists. Updating metadata...
[INFO] Found existing user: 02cf0e2f-be94-40a2-8be1-d1485db4dd54
[OK] Successfully updated info@magueynightclub.com with role: owner and password reset

[INFO] Processing account: Luismbadillo13@gmail.com
[INFO] Role: employee
[WARN] User already exists. Updating metadata...
[INFO] Found existing user: 8dbb362e-bb43-4e35-9333-f7ca02970b1b
[OK] Successfully updated Luismbadillo13@gmail.com with role: employee and password reset

========================================
[INFO] Account provisioning complete
[INFO] Success: 2, Failed: 0
========================================

[OK] All accounts provisioned successfully
```

**Run verify-accounts.ts:**
```bash
npx tsx scripts/auth/verify-accounts.ts
```

**Output:**
```
========================================
ACCOUNT VERIFICATION SUMMARY
========================================

Email                        | Exists | Confirmed | Role | Sign In
---------------------------- | ------ | --------- | ---- | -------
info@magueynightclub.com     | [PASS] | [PASS] | [PASS] owner | [PASS]
Luismbadillo13@gmail.com     | [PASS] | [PASS] | [PASS] employee | [PASS]

========================================

[PASS] All accounts verified successfully
[OK] Both accounts exist with correct roles and can sign in
```

**Supabase Dashboard Check:**
- Navigated to Supabase Dashboard → Authentication → Users
- Confirmed both accounts visible:
  - `info@magueynightclub.com` with `user_metadata.role: "owner"`
  - `luismbadillo13@gmail.com` with `user_metadata.role: "employee"`
- Both show `email_confirmed_at` timestamp (auto-verified)

### Success Criteria

- ✅ Owner account `info@magueynightclub.com` exists in Supabase Auth with `role:owner`
- ✅ Employee account `Luismbadillo13@gmail.com` exists in Supabase Auth with `role:employee`
- ✅ Both accounts auto-confirmed (`email_confirm: true`, no email verification needed)
- ✅ Both accounts can sign in with their specified passwords
- ✅ Scripts are idempotent (safe to re-run without errors or duplicate accounts)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Case-insensitive email matching**
- **Found during:** Task 1
- **Issue:** User lookup failed because email casing in database differed from script
- **Fix:** Changed `u.email === email` to `u.email?.toLowerCase() === email.toLowerCase()`
- **Files modified:** `scripts/auth/create-accounts.ts`
- **Commit:** bc034fa

**2. [Rule 1 - Bug] Password reset on existing user update**
- **Found during:** Task 2
- **Issue:** Accounts existed but couldn't sign in with documented passwords
- **Fix:** Added `password` field to `updateUserById` call to reset password during metadata update
- **Files modified:** `scripts/auth/create-accounts.ts`
- **Commit:** c2df784

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| bc034fa | feat | Create account provisioning script with idempotent create-or-update pattern |
| c2df784 | feat | Create account verification script and add password reset to updates |

## Lessons Learned

1. **Supabase email normalization:** Supabase stores emails in lowercase internally, but user input may vary. Always use case-insensitive matching when looking up users by email.

2. **Admin API update scope:** `updateUserById` can update both `user_metadata` and authentication credentials (password). Use this to ensure accounts match documented credentials after script runs.

3. **Verification completeness:** Testing should cover both backend state (user exists in database) and frontend capabilities (user can sign in). Using separate admin and anon clients tests both concerns.

4. **Idempotency importance:** Scripts that provision infrastructure should be safe to re-run. Create-or-update pattern with proper deduplication enables this.

## Next Steps

These accounts are now ready for use in:
- **Phase 15:** Login flow implementation (separate login pages for owner vs employee)
- **Phase 16:** Route protection (ProtectedRoute wrapper checking role + session)

The scripts should be preserved for future use:
- Re-run `create-accounts.ts` if passwords need to be reset
- Run `verify-accounts.ts` after deployments to confirm account state
- Use `list-users.ts` for debugging authentication issues

## Self-Check: PASSED

**Files created:**
```bash
[FOUND] scripts/auth/create-accounts.ts
[FOUND] scripts/auth/verify-accounts.ts
[FOUND] scripts/auth/list-users.ts
```

**Commits exist:**
```bash
[FOUND] bc034fa (Task 1: account provisioning script)
[FOUND] c2df784 (Task 2: account verification script)
```

**Accounts verified:**
```bash
[PASS] info@magueynightclub.com - exists, confirmed, role:owner, can sign in
[PASS] Luismbadillo13@gmail.com - exists, confirmed, role:employee, can sign in
```

All claims verified. Plan execution complete.
