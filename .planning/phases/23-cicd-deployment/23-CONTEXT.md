# Phase 23: CI/CD & Production Deployment

**Priority:** P0 | **Effort:** 1.5 days | **Dependencies:** All previous phases
**Goal:** Enable CI/CD, switch to production credentials, deploy to Vercel.

## Issues Addressed

| GSD # | Issue | Requirement |
|-------|-------|-------------|
| 2 | Stripe in test mode (pk_test_ / sk_test_) | R02 |
| 4 | CI/CD pipeline disabled (needs secrets) | R04 |
| 52 | Set all Vercel environment variables | R38 |

## Plans

| Plan | Objective | Wave |
|------|-----------|------|
| 23-01 | Configure GitHub Actions secrets + enable CI/CD | 1 |
| 23-02 | Switch Stripe to production keys + verify payments | 2 |
| 23-03 | Set all Vercel environment variables + deployment verification | 2 |

## Key Files

- `.github/workflows/e2e.yml` — CI/CD pipeline
- `maguey-pass-lounge/.env` — Stripe keys
- Vercel dashboard — environment variables (manual)

## GitHub Secrets Required

1. `VITE_SUPABASE_URL`
2. `VITE_SUPABASE_ANON_KEY`
3. `SUPABASE_SERVICE_ROLE_KEY`
4. `STRIPE_TEST_PK`
5. `STRIPE_TEST_SK`
6. `SCANNER_TEST_EMAIL`
7. `SCANNER_TEST_PASSWORD`

## Vercel Environment Variables (per site)

### maguey-pass-lounge (tickets.magueynightclub.com)
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- VITE_STRIPE_PUBLISHABLE_KEY (production)
- VITE_PURCHASE_SITE_URL

### maguey-gate-scanner (staff.magueynightclub.com)
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY

### maguey-nights (magueynightclub.com)
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- VITE_PURCHASE_SITE_URL

## Success Criteria

- CI/CD pipeline runs green on push
- Stripe processes real payments with production keys
- All 3 Vercel sites deploy with correct environment variables
- End-to-end flow verified in production
