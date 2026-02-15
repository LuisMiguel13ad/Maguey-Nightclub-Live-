---
phase: 17-security-lockdown
plan: 03
subsystem: vip-system
tags: [security, rls, rpc, pii-protection]
dependency_graph:
  requires: []
  provides: [token-based-vip-lookup, tightened-vip-rls]
  affects: [vip-pass-view, vip-reservations-access]
tech_stack:
  added: [get_vip_pass_by_token RPC]
  patterns: [SECURITY DEFINER RPC, token-based lookup]
key_files:
  created:
    - maguey-pass-lounge/supabase/migrations/20260213000000_tighten_vip_rls_policies.sql
  modified:
    - maguey-pass-lounge/src/pages/VIPPassView.tsx
decisions:
  - what: Remove anonymous SELECT access from VIP tables
    why: PII exposure (purchaser names, emails, phone numbers, QR tokens)
    impact: Public VIP pass view requires RPC instead of direct query
  - what: SECURITY DEFINER RPC for token-based lookup
    why: Safe bypass of RLS when lookup is by exact token (UUID)
    alternatives: [service_role client, custom middleware]
  - what: event_vip_tables policy unchanged
    why: Public booking page needs to display available tables
metrics:
  duration: 114s
  completed: 2026-02-14T05:05:08Z
---

# Phase 17 Plan 03: Remove Anonymous VIP RLS Access Summary

**One-liner:** Removed anonymous SELECT access from VIP tables and created SECURITY DEFINER RPC for secure token-based pass lookup.

## What Was Done

Addressed P0 blocker R05 (anonymous SELECT access on vip_reservations and vip_guest_passes exposing PII) by tightening RLS policies and creating a controlled server-side access point for the public VIP pass view page.

### Migration Created

**File:** `maguey-pass-lounge/supabase/migrations/20260213000000_tighten_vip_rls_policies.sql`

1. **Dropped and recreated vip_reservations SELECT policy** without `auth.role() = 'anon'`
   - Now allows: `service_role` OR `authenticated` users matching purchaser_email
   - Blocks: Anonymous queries (full table scan)

2. **Dropped and recreated vip_guest_passes SELECT policy** without `auth.role() = 'anon'`
   - Now allows: `service_role` OR `authenticated` users
   - Blocks: Anonymous queries (full table scan)

3. **Created get_vip_pass_by_token() SECURITY DEFINER RPC**
   - Takes: `p_qr_token TEXT` parameter
   - Returns: JSON object with nested vip_reservations, events, event_vip_tables
   - Security: Token-based lookup (must know exact UUID), no full table scan
   - Pattern: `SET search_path = public` for SECURITY DEFINER safety

### Component Updated

**File:** `maguey-pass-lounge/src/pages/VIPPassView.tsx`

- **Before:** `.from('vip_guest_passes').select(...).eq('qr_code_token', token).single()`
- **After:** `.rpc('get_vip_pass_by_token', { p_qr_token: token })`
- **No other changes needed:** RPC returns same nested JSON structure

## Deviations from Plan

None - plan executed exactly as written.

## Verification

### Migration Verification

```bash
# No anon in CREATE POLICY statements (only in comments)
$ grep "anon" migration.sql | grep -v "^--"
(empty output)

# SECURITY DEFINER RPC exists
$ grep "SECURITY DEFINER" migration.sql
SECURITY DEFINER

# RPC function exists
$ grep "get_vip_pass_by_token" migration.sql
CREATE OR REPLACE FUNCTION get_vip_pass_by_token(p_qr_token TEXT)
```

### Component Verification

```bash
# RPC call is used
$ grep "rpc" VIPPassView.tsx
.rpc('get_vip_pass_by_token', { p_qr_token: token });

# Direct table query removed
$ grep "from.*vip_guest_passes" VIPPassView.tsx
(empty output)

# TypeScript compiles
$ npx tsc --noEmit 2>&1 | grep -i error
(no VIPPassView-specific errors)
```

### Self-Check: PASSED

**Created files exist:**
```bash
$ [ -f "maguey-pass-lounge/supabase/migrations/20260213000000_tighten_vip_rls_policies.sql" ] && echo "FOUND"
FOUND
```

**Modified files exist:**
```bash
$ [ -f "maguey-pass-lounge/src/pages/VIPPassView.tsx" ] && echo "FOUND"
FOUND
```

**Commits exist:**
```bash
$ git log --oneline --all | grep -q "0d84bd3" && echo "FOUND: 0d84bd3"
FOUND: 0d84bd3
$ git log --oneline --all | grep -q "b870374" && echo "FOUND: b870374"
FOUND: b870374
```

## Post-Migration Steps Required

After applying this migration to Supabase:

1. **Verify RLS enforcement:**
   ```javascript
   // As anonymous user, this should return empty:
   const { data } = await supabase.from('vip_reservations').select('*');
   console.log(data); // Should be []
   ```

2. **Test VIPPassView with valid token:**
   - Navigate to: `https://tickets.magueynightclub.com/vip-pass/{valid-token}`
   - Should display pass details (via RPC)

3. **Test VIPPassView with invalid token:**
   - Navigate to: `https://tickets.magueynightclub.com/vip-pass/invalid-token`
   - Should show "Pass not found" error

4. **Verify event_vip_tables still public:**
   ```javascript
   // As anonymous user, this should still work (needed for booking page):
   const { data } = await supabase.from('event_vip_tables').select('*');
   console.log(data); // Should return tables
   ```

## Security Impact

### Before
- Anonymous users could query: `SELECT * FROM vip_reservations`
- Exposed: All purchaser names, emails, phone numbers, payment intents
- Anonymous users could query: `SELECT * FROM vip_guest_passes`
- Exposed: All guest names, emails, QR tokens

### After
- Anonymous queries blocked at RLS level
- Public VIP pass view uses controlled RPC with token-based lookup
- Must know exact UUID token to retrieve data (no enumeration possible)
- event_vip_tables intentionally remains public (required for booking page)

## Next Steps

- **Plan 17-04:** Enforce unsigned QR rejection in scanner (currently accepts unsigned codes as fallback)

## Commits

| Task | Commit | Files |
|------|--------|-------|
| 1 | 0d84bd3 | migration: tighten VIP RLS policies + RPC |
| 2 | b870374 | VIPPassView: use RPC instead of direct query |

## Completion

**Status:** COMPLETE
**Duration:** 1 minute 54 seconds
**Tasks:** 2/2
**Deviations:** 0
**Blockers Resolved:** R05 (Anonymous VIP RLS access)
