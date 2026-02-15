# Phase 17: Security Lockdown - Research

**Researched:** 2026-02-13
**Domain:** Application Security (HMAC verification, CORS, RLS policies)
**Confidence:** HIGH

## Summary

This phase addresses 4 critical P0 security vulnerabilities in the Maguey Nightclub ticketing system. The research reveals that **partial fixes already exist** from a February 2026 security audit, but they were incompletely implemented. Specifically:

1. **Server-side QR generation exists** (migration 20260211000000) but client-side verification still exposes the secret
2. **CORS handler exists** with ALLOWED_ORIGINS support but 13 Edge Functions bypass it with hardcoded `*`
3. **VIP RLS policies allow anonymous SELECT** on sensitive PII (purchaser names, emails, phone numbers, QR tokens)
4. **Scanner accepts unsigned QR codes** when signature verification fails or is missing

The core fix pattern is **move secrets server-side, enforce validation server-side, reject insecure fallbacks**. All required infrastructure (HMAC functions, CORS handlers, constant-time comparison) already exists; this phase completes the migration.

**Primary recommendation:** Create a new Edge Function `verify-qr-signature` for client-side signature validation, migrate all 13 Edge Functions to shared CORS handler, create RPC-based VIP pass lookup to replace direct client queries, and enforce unsigned QR rejection in scanner.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Server-side QR verification via Edge Function** — Secret must never be in client bundle
- **`current_setting('app.qr_signing_secret')` for secret storage** — PostgreSQL config is server-side only
- **ALLOWED_ORIGINS from env var, not hardcoded** — Flexibility across environments
- **Reject unsigned QR = `return false` not `return true`** — Security-first: unknown signatures should fail

### Claude's Discretion
None specified — all decisions locked.

### Deferred Ideas (OUT OF SCOPE)
None specified.
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Web Crypto API | Native | HMAC-SHA256 signature generation/verification | Browser/Deno native, no dependencies, constant-time operations |
| Supabase Edge Functions | Deno runtime | Server-side QR verification endpoint | Already in use, TypeScript support, automatic deployment |
| PostgreSQL `current_setting()` | Native | Server-side secret storage | Database-level configuration, never exposed to clients |
| Supabase RLS | Native | Row-level access control | Already configured, enforces auth at DB level |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `crypto.subtle.sign()` | Web Crypto API | HMAC signature generation | Client-side QR generation (ticket emails), server-side verification |
| `crypto.subtle.importKey()` | Web Crypto API | HMAC key import from secret string | Before any sign/verify operation |
| PostgreSQL `hmac()` + `encode()` | Native (pgcrypto) | HMAC in SQL functions | RPC ticket creation, existing `generate_qr_signature()` function |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Edge Function verification | Client-side with exposed secret | **REJECTED**: Client bundles expose secret in source maps and bundle analysis |
| `current_setting('app.xxx')` | Supabase Vault (beta) | Vault not GA yet, `current_setting` proven pattern in this codebase (already used 5+ times) |
| Custom CORS per function | Shared `_shared/cors.ts` handler | Custom CORS causes inconsistency; 13 functions currently have hardcoded `*` |

**Installation:**
```bash
# No new dependencies needed - all native APIs
# Edge Function deployment via Supabase CLI
supabase functions deploy verify-qr-signature
```

## Architecture Patterns

### Recommended Project Structure
```
supabase/functions/
├── _shared/
│   ├── cors.ts              # ALREADY EXISTS - reuse for all functions
│   └── qr-verification.ts   # NEW - shared QR verification logic
├── verify-qr-signature/
│   └── index.ts             # NEW - public endpoint for scanner
└── [existing functions]/    # UPDATE - replace hardcoded CORS with shared handler
```

### Pattern 1: Server-Side QR Signature Verification
**What:** Scanner sends `{ token, signature }` to Edge Function, receives validation result without ever having access to secret.

**When to use:** Any client that needs to verify HMAC signatures without exposing the secret.

**Example:**
```typescript
// Edge Function: supabase/functions/verify-qr-signature/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

const textEncoder = new TextEncoder();

async function verifySignature(token: string, signature: string, secret: string): Promise<boolean> {
  if (!secret) return false;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      textEncoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      textEncoder.encode(token)
    );

    const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

    // Constant-time comparison
    if (expectedSignature.length !== signature.length) return false;
    let result = 0;
    for (let i = 0; i < expectedSignature.length; i++) {
      result |= expectedSignature.charCodeAt(i) ^ signature.charCodeAt(i);
    }
    return result === 0;
  } catch {
    return false;
  }
}

serve(async (req: Request) => {
  const corsResponse = handleCorsPreFlight(req);
  if (corsResponse) return corsResponse;

  const secret = Deno.env.get("QR_SIGNING_SECRET");
  if (!secret) {
    return new Response(JSON.stringify({ valid: false, error: "Server not configured" }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
    });
  }

  const { token, signature } = await req.json();
  const valid = await verifySignature(token, signature, secret);

  return new Response(JSON.stringify({ valid }), {
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
  });
});
```

