---
phase: 17-security-lockdown
verified: 2026-02-14T11:30:00Z
status: passed
score: 10/10 must-haves verified
re_verification: false
---

# Phase 17: Security Lockdown Verification Report

**Phase Goal:** Close P0 security blockers — move QR signing secret server-side, centralize CORS with ALLOWED_ORIGINS, remove anonymous VIP RLS access, reject unsigned QR codes.

**Verified:** 2026-02-14T11:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | verify-qr-signature Edge Function exists and reads QR_SIGNING_SECRET from Deno.env.get() | ✓ VERIFIED | Function exists at maguey-pass-lounge/supabase/functions/verify-qr-signature/index.ts, line 71 reads from Deno.env.get("QR_SIGNING_SECRET") |
| 2 | simple-scanner.ts calls Edge Function for verification, no VITE_QR_SIGNING_SECRET reference | ✓ VERIFIED | Line 84 fetches verify-qr-signature endpoint; grep confirms zero VITE_QR_SIGNING_SECRET matches in file |
| 3 | All Edge Functions use _shared/cors.ts (no hardcoded Access-Control-Allow-Origin: "*") | ✓ VERIFIED | 15/15 Edge Functions import _shared/cors.ts; zero hardcoded wildcard CORS found |
| 4 | vip_reservations and vip_guest_passes SELECT policies exclude auth.role() = 'anon' | ✓ VERIFIED | Migration 20260213000000 removes anon access; only service_role and authenticated allowed |
| 5 | get_vip_pass_by_token SECURITY DEFINER RPC exists | ✓ VERIFIED | RPC created in migration lines 41-98 with SECURITY DEFINER and SET search_path = public |
| 6 | VIPPassView.tsx uses RPC instead of direct table query | ✓ VERIFIED | Line 61 calls .rpc('get_vip_pass_by_token', { p_qr_token: token }); no from('vip_guest_passes') found |
| 7 | Unsigned QR codes rejected in parseQrInput and scanTicket | ✓ VERIFIED | Line 123 rejects unsigned with error; line 288 enforces signature for QR/NFC (manual bypassed) |
| 8 | Manual entry still works (method !== 'manual' check) | ✓ VERIFIED | Line 288 condition allows manual entry to bypass signature requirement |
| 9 | Offline signature verification uses cached values | ✓ VERIFIED | Lines 617-618 call verifySignatureOffline() from offline-ticket-cache.ts |
| 10 | All error paths fail closed (return false, not true) | ✓ VERIFIED | All signature verification errors return false; no fail-open paths found |

**Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| maguey-pass-lounge/supabase/functions/verify-qr-signature/index.ts | Server-side QR verification endpoint | ✓ VERIFIED | 122 lines, HMAC-SHA256 verification, constant-time comparison, shared CORS |
| maguey-pass-lounge/supabase/functions/_shared/cors.ts | Shared CORS handler with optional extra headers | ✓ VERIFIED | extraAllowedHeaders parameter added, supports ALLOWED_ORIGINS env var |
| maguey-pass-lounge/supabase/migrations/20260213000000_tighten_vip_rls_policies.sql | VIP RLS tightening + RPC | ✓ VERIFIED | Removes anon access, creates get_vip_pass_by_token RPC |
| maguey-gate-scanner/src/lib/simple-scanner.ts | Scanner with unsigned QR rejection | ✓ VERIFIED | Server-side verification calls, unsigned rejection, offline signature verification |
| maguey-gate-scanner/src/lib/offline-ticket-cache.ts | Offline cache with signature population | ✓ VERIFIED | qr_signature in SELECT query (line 146), verifySignatureOffline export (line 567) |
| maguey-pass-lounge/src/pages/VIPPassView.tsx | VIP pass view using RPC | ✓ VERIFIED | Uses RPC for lookup, no direct table query |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| simple-scanner.ts | verify-qr-signature Edge Function | HTTP POST to /functions/v1/verify-qr-signature | ✓ WIRED | Line 84 fetch call with token and signature |
| verify-qr-signature Edge Function | _shared/cors.ts | import getCorsHeaders, handleCorsPreFlight | ✓ WIRED | Line 2 import statement |
| simple-scanner.ts | offline-ticket-cache.ts | verifySignatureOffline for offline validation | ✓ WIRED | Line 617 dynamic import and call |
| VIPPassView.tsx | get_vip_pass_by_token RPC | supabase.rpc() call | ✓ WIRED | Line 61 RPC invocation |
| All Edge Functions | _shared/cors.ts | Shared CORS handler | ✓ WIRED | 15/15 functions import shared handler |

### Requirements Coverage

