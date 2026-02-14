---
phase: 14-auth-foundation
plan: 03
subsystem: authentication
tags: [credentials, validation, environment, stripe, resend]
dependency_graph:
  requires: []
  provides: [credential-verification]
  affects: [deployment, ci-cd]
tech_stack:
  added: [dotenv-parse, stripe-api-validation, resend-api-validation]
  patterns: [environment-consistency, api-key-validation, exit-codes]
key_files:
  created:
    - scripts/auth/verify-credentials.ts
  modified: []
decisions:
  - decision: "Handle Resend restricted API keys as valid"
    rationale: "Restricted send-only keys are more secure and should be recognized as valid configuration"
  - decision: "Parse .env files independently without process.env pollution"
    rationale: "Using dotenv.parse() with readFileSync ensures clean comparison without side effects"
  - decision: "Use native fetch API for credential validation"
    rationale: "Node 18+ has built-in fetch, no need for axios or node-fetch dependencies"
  - decision: "Exit code 0 on all pass, 1 on any fail"
    rationale: "Standard Unix exit code convention for CI/CD integration"
metrics:
  duration: "1m 51s"
  tasks_completed: 1
  files_created: 1
  commits: 1
  completed_date: "2026-02-14"
---

# Phase 14 Plan 03: Environment & Credential Verification Summary

**One-liner:** Automated validation script confirms environment consistency across all 3 sites and verifies Stripe/Resend API keys are functional via real API calls

## What Was Built

Created `scripts/auth/verify-credentials.ts` — a comprehensive verification script that validates:

1. **Environment Consistency (R35):**
   - VITE_SUPABASE_URL identical across maguey-gate-scanner, maguey-pass-lounge, and maguey-nights
   - VITE_SUPABASE_ANON_KEY identical across all 3 sites
   - URL format validation (https://*.supabase.co)
   - Anon key not empty or placeholder

2. **Stripe Key Validation (R36):**
   - Format validation (sk_test_/sk_live_ for secret, pk_test_/pk_live_ for publishable)
   - Real API call to Stripe balance endpoint to verify secret key works
   - Warning for production keys in development

3. **Resend Key Validation (R37):**
   - Format validation (re_* prefix)
   - Real API call to Resend API (handles restricted send-only keys)
   - Recognizes restricted keys as valid security configuration

**Output:** Clear PASS/FAIL reporting with color-coded terminal output, exit code 0 for all pass, 1 for any failures.

## Technical Implementation

### Environment Loading Strategy

Used `dotenv.parse(readFileSync(path))` instead of `dotenv.config()` to load each .env file into separate objects without polluting process.env. This ensures clean comparison without side effects.

### API Validation Approach

- **Stripe:** GET /v1/balance with Authorization header (200 = valid key)
- **Resend:** GET /api-keys with Authorization header (200 = full access key, 401 with "restricted_api_key" = valid send-only key)

### Error Handling

Script handles:
- Missing .env files (fail with clear message)
- Missing environment variables (fail specific check)
- API call failures (network errors, invalid keys)
- Restricted API keys (treat as valid with warning)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Resend restricted API key handling**
- **Found during:** Initial script execution
- **Issue:** Script failed on valid restricted Resend API keys (send-only permissions)
- **Fix:** Added 401 status check for "restricted_api_key" message, treat as PASS with warning
- **Files modified:** scripts/auth/verify-credentials.ts
- **Commit:** 3b63f79

## Verification Results

**All verification criteria met:**

1. ✅ `npx tsx scripts/auth/verify-credentials.ts` exits 0, all 9 checks pass
2. ✅ Intentionally corrupted VITE_SUPABASE_URL in maguey-nights — mismatch detected correctly, exit code 1
3. ✅ Summary line shows "9/9 checks passed"

**Current environment status:**
- VITE_SUPABASE_URL: https://djbzjasdrwvbsoifxqzd.supabase.co (consistent)
- VITE_SUPABASE_ANON_KEY: consistent (JWT token matches)
- Stripe secret key: sk_test_* (valid, API call successful)
- Stripe publishable key: pk_test_* (valid format)
- Resend API key: re_* (valid, restricted send-only — recommended)

## Files Created

### scripts/auth/verify-credentials.ts
**Purpose:** Automated validation of environment variables and external service credentials

**Key features:**
- Three validation categories (env consistency, Stripe, Resend)
- Color-coded terminal output ([PASS], [FAIL], [WARN])
- Detailed mismatch reporting (shows differing values)
- Native fetch API for credential validation
- Exit code convention (0 = all pass, 1 = any fail)
- Production key warnings (sk_live_, pk_live_)
- 238 lines with comprehensive error handling

**Usage:**
```bash
npx tsx scripts/auth/verify-credentials.ts
```

## Testing

**Functional testing:**
- ✅ All 9 checks pass in current environment
- ✅ Mismatch detection tested by corrupting VITE_SUPABASE_URL
- ✅ Stripe API call validates real credentials
- ✅ Resend API call handles restricted keys correctly

**Edge cases handled:**
- Missing .env files → fail with clear message
- Missing environment variables → fail specific check
- Network errors during API calls → fail with error details
- Invalid API keys → fail with HTTP status
- Restricted Resend keys → pass with warning

## Success Criteria

✅ Script validates VITE_SUPABASE_URL consistency across all 3 sites
✅ Script validates VITE_SUPABASE_ANON_KEY consistency across all 3 sites
✅ Script validates Stripe test keys via real API call
✅ Script validates Resend API key via real API call
✅ Clear PASS/FAIL output for every check
✅ Exit code 0 when all pass, 1 when any fail

## Next Steps

This verification script should be:
1. **Run before deployment** — Catches environment mismatches before production
2. **Integrated into CI/CD** — Add to GitHub Actions workflow as pre-deploy check
3. **Run after .env changes** — Validates new credentials are functional
4. **Used for onboarding** — New developers can verify their local environment setup

**Recommended CI/CD integration:**
```yaml
- name: Verify Credentials
  run: npx tsx scripts/auth/verify-credentials.ts
```

## Self-Check: PASSED

### Created Files Verification
```bash
[FOUND] scripts/auth/verify-credentials.ts
```

### Commits Verification
```bash
[FOUND] 3b63f79 — feat(14-03): create credential and env verification script
```

### Functional Verification
```bash
[FOUND] Script exits 0 with all checks passing
[FOUND] Mismatch detection works correctly
[FOUND] 9/9 checks passed in current environment
```
