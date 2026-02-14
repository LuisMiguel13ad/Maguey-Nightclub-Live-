# Phase 17: Security Lockdown

**Priority:** P0 | **Effort:** 2 days | **Dependencies:** None (independent)
**Goal:** Fix the 3 remaining P0 security vulnerabilities plus unsigned QR acceptance.

## Issues Addressed

| GSD # | Issue | Requirement |
|-------|-------|-------------|
| 1 | VITE_QR_SIGNING_SECRET exposed client-side | R01 |
| 3 | ALLOWED_ORIGINS not set for production | R03 |
| 5 | Anon access on VIP reservation data | R05 |
| 20 | Unsigned QR codes still accepted | R23 |

## Plans

| Plan | Objective | Wave | Status |
|------|-----------|------|--------|
| 17-01 | Move QR signing secret to server-side Edge Function | 1 | Planned |
| 17-02 | Set ALLOWED_ORIGINS env var, update CORS handler | 1 | Planned |
| 17-03 | Audit and fix VIP RLS policies (remove anon access) | 1 | Planned |
| 17-04 | Reject unsigned QR codes in scanner | 2 | Planned |

## Key Files

- `maguey-gate-scanner/src/lib/simple-scanner.ts` — reads `VITE_QR_SIGNING_SECRET` (line 60), allows when no secret (line 82)
- `maguey-pass-lounge/supabase/functions/_shared/cors.ts` — CORS handler
- New: `supabase/functions/verify-qr-signature/index.ts`
- Supabase RLS policies on `vip_reservations`, `event_vip_tables`

## Context Decisions

| Decision | Rationale |
|----------|-----------|
| Server-side QR verification via Edge Function | Secret must never be in client bundle |
| `current_setting('app.qr_signing_secret')` for secret storage | PostgreSQL config is server-side only |
| ALLOWED_ORIGINS from env var, not hardcoded | Flexibility across environments |
| Reject unsigned QR = `return false` not `return true` | Security-first: unknown signatures should fail |

## Success Criteria

- VITE_QR_SIGNING_SECRET removed from all client .env files
- QR verification works via server-side Edge Function
- CORS rejects requests from non-production origins
- VIP RLS blocks anonymous SELECT access
- Unsigned QR codes are rejected at the scanner
