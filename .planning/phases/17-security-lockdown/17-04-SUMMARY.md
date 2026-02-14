---
phase: 17-security-lockdown
plan: 04
subsystem: scanner
tags: [security, qr-verification, p0-blocker]
dependency_graph:
  requires: ["17-01"]
  provides: ["unsigned-qr-rejection"]
  affects: ["scanner-security", "offline-scanning"]
tech_stack:
  added: []
  patterns: ["fail-closed-security", "method-based-enforcement"]
key_files:
  created: []
  modified:
    - path: "maguey-gate-scanner/src/lib/simple-scanner.ts"
      lines_changed: 29
      reason: "Added unsigned QR rejection and signature enforcement"
decisions:
  - decision: "Reject unsigned QR = return error not return true"
    rationale: "Fail-closed pattern prevents security bypass"
    alternatives: ["Warn and accept", "Log and accept"]
  - decision: "Manual entry bypasses signature check (method !== 'manual')"
    rationale: "Staff need ability to type ticket IDs as fallback at the door"
    alternatives: ["Require signature for all methods", "Separate manual lookup function"]
  - decision: "Offline signature verification uses cached signature comparison"
    rationale: "verifySignatureOffline provides offline security without server calls"
    alternatives: ["Skip signature check offline", "Queue for online verification only"]
metrics:
  duration: "53s"
  tasks_completed: 1
  files_modified: 1
  commits: 1
  completed_at: "2026-02-14"
---

# Phase 17 Plan 04: Unsigned QR Rejection Summary

**One-liner:** Scanner now rejects all unsigned QR codes via QR/NFC methods while preserving manual entry fallback for staff

## What Was Built

Enforced signature verification in the scanner to reject unsigned QR codes, closing P0/P1 blocker R23 (unsigned QR codes bypass HMAC verification).

### Key Changes

**1. parseQrInput rejects unsigned JSON payloads**
- Changed from `{ token: payload.token, isVerified: false }` (accept unsigned)
- To `{ token: '', isVerified: false, error: 'Unsigned QR code - ticket may be forged' }` (reject unsigned)
- Missing signature field now triggers error instead of accepting unverified token

**2. scanTicket enforces signature for QR/NFC methods**
- Added `if (method !== 'manual' && !parsed.isVerified)` check
- QR/NFC scans must have valid signature to proceed
- Manual entry (`method === 'manual'`) bypasses signature requirement for staff fallback

**3. scanTicketOffline verifies cached signatures**
- Calls `verifySignatureOffline(parsed.token, parsed.signature)` for offline mode
- Signature mismatch against cached value returns `rejectionReason: 'tampered'`
- Ensures offline security without server-side Edge Function call

### Security Model

**Before 17-04:**
- JSON QR without signature → accepted as unverified, processed normally
- Plain-text QR → accepted as unverified, processed normally
- **Attack:** Anyone could create fake QR with just ticket UUID, bypass HMAC

**After 17-04:**
- JSON QR without signature → rejected with error "Unsigned QR code - ticket may be forged"
- Plain-text QR via QR/NFC → rejected with error "QR code is not signed"
- Manual entry → still works (staff can type ticket IDs)
- **Attack blocked:** Unsigned QR codes fail at scanner immediately

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

✅ **Unsigned QR rejection message added**
```
123:        return { token: '', isVerified: false, error: 'Unsigned QR code - ticket may be forged' };
```

✅ **Method-based enforcement check present**
```
288:  if (method !== 'manual' && !parsed.isVerified) {
```

✅ **Offline signature verification implemented**
```
617:    const { verifySignatureOffline } = await import('./offline-ticket-cache');
618:    const signatureValid = await verifySignatureOffline(parsed.token, parsed.signature);
```

✅ **No fail-open paths remain**
- Searched for `return true` in signature verification area - none found
- All unsigned paths return `false` or `error`

✅ **TypeScript compilation succeeds**
- No type errors after changes

## Files Modified

| File | Lines Changed | Purpose |
|------|---------------|---------|
| maguey-gate-scanner/src/lib/simple-scanner.ts | +29 -2 | Unsigned QR rejection + signature enforcement |

## Commits

| Hash | Message | Files |
|------|---------|-------|
| 0eaae06 | feat(17-04): reject unsigned QR codes in scanner | simple-scanner.ts |

## Testing Evidence

**Manual verification via grep:**
1. Unsigned QR error message present (line 123)
2. Method enforcement check present (line 288)
3. Offline signature verification present (lines 617-618)
4. No fail-open paths in signature verification logic
5. TypeScript compiles without errors

**Expected behavior:**
- JSON QR `{"token": "uuid"}` (no signature) → Error "Unsigned QR code - ticket may be forged"
- Plain text QR `uuid` via QR scan → Error "QR code is not signed - please use manual entry"
- Plain text `uuid` via manual entry → Proceeds to ticket lookup (signature bypassed)
- JSON QR `{"token": "uuid", "signature": "invalid"}` → Error "Invalid QR code signature"
- JSON QR `{"token": "uuid", "signature": "valid"}` → Proceeds to ticket lookup

**Offline behavior:**
- Cached signature mismatch → Error "QR code signature is invalid (offline verification)"
- Cached signature match → Proceeds to offline validation

## Impact Assessment

### Security Improvements
- **P0 blocker R23 RESOLVED:** Unsigned QR codes no longer bypass HMAC verification
- Fail-closed pattern: signature verification failure = rejection (not acceptance)
- Offline mode maintains security via cached signature comparison

### Staff Workflow
- **Manual entry preserved:** Staff can type ticket IDs at the door as fallback
- QR/NFC scans now require signature (expected production behavior)
- No impact to legitimate ticket scanning (all production QRs are signed after 17-01)

### Dependencies
- Requires 17-01 (server-side signature generation) to be deployed
- Works with existing offline-ticket-cache.ts `verifySignatureOffline` function
- Compatible with existing QR payload structure from Stripe webhook

## Next Steps

1. **Deploy 17-01 Edge Function first** - ensures all new QR codes have signatures
2. **Test with unsigned legacy tickets** - verify manual entry fallback works
3. **Monitor rejection logs** - track "tampered" rejections for security analysis
4. **Complete Phase 17** - move to final plan (17-03 already complete)

## Self-Check: PASSED

✅ **File exists:** maguey-gate-scanner/src/lib/simple-scanner.ts (modified)
✅ **Commit exists:** 0eaae06
✅ **TypeScript compiles:** No errors
✅ **All verifications passed:** grep checks confirm all changes applied

## Related Context

- **17-01-SUMMARY.md:** Server-side QR signature generation (dependency)
- **17-RESEARCH.md:** Security analysis that identified unsigned QR vulnerability
- **Plan decision:** Reject unsigned QR = return false not return true (locked context)
- **P0 blocker R23:** "Unsigned QR codes still accepted" - RESOLVED by this plan