Phase 17 addresses 4 P0 security blockers from v2.0 ROADMAP:

| Requirement | Status | Details |
|-------------|--------|---------|
| R01: Move QR signing secret server-only | ✓ SATISFIED | verify-qr-signature Edge Function reads from Deno.env, no client-side secret |
| R03: Set ALLOWED_ORIGINS for webhooks | ✓ SATISFIED | All Edge Functions use shared CORS handler with ALLOWED_ORIGINS support |
| R05: Remove anonymous VIP RLS access | ✓ SATISFIED | Migration removes anon from policies, RPC provides controlled access |
| R23: Reject unsigned QR codes | ✓ SATISFIED | Scanner rejects unsigned QR for QR/NFC methods, manual entry preserved |

### Anti-Patterns Found

Scanned 6 key files for anti-patterns:

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | - | - | - | - |

**No blocker anti-patterns detected.** All implementations follow security best practices:
- Fail-closed error handling throughout
- Constant-time signature comparison
- No secret exposure in logs or responses
- Server-side secret storage
- Token-based RPC access (no table scans)

### Human Verification Required

The following items need manual testing after deployment:

#### 1. QR Signature Verification E2E Test

**Test:** 
1. Generate a signed QR code via Stripe webhook
2. Scan at the scanner page with QR camera
3. Attempt to scan an unsigned QR code (plain UUID)
4. Attempt manual entry with the same UUID

**Expected:** 
- Signed QR → Success overlay, ticket marked as scanned
- Unsigned QR via camera → Red rejection overlay with "QR code is not signed"
- Manual entry → Proceeds to ticket lookup (signature bypassed)

**Why human:** Camera QR scanning and full-screen overlay behavior requires real device testing

#### 2. CORS Production Restriction Test

**Test:**
1. Set ALLOWED_ORIGINS in Supabase Dashboard to production domains
2. From browser console on evil.com, attempt fetch to any Edge Function
3. From production domain (tickets.magueynightclub.com), call same endpoint

**Expected:**
- evil.com → CORS error, browser blocks request
- tickets.magueynightclub.com → Success, origin header matches request

**Why human:** Requires production Supabase environment with ALLOWED_ORIGINS configured

#### 3. VIP Pass View RPC Access Test

**Test:**
1. As anonymous user, attempt direct query: `supabase.from('vip_reservations').select('*')`
2. Navigate to /vip-pass/{valid-token} on purchase site
3. Navigate to /vip-pass/invalid-token

**Expected:**
- Direct query → Empty array (RLS blocks)
- Valid token → Pass details displayed via RPC
- Invalid token → "Pass not found" error

**Why human:** Requires valid VIP reservation token from production/staging database

#### 4. Offline Signature Verification Test

**Test:**
1. Sync tickets with signatures to offline cache
2. Disconnect from internet
3. Scan a valid signed QR code
4. Scan a QR code with mismatched signature

**Expected:**
- Valid signature → Offline validation succeeds, cached data used
- Mismatched signature → Rejection with "QR code signature is invalid (offline verification)"

**Why human:** Requires device with network disconnect capability and pre-populated cache

## Verification Execution Summary

### Step 0: Previous Verification Check
- No previous VERIFICATION.md found
- Proceeding with initial verification (not re-verification)

### Step 1: Context Loaded
- Phase goal extracted from v2.0-ROADMAP.md
- Must-haves extracted from all 4 plan files (17-01 through 17-04)
- SUMMARY.md files reviewed for execution status

### Step 2: Must-Haves Established
Source: Plan frontmatter (all 4 plans had documented must_haves)

**Truths (10 total):**
1. verify-qr-signature Edge Function reads secret from Deno.env
2. Scanner calls Edge Function, no client-side secret
3. All Edge Functions use shared CORS handler
4. VIP policies exclude anon access
5. SECURITY DEFINER RPC exists
6. VIPPassView uses RPC
7. Unsigned QR codes rejected
8. Manual entry works
9. Offline signature verification implemented
10. Fail-closed error handling

**Artifacts (6 total):**
- verify-qr-signature/index.ts
- _shared/cors.ts
- 20260213000000_tighten_vip_rls_policies.sql
- simple-scanner.ts
- offline-ticket-cache.ts
- VIPPassView.tsx

**Key Links (5 total):**
- Scanner → Edge Function (fetch)
- Edge Function → CORS handler (import)
- Scanner → Offline cache (verifySignatureOffline)
- VIPPassView → RPC (supabase.rpc)
- All Edge Functions → Shared CORS (import)

### Step 3: Observable Truths Verification
All 10 truths verified against actual codebase using grep, file reads, and line number checks.

