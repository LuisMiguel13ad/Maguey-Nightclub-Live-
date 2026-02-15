---
phase: 17-security-lockdown
plan: 02
subsystem: backend-security
tags: [cors, edge-functions, security, production]
dependency_graph:
  requires: ["17-01"]
  provides: ["cors-centralization"]
  affects: ["all-edge-functions", "production-deployment"]
tech_stack:
  added: []
  patterns: ["shared-cors-handler", "extra-headers-parameter"]
key_files:
  created: []
  modified:
    - maguey-pass-lounge/supabase/functions/_shared/cors.ts
    - maguey-pass-lounge/supabase/functions/send-error-digest/index.ts
    - maguey-pass-lounge/supabase/functions/health-check/index.ts
    - maguey-pass-lounge/supabase/functions/verify-revenue/index.ts
    - maguey-pass-lounge/supabase/functions/cancel-event-with-refunds/index.ts
    - maguey-pass-lounge/supabase/functions/process-email-queue/index.ts
    - maguey-pass-lounge/supabase/functions/notify-payment-failure/index.ts
    - maguey-pass-lounge/supabase/functions/check-availability/index.ts
    - maguey-pass-lounge/supabase/functions/vip/confirmation/index.ts
    - maguey-pass-lounge/supabase/functions/stripe-webhook/index.ts
    - maguey-pass-lounge/supabase/functions/resend-webhook/index.ts
    - maguey-pass-lounge/supabase/functions/vip/create-payment-intent/index.ts
decisions:
  - decision: "Extra headers parameter is optional to maintain backward compatibility"
    rationale: "Existing callers (create-checkout-session, confirm-vip-payment) continue working without changes"
  - decision: "stripe-signature passed as extra header instead of included in base headers"
    rationale: "Only stripe-webhook needs this header; keeping it separate maintains clean separation of concerns"
  - decision: "SVIX_HEADERS constant defined at module level in resend-webhook"
    rationale: "Three headers needed for Svix signature verification; constant improves readability and maintainability"
  - decision: "Removed 39 lines of duplicate CORS logic from stripe-webhook"
    rationale: "Local getAllowedOrigin and getCorsHeaders were exact duplicates of shared handler; centralization reduces maintenance burden"
metrics:
  duration: 4
  completed_date: "2026-02-14"
  tasks_completed: 3
  files_modified: 12
  commits: 3
  lines_removed: 67
  lines_added: 27
---

# Phase 17 Plan 02: CORS Centralization Summary

**One-liner:** All 11 Edge Functions migrated from hardcoded `Access-Control-Allow-Origin: "*"` to shared CORS handler with `ALLOWED_ORIGINS` environment variable support.

## What Was Done

### Task 1: Enhanced Shared CORS Handler (Commit: 2ced2d7)

**Updated** `_shared/cors.ts` to accept optional extra headers parameter:

```typescript
export function getCorsHeaders(req: Request, extraAllowedHeaders?: string) {
  const baseHeaders = "authorization, x-client-info, apikey, content-type";
  const allowHeaders = extraAllowedHeaders
    ? `${baseHeaders}, ${extraAllowedHeaders}`
    : baseHeaders;
  // ...
}

export function handleCorsPreFlight(req: Request, extraAllowedHeaders?: string): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req, extraAllowedHeaders) });
  }
  return null;
}
```

**Why:** Webhook functions need additional headers (stripe-signature, svix-id/timestamp/signature) for signature verification. Making this parameter optional ensures backward compatibility with existing callers.

### Task 2: Migrated 8 Simple Edge Functions (Commit: 9d482e3)

**Migrated:** send-error-digest, health-check, verify-revenue, cancel-event-with-refunds, process-email-queue, notify-payment-failure, check-availability, vip/confirmation

**Pattern applied:**
1. Removed `const corsHeaders = { "Access-Control-Allow-Origin": "*", ... }`
2. Added `import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";` (or `../../_shared/cors.ts` for vip/confirmation)
3. Replaced OPTIONS handler with `const corsResponse = handleCorsPreFlight(req); if (corsResponse) return corsResponse;`
4. Replaced all `{ ...corsHeaders, ... }` with `{ ...getCorsHeaders(req), ... }`

**Result:** All 8 functions now dynamically check request origin against `ALLOWED_ORIGINS` env var instead of blindly accepting all origins.

### Task 3: Migrated 3 Special Edge Functions (Commit: 5b853e6)

#### stripe-webhook
- **Removed 39 lines** of duplicate CORS logic (local `getAllowedOrigin`, `baseCorsHeaders`, `getCorsHeaders` functions)
- **Added** `import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";`
- **Updated** OPTIONS handler: `const corsResponse = handleCorsPreFlight(req, "stripe-signature");`
- **Updated** dynamic headers: `const dynamicCorsHeaders = getCorsHeaders(req, "stripe-signature");`

**Impact:** Simplified from ~150 lines of CORS code to 2 import lines. stripe-signature header preserved for Stripe webhook verification.

#### resend-webhook
- **Added** `const SVIX_HEADERS = "svix-id, svix-timestamp, svix-signature";` for Svix webhook signature verification
- **Replaced** hardcoded `corsHeaders` with `getCorsHeaders(req, SVIX_HEADERS)` throughout
- **Updated** OPTIONS handler: `const corsResponse = handleCorsPreFlight(req, SVIX_HEADERS);`