**Client usage:**
```typescript
// maguey-gate-scanner/src/lib/simple-scanner.ts
async function verifySignatureServerSide(token: string, signature: string): Promise<boolean> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/verify-qr-signature`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey
      },
      body: JSON.stringify({ token, signature })
    });

    const { valid } = await response.json();
    return valid;
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false; // Fail closed
  }
}
```

### Pattern 2: Shared CORS Handler Migration
**What:** Replace per-function CORS with centralized handler that respects `ALLOWED_ORIGINS` environment variable.

**When to use:** Every Edge Function that handles cross-origin requests (all public endpoints).

**Example:**
```typescript
// BEFORE (insecure - hardcoded wildcard):
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

// AFTER (secure - uses shared handler):
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

serve(async (req: Request) => {
  // Handle preflight
  const corsResponse = handleCorsPreFlight(req);
  if (corsResponse) return corsResponse;

  // ... function logic ...

  return new Response(data, {
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
  });
});
```

**13 functions requiring migration:**
1. `stripe-webhook/index.ts` (has duplicate CORS logic)
2. `send-error-digest/index.ts`
3. `vip/create-payment-intent/index.ts`
4. `health-check/index.ts`
5. `verify-revenue/index.ts`
6. `cancel-event-with-refunds/index.ts`
7. `process-email-queue/index.ts`
8. `resend-webhook/index.ts`
9. `notify-payment-failure/index.ts`
10. `vip/confirmation/index.ts`
11. `check-availability/index.ts`
12. `example-with-security-headers.ts` (if active)
13. `resend-webhook/index.test.ts` (test file)

### Pattern 3: RLS Policy Tightening
**What:** Replace anonymous SELECT access with SECURITY DEFINER RPC that validates tokens before returning data.

**When to use:** Tables with PII that need public lookup by token (VIP passes, tickets).

**Example:**
```sql
-- BEFORE (insecure):
CREATE POLICY "vip_guest_passes_select" ON vip_guest_passes FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR auth.role() = 'authenticated'
    OR auth.role() = 'anon' -- VULNERABILITY: Anyone can query all passes
  );

-- AFTER (secure):
CREATE POLICY "vip_guest_passes_select" ON vip_guest_passes FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR auth.role() = 'authenticated'
    -- REMOVED: OR auth.role() = 'anon'
  );

