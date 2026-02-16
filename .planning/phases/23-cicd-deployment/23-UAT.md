---
status: testing
phase: 23-cicd-deployment
source: 23-01-SUMMARY.md, 23-02-SUMMARY.md, 23-03-SUMMARY.md
started: 2026-02-15T22:00:00Z
updated: 2026-02-15T22:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: CI/CD Workflow Structure
expected: |
  `.github/workflows/e2e.yml` exists with:
  - Push/PR triggers on main and develop branches (lines 5-8)
  - 4 sequential jobs: lint -> unit-test -> build -> e2e
  - All 3 workspaces (pass-lounge, gate-scanner, maguey-nights) included in lint and build jobs
  - E2E specs distributed across 4 containers without duplication (Container 1: health+smoke, Container 2: happy-path, Container 3: edge-cases, Container 4: offline)
awaiting: user response

## Tests

### 1. CI/CD Workflow Structure
expected: `.github/workflows/e2e.yml` has push/PR triggers on main+develop, 4 sequential jobs (lint -> unit-test -> build -> e2e), all 3 workspaces in lint/build, E2E split across 4 containers without duplication
result: [pending]

### 2. vercel.json Cleanup
expected: `maguey-pass-lounge/vercel.json` has no `rewrites` section (no `your-backend.example.com` placeholder), no `env` block with deprecated `@` references, valid JSON structure with build/install/output config preserved
result: [pending]

### 3. Security Headers Preserved
expected: `maguey-pass-lounge/vercel.json` contains all 10 security headers: Content-Security-Policy, X-Frame-Options (DENY), X-Content-Type-Options (nosniff), Referrer-Policy, Permissions-Policy, Strict-Transport-Security (HSTS with preload), X-XSS-Protection, Cross-Origin-Embedder-Policy, Cross-Origin-Opener-Policy, Cross-Origin-Resource-Policy
result: [pending]

### 4. GitHub Repository Secrets
expected: 7 secrets configured at GitHub repo Settings -> Secrets and Variables -> Actions: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, STRIPE_TEST_PK, STRIPE_TEST_SK, SCANNER_TEST_EMAIL, SCANNER_TEST_PASSWORD
result: [pending]

### 5. Supabase Edge Function Secrets
expected: 8 production secrets configured in Supabase Dashboard -> Edge Functions -> Secrets: RESEND_API_KEY, RESEND_WEBHOOK_SECRET, EMAIL_FROM_ADDRESS, QR_SIGNING_SECRET (newly rotated, NOT the exposed one), ALLOWED_ORIGINS (specific domains, not *), OWNER_EMAIL, FRONTEND_URL, ENVIRONMENT. Plus: `ALTER DATABASE postgres SET app.qr_signing_secret = '...'` executed.
result: [pending]

### 6. Vercel Environment Variables
expected: 10 production environment variables set across 3 Vercel projects: pass-lounge (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_STRIPE_PUBLISHABLE_KEY, VITE_PURCHASE_SITE_URL), gate-scanner (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_PURCHASE_SITE_URL), maguey-nights (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_PURCHASE_SITE_URL). No VITE_QR_SIGNING_SECRET on any project.
result: [pending]

### 7. Production Sites Deployment
expected: All 3 production sites load without console errors. Marketing site (magueynightclub.com) shows events. Purchase site (tickets.magueynightclub.com) loads with Stripe Elements. Scanner site (staff.magueynightclub.com) shows login page. No requests to `your-backend.example.com` in Network tab.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0

## Gaps

[none yet]