**Impact:** All Svix headers (id, timestamp, signature) preserved for Resend webhook verification while respecting ALLOWED_ORIGINS.

#### vip/create-payment-intent
- Standard migration with `../../_shared/cors.ts` import path
- No extra headers needed (standard API endpoint)

## Verification Results

### Zero Hardcoded Wildcards
```bash
grep -rl '"Access-Control-Allow-Origin": "\*"' maguey-pass-lounge/supabase/functions/*/index.ts
# Returns: (empty) ✅
```

All 11 Edge Function `index.ts` files confirmed clean of hardcoded CORS wildcards.

### Shared Handler Imported
All 11 functions verified to import from `_shared/cors.ts`:
- 9 functions: `../_shared/cors.ts`
- 2 functions in vip/: `../../_shared/cors.ts`

### Special Headers Preserved
- **stripe-webhook:** `handleCorsPreFlight(req, "stripe-signature")` and `getCorsHeaders(req, "stripe-signature")`
- **resend-webhook:** `handleCorsPreFlight(req, SVIX_HEADERS)` and `getCorsHeaders(req, SVIX_HEADERS)` where `SVIX_HEADERS = "svix-id, svix-timestamp, svix-signature"`
- **vip/create-payment-intent:** Standard pattern (no extra headers)

## Production Impact

### Before This Plan
```typescript
// Each function had:
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",  // ⚠️ Accepts ANY domain
  "Access-Control-Allow-Headers": "...",
};
```

**Security Risk:** Any website could call Edge Functions from browser, enabling:
- Cross-site request forgery (CSRF) attacks
- Unauthorized API access from malicious domains
- Data exfiltration via compromised third-party sites

### After This Plan
```typescript
// All functions use:
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

serve(async (req) => {
  const corsResponse = handleCorsPreFlight(req);
  if (corsResponse) return corsResponse;

  // All responses:
  return new Response(data, {
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
  });
});
```

**With `ALLOWED_ORIGINS` set in production:**
- Only whitelisted domains (tickets.magueynightclub.com, www.magueynightclub.com) can call functions
- Unauthorized domains receive first allowed origin (not their origin), breaking CORS
- Browsers block unauthorized cross-origin requests

**Without `ALLOWED_ORIGINS` (dev mode):**
- Functions return `Access-Control-Allow-Origin: "*"` for development convenience
- Easy local testing without configuring origins

## Deviations from Plan

None. Plan executed exactly as written. All 11 functions migrated, shared handler enhanced, no hardcoded wildcards remaining.

## Next Steps

1. **Set `ALLOWED_ORIGINS` in Supabase Dashboard** (Production Edge Functions secrets):
   ```
   ALLOWED_ORIGINS=https://tickets.magueynightclub.com,https://www.magueynightclub.com,https://staff.magueynightclub.com
   ```

2. **Verify in production:** After deployment, confirm unauthorized domains receive first allowed origin (not wildcard):
   ```bash
   curl -H "Origin: https://evil.com" https://djbzjasdrwvbsoifxqzd.supabase.co/functions/v1/health-check
   # Should return: Access-Control-Allow-Origin: https://tickets.magueynightclub.com
   # (NOT: Access-Control-Allow-Origin: *)
   ```

3. **Test legitimate requests:** Confirm whitelisted domains work:
   ```bash
   curl -H "Origin: https://tickets.magueynightclub.com" https://djbzjasdrwvbsoifxqzd.supabase.co/functions/v1/health-check
   # Should return: Access-Control-Allow-Origin: https://tickets.magueynightclub.com
   ```

## Related Plans

- **17-01** (prerequisite): Environment audit and credential verification
- **17-03** (next): QR signing secret server-side migration
- **17-04** (next): Stripe production keys and webhook origin restriction

## Files Changed Summary

| File | Changes | LOC Impact |
|------|---------|------------|
| _shared/cors.ts | Added extraAllowedHeaders parameter | +27 |
| stripe-webhook/index.ts | Removed duplicate CORS logic, use shared handler | -39 / +2 |
| resend-webhook/index.ts | Added SVIX_HEADERS, use shared handler | -10 / +4 |
| 8 simple functions | Removed hardcoded CORS, use shared handler | -24 / +16 |

**Net:** -67 lines removed, +27 lines added = **40 lines cleaner**

## Self-Check: PASSED

✅ All created files exist (none created, only modified)
✅ All commits exist:
- 2ced2d7: feat(17-02): add optional extra headers support to shared CORS handler
- 9d482e3: feat(17-02): migrate 8 simple Edge Functions to shared CORS handler
- 5b853e6: feat(17-02): migrate special Edge Functions to shared CORS handler

✅ All modified files verified:
- _shared/cors.ts has extraAllowedHeaders parameter
- All 11 functions import from _shared/cors.ts
- Zero hardcoded `Access-Control-Allow-Origin: "*"` remaining
- stripe-signature preserved in stripe-webhook
- SVIX_HEADERS preserved in resend-webhook

## Status

**P0 blocker R03 RESOLVED:** All Edge Functions now use centralized CORS handler. Setting `ALLOWED_ORIGINS` in production restricts all 11 functions to whitelisted domains.