-- New RPC for token-based lookup (SECURITY DEFINER bypasses RLS):
CREATE OR REPLACE FUNCTION get_vip_pass_by_token(p_qr_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Only return the specific pass that matches the token (no full table scan)
  SELECT json_build_object(
    'id', gp.id,
    'pass_number', gp.pass_number,
    'guest_name', gp.guest_name,
    'status', gp.status,
    'reservation', json_build_object(
      'table_number', vr.table_number,
      'event', json_build_object('name', e.name, 'date', e.event_date)
    )
  )
  INTO v_result
  FROM vip_guest_passes gp
  JOIN vip_reservations vr ON gp.vip_reservation_id = vr.id
  JOIN events e ON vr.event_id = e.id
  WHERE gp.qr_code_token = p_qr_token;

  RETURN v_result;
END;
$$;
```

### Pattern 4: Offline Mode Security
**What:** Cache QR signatures alongside tickets in IndexedDB, verify cached signatures offline.

**When to use:** Scanner offline mode (no network connectivity at door).

**Example:**
```typescript
// Update CachedTicket interface (already has qrSignature field):
export interface CachedTicket {
  ticketId: string;
  eventId: string;
  qrToken: string;
  qrSignature?: string; // ALREADY EXISTS - just needs population
  // ...
}

// Update syncTicketCache to fetch qr_signature:
const { data: tickets } = await supabase
  .from('tickets')
  .select('id, qr_token, qr_signature, event_id, status, attendee_name, ticket_type_id')
  .eq('event_id', eventId);

// Offline verification checks cached signature:
async function validateOffline(qrToken: string, eventId?: string): Promise<ValidationResult> {
  const cached = await db.cachedTickets.get({ qrToken });

  if (!cached) {
    return { status: 'not_in_cache' };
  }

  // Verify signature against cached value
  if (parsed.signature !== cached.qrSignature) {
    return { status: 'invalid', reason: 'signature_mismatch' };
  }

  // ... rest of validation
}
```

### Anti-Patterns to Avoid
- **Fail-open signature verification:** NEVER return `true` when signature is missing or secret unavailable. Always fail closed (return `false`).
- **Client-side secrets:** NEVER use `VITE_` prefix for HMAC secrets. Use `Deno.env.get()` in Edge Functions only.
- **Hardcoded CORS:** NEVER hardcode `Access-Control-Allow-Origin: *`. Always use shared handler with `ALLOWED_ORIGINS` env var.
- **Direct RLS for anonymous PII:** NEVER allow anonymous SELECT on tables with PII. Use SECURITY DEFINER RPC with token-based lookup.
- **Removing VITE_ vars without replacement:** MUST provide Edge Function endpoint before removing client-side verification, or scanner will break.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HMAC constant-time comparison | Custom timing-safe comparison | XOR accumulator pattern (already in codebase) | Timing attacks can leak signature bytes; XOR pattern is proven and used in Stripe webhook verification |
| Base64 encoding | Custom buffer-to-base64 | Node `Buffer.from().toString('base64')` or browser `btoa()` | Edge cases (padding, binary data) are complex; native APIs handle all cases |
| CORS preflight handling | Manual OPTIONS response | Shared `handleCorsPreFlight()` helper | Inconsistent CORS responses cause browser errors; centralized handler ensures spec compliance |
| QR signature generation | Custom crypto library | Web Crypto API `crypto.subtle` | Browser/Deno native, no supply chain risk, hardware-accelerated, same API as existing code |

**Key insight:** Security primitives (HMAC, constant-time comparison, CORS) have subtle edge cases. This codebase already has correct implementations (in `simple-scanner.ts` and `_shared/cors.ts`) — reuse them rather than reimplementing.

## Common Pitfalls

### Pitfall 1: Removing VITE_QR_SIGNING_SECRET Before Edge Function Deployed
**What goes wrong:** Scanner loses ability to verify signatures, all tickets show as "invalid signature" and are rejected.

**Why it happens:** Client code reads `import.meta.env.VITE_QR_SIGNING_SECRET` at build time. If removed from `.env`, variable is `undefined` and verification fails.

**How to avoid:**
1. Deploy `verify-qr-signature` Edge Function first
2. Update scanner to call Edge Function for verification
3. Test offline mode (falls back to cached signatures)
4. **Only then** remove `VITE_QR_SIGNING_SECRET` from `.env` files

**Warning signs:**
- Scanner logs: `[simple-scanner] No QR signing secret configured - skipping signature verification`
- All QR scans return "Invalid signature" error
- Offline mode fails (cached tickets have no signatures)

### Pitfall 2: ALLOWED_ORIGINS Not Set in Production
**What goes wrong:** Shared CORS handler defaults to `*` when `ALLOWED_ORIGINS` env var is not set, allowing any domain to call Edge Functions.

**Why it happens:** `_shared/cors.ts` has fallback: `if (!allowedOriginsEnv) return "*";`

**How to avoid:**
1. Set `ALLOWED_ORIGINS` in Supabase Dashboard → Edge Functions → Environment Variables
2. Value: `https://tickets.magueynightclub.com,https://staff.magueynightclub.com,https://magueynightclub.com`
3. Test preflight requests from allowed and disallowed origins
4. Verify production logs for CORS errors

**Warning signs:**
- Edge Function logs show requests from unexpected origins
- Browser console: `CORS policy: No 'Access-Control-Allow-Origin' header`
- Supabase logs: 401/403 errors from legitimate origins (means ALLOWED_ORIGINS too restrictive)

### Pitfall 3: VIP RLS Lockdown Breaks VIPPassView Page
**What goes wrong:** Public VIP pass view page (`/vip-pass/:token`) returns "Pass not found" error because anonymous users can no longer query `vip_guest_passes` table.

**Why it happens:** Direct Supabase query from client:
```typescript
const { data } = await supabase
  .from('vip_guest_passes')
  .select('*, vip_reservations(*)')
  .eq('qr_code_token', token)
  .single();
```
After RLS tightening, this query is blocked for anonymous users.

**How to avoid:**
1. Create `get_vip_pass_by_token(p_qr_token TEXT)` RPC (see Pattern 3)
2. Update `VIPPassView.tsx` to call RPC instead of direct query:
   ```typescript
   const { data } = await supabase.rpc('get_vip_pass_by_token', { p_qr_token: token });
   ```
3. Test public access (logged out browser) before deploying

**Warning signs:**
- VIPPassView page shows "Pass not found" for valid tokens
- Browser console: RLS policy violation error
- Email links to VIP passes return 404

### Pitfall 4: Offline Scanner Rejects Cached Tickets After Signature Enforcement
**What goes wrong:** Scanner works online but rejects all tickets in offline mode with "Invalid signature" error.

**Why it happens:**
1. `syncTicketCache()` doesn't fetch `qr_signature` column from DB (line missing in SELECT)
2. `CachedTicket.qrSignature` is `undefined`
3. Offline validation compares `parsed.signature` (from QR code) to `undefined` → mismatch

**How to avoid:**
1. Update `syncTicketCache()` to fetch `qr_signature`:
   ```typescript
   .select('id, qr_token, qr_signature, event_id, status, attendee_name, ticket_type_id')
   ```
2. Verify cached tickets have signatures in IndexedDB (DevTools → Application → IndexedDB)
3. Test offline mode after cache sync (airplane mode, scan ticket)

**Warning signs:**
- Scanner logs: `[offline] Signature mismatch: expected undefined, got AbC123...`
- All offline scans fail with "Invalid signature"
- IndexedDB inspection shows `qrSignature: undefined`

### Pitfall 5: Base64 Encoding Mismatch Between Environments
**What goes wrong:** Signatures generated in Edge Functions don't match signatures verified in browser.

**Why it happens:** Deno and browser have different Base64 encoding helpers:
- Deno: `btoa()` available globally
- Browser: `btoa()` available, but `Buffer` is not (Node.js API)
- PostgreSQL: `encode(bytea, 'base64')` adds newlines every 76 characters

**How to avoid:**
1. Use consistent Base64 helper across all environments:
   ```typescript
   function base64Encode(buffer: ArrayBuffer): string {
     if (typeof Buffer !== 'undefined') {
       return Buffer.from(buffer).toString('base64');
     }
     return btoa(String.fromCharCode(...new Uint8Array(buffer)));
   }
   ```
2. PostgreSQL: Use `replace(encode(hmac(...), 'base64'), E'\n', '')` to strip newlines
3. Test signature round-trip: generate in Edge Function, verify in browser

**Warning signs:**
- Same token/secret produces different signatures in different environments
- Signature verification always fails despite correct secret
- Base64 strings have different lengths

## Code Examples

Verified patterns from existing codebase:

### Constant-Time String Comparison
```typescript
// Source: maguey-gate-scanner/src/lib/simple-scanner.ts lines 102-112
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
```

### HMAC-SHA256 Signature Generation (Browser/Deno)
```typescript
// Source: maguey-pass-lounge/supabase/functions/stripe-webhook/index.ts
async function generateQrSignature(token: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(token)
  );
  return btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
}
```

### HMAC-SHA256 Signature Generation (PostgreSQL)
```sql
-- Source: maguey-pass-lounge/supabase/migrations/20250324000000_create_order_transaction.sql
CREATE OR REPLACE FUNCTION generate_qr_signature(
  p_token TEXT,
  p_secret TEXT
)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(hmac(p_token, p_secret, 'sha256'), 'base64');
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

### Reading Server-Side Config in PostgreSQL
```sql
-- Source: maguey-pass-lounge/supabase/migrations/20260211000000_remove_qr_secret_from_client.sql
-- Read secret from server config (never from client parameter)
v_signing_secret := current_setting('app.qr_signing_secret', true);

-- Fallback if not configured (with warning)
IF v_signing_secret IS NULL OR v_signing_secret = '' THEN
  RAISE WARNING 'app.qr_signing_secret not configured. Set with: ALTER DATABASE postgres SET app.qr_signing_secret = ''your-secret'';';
END IF;
```

### Shared CORS Handler
```typescript
// Source: maguey-pass-lounge/supabase/functions/_shared/cors.ts (ALREADY EXISTS)
export function getCorsHeaders(req: Request) {
  return {
    "Access-Control-Allow-Origin": getAllowedOrigin(req.headers.get("origin")),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

export function handleCorsPreFlight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }
  return null;
}
```

### SECURITY DEFINER RPC Pattern
```sql
-- Pattern for token-based lookup without exposing full table
CREATE OR REPLACE FUNCTION get_record_by_token(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER -- Bypasses RLS, runs as function owner
AS $$
BEGIN
  -- Only return specific record matching token (no table scan for client)
  RETURN (
    SELECT row_to_json(t)
    FROM table_name t
    WHERE t.token_column = p_token
    LIMIT 1
  );
END;
$$;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| VITE_ prefix for all env vars | `VITE_` only for truly public values, server secrets in `Deno.env` | 2024+ React docs | Secrets exposed in client bundles caused real breaches |
| Hardcoded CORS `*` in every function | Centralized CORS handler with env var | 2023+ OWASP recommendations | Prevents CORS misconfiguration, easier compliance audits |
| Anonymous RLS SELECT on PII tables | SECURITY DEFINER RPC with token-based lookup | Post-2022 Supabase docs | Prevents full table dumps via client-side queries |
| Fail-open signature verification | Fail-closed (reject when missing/invalid) | OWASP ASVS 4.0 (2019) | Default-deny is fundamental security principle |

**Deprecated/outdated:**
- **`import.meta.env` for secrets:** Was never secure, but became visible attack vector after Vite source maps enabled by default in 2023. Current best practice: server-side only.
- **`Buffer.from()` in browser:** Node.js API not available in browser without polyfill. Use `TextEncoder`/`TextDecoder` (Web standard since 2017).

## Open Questions

1. **Should offline mode cache signatures at all?**
   - What we know: `CachedTicket` interface already has `qrSignature?: string` field (line 20), but `syncTicketCache()` doesn't populate it.
   - What's unclear: Is offline signature verification valuable when secret isn't available client-side? Cached signatures can still detect tampering if QR code is modified after caching.
   - Recommendation: **Yes, cache signatures.** Provides defense-in-depth: even offline, scanner rejects QR codes with mismatched signatures (protects against ticket cloning after cache sync but before event).

2. **How to handle the migration window when Edge Function is deployed but clients haven't updated?**
   - What we know: Scanner code currently has fallback `if (!secret) return true` (line 82).
   - What's unclear: Safe rollout order to avoid breaking production scanners.
   - Recommendation: **Phased rollout:**
     1. Deploy Edge Function (scanner can call it but still has fallback)
     2. Update scanner to call Edge Function, keep client-side as fallback
     3. Test in production for 1 event (verify all scans work)
     4. Remove `VITE_QR_SIGNING_SECRET` from env (Edge Function becomes only path)
     5. Update scanner to remove fallback logic (fail-closed)

3. **Should ALLOWED_ORIGINS include localhost for development?**
   - What we know: Shared CORS handler defaults to `*` when env var not set.
   - What's unclear: Best practice for dev/staging environments.
   - Recommendation: **Three-tier approach:**
     - Development (local): `ALLOWED_ORIGINS` not set → defaults to `*`
     - Staging: `ALLOWED_ORIGINS=https://staging.example.com,http://localhost:3015,http://localhost:3016`
     - Production: `ALLOWED_ORIGINS=https://tickets.magueynightclub.com,https://staff.magueynightclub.com,https://magueynightclub.com` (no localhost)

## Sources

### Primary (HIGH confidence)
- Maguey codebase `/maguey-gate-scanner/src/lib/simple-scanner.ts` - Current HMAC verification implementation (lines 78-117)
- Maguey codebase `/maguey-pass-lounge/supabase/functions/_shared/cors.ts` - Existing CORS handler with ALLOWED_ORIGINS support
- Maguey codebase `/maguey-pass-lounge/supabase/migrations/20260211000000_remove_qr_secret_from_client.sql` - Server-side QR signing migration (incomplete)
- Maguey codebase `/maguey-pass-lounge/supabase/migrations/20260128100000_fix_vip_system_comprehensive.sql` - VIP RLS policies (lines with `auth.role() = 'anon'`)
- Maguey codebase `/maguey-gate-scanner/src/lib/offline-ticket-cache.ts` - CachedTicket interface with qrSignature field (line 20)
- MDN Web Crypto API - `crypto.subtle.sign()` documentation (2024)
- PostgreSQL documentation - `current_setting()` function (version 13+)

### Secondary (MEDIUM confidence)
- OWASP ASVS 4.0 - Cryptographic verification requirements (fail-closed principle)
- Supabase Edge Functions documentation - Deno runtime and environment variables (2024)
- Supabase RLS documentation - SECURITY DEFINER pattern for public lookups (2024)

### Tertiary (LOW confidence)
- None - all claims verified with primary sources (codebase inspection and official documentation)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All APIs already in use in codebase (Web Crypto, Supabase Edge Functions, PostgreSQL functions)
- Architecture: HIGH - Patterns exist in codebase, just need completion (server-side signing exists, client-side verification needs migration)
- Pitfalls: HIGH - Identified through codebase analysis (found 13 functions with hardcoded CORS, VIPPassView.tsx direct query, missing qr_signature in cache sync)

**Research date:** 2026-02-13
**Valid until:** 2026-03-15 (30 days - stable domain, no fast-moving dependencies)