### Step 4: Artifact Verification (Three Levels)

**Level 1 (Existence):** ✓ All 6 artifacts exist at expected paths
**Level 2 (Substantive):** ✓ All artifacts contain required patterns and logic
**Level 3 (Wired):** ✓ All artifacts imported/used by dependent code

### Step 5: Key Link Verification
All 5 key links verified with grep pattern matching and import/usage checks.

### Step 6: Requirements Coverage
4/4 P0 requirements (R01, R03, R05, R23) satisfied with supporting truths and artifacts verified.

### Step 7: Anti-Pattern Scan
Scanned modified files for:
- TODO/FIXME/PLACEHOLDER comments: None found
- Empty implementations (return null/{}): None found
- Console.log-only functions: None found
- Hardcoded secrets: None found
- Fail-open patterns: None found

### Step 8: Human Verification Needs Identified
4 items flagged for post-deployment manual testing (listed above).

### Step 9: Overall Status Determined
**Status: PASSED**

All automated checks passed:
- 10/10 truths verified
- 6/6 artifacts verified at all 3 levels
- 5/5 key links wired
- 4/4 requirements satisfied
- 0 blocker anti-patterns

4 items need human verification post-deployment (expected for security features).

### Step 10: Gap Output
Not applicable — status is PASSED, no gaps found.

## Commits Verified

All commits from 4 plans exist and are properly sequenced:

**Plan 17-01 (QR Signature Server-Side):**
- dc29494: Create verify-qr-signature Edge Function
- 2d2ab85: Migrate scanner to server-side verification
- 4301201: Add offline signature caching

**Plan 17-02 (CORS Centralization):**
- 2ced2d7: Add extra headers support to shared CORS
- 9d482e3: Migrate 8 simple Edge Functions to shared CORS
- 5b853e6: Migrate special Edge Functions to shared CORS

**Plan 17-03 (VIP RLS Tightening):**
- 0d84bd3: Tighten VIP RLS policies + create RPC
- b870374: Update VIPPassView to use RPC

**Plan 17-04 (Unsigned QR Rejection):**
- 0eaae06: Reject unsigned QR codes in scanner

**Total:** 10 commits across 4 plans, all verified in git history

## Security Improvements Verified

### Before Phase 17
- HMAC signing secret exposed in client bundle (VITE_QR_SIGNING_SECRET)
- 11 Edge Functions with hardcoded CORS wildcard (any domain can call)
- Anonymous users can SELECT all VIP reservations (PII exposure)
- Unsigned QR codes accepted and processed (forgery possible)

### After Phase 17
- Secret exists only in Deno server environment (Deno.env.get)
- All 15 Edge Functions use shared CORS handler (ALLOWED_ORIGINS support)
- VIP tables blocked for anonymous, controlled RPC access by token
- Unsigned QR codes rejected for QR/NFC methods (manual entry preserved)

**Risk Reduction:** 4 P0 security blockers eliminated

## Production Deployment Checklist

After this phase is deployed, the following environment setup is required:

1. **Set QR_SIGNING_SECRET in Supabase Dashboard:**
   ```
   Navigate: Project Settings → Edge Functions → Secrets
   Add: QR_SIGNING_SECRET = <current-secret-value>
   ```

2. **Set ALLOWED_ORIGINS in Supabase Dashboard:**
   ```
   Navigate: Project Settings → Edge Functions → Secrets
   Add: ALLOWED_ORIGINS = https://tickets.magueynightclub.com,https://www.magueynightclub.com,https://staff.magueynightclub.com
   ```

3. **Deploy verify-qr-signature Edge Function:**
   ```bash
   cd maguey-pass-lounge
   supabase functions deploy verify-qr-signature
   ```

4. **Apply VIP RLS migration:**
   ```
   Navigate: Supabase Dashboard → SQL Editor
   Execute: 20260213000000_tighten_vip_rls_policies.sql
   ```

5. **Verify CORS behavior:**
   ```bash
   # Test unauthorized domain (should fail)
   curl -H "Origin: https://evil.com" https://djbzjasdrwvbsoifxqzd.supabase.co/functions/v1/health-check
   
   # Test authorized domain (should succeed)
   curl -H "Origin: https://tickets.magueynightclub.com" https://djbzjasdrwvbsoifxqzd.supabase.co/functions/v1/health-check
   ```

6. **Run human verification tests** (see "Human Verification Required" section above)

---

_Verified: 2026-02-14T11:30:00Z_
_Verifier: Claude (gsd-verifier)_
_Duration: ~8 minutes (automated checks)_
_Outcome: PASSED — All must-haves verified, ready for deployment_
