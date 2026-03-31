# Maguey Nightclub Live — Project Backlog

> Last updated: 2026-03-02

---

## Deployment Blockers (2 remaining)

These must be completed before going live. All code-level fixes are done — these are credential/config tasks.

- [ ] **Switch Stripe to production keys** — Replace `pk_test_` / `sk_test_` in Vercel env vars (VITE_STRIPE_PUBLISHABLE_KEY on pass-lounge) and Supabase Edge Function secrets (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET). Currently `.env` has test publishable key.
- [ ] **Configure GitHub Secrets for CI/CD** — Add 8 secrets to repo settings: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, STRIPE_TEST_PK, STRIPE_TEST_SK, SCANNER_TEST_EMAIL, SCANNER_TEST_PASSWORD, VERCEL_TOKEN. Pipeline exists at `.github/workflows/e2e.yml` but cannot run without these.

---

## Exhaustive 15-Pillar Audit Remediation (Critical & High)

These items were discovered during the March 2026 System Audit and must be systematically addressed.

### Security (Pillars 6, 7, 8)
- [ ] **Audit-01:** Revoke `anon` execute privileges on sensitive RPCs (`rollback_vip_checkout`, `create_unified_vip_checkout`, `create_order_with_tickets_atomic`) in `maguey-pass-lounge`.
- [ ] **Audit-02:** Add explicit `auth.getUser()` server-side validation to 28 Edge Functions across `maguey-gate-scanner` and `maguey-pass-lounge`.
- [ ] **Audit-03:** Standardize Stripe Webhook cryptographic signature verification (`constructEvent`) across all generic handlers.
- [ ] **Audit-04:** Implement strict idempotency checks (`verifyIdempotency`) for all webhook transaction insertions.

### Performance & Caching (Pillars 2, 5, 9)
- [ ] **Audit-05:** Refactor global Contexts (`AuthContext`, `BrandingContext`) in `maguey-gate-scanner` to use `useMemo` for Provider object literals to prevent cascade re-renders.
- [ ] **Audit-06:** Audit and replace 171 instances of `.select('*')` with explicit column projections (e.g., `.select('id, name')`) to prevent over-fetching and memory bloat.
- [ ] **Audit-07:** Implement missing `queryClient.invalidateQueries` after mutations in `maguey-gate-scanner` to prevent stale data bugs.

### Resilience, TS, & UX (Pillars 3, 10, 12, 15)
- [ ] **Audit-08:** Replace 400+ instances of silent `catch (error) { console.error(error) }` with proper user-facing Toasts or re-throws to prevent silent UI hangs.
- [ ] **Audit-09:** Replace 40 instances of `.waitForTimeout()` in `maguey-pass-lounge` Playwright E2E tests with deterministic `waitForSelector`.
- [ ] **Audit-10:** Remove instances of `SupabaseClient<any>` and enforce strict `Database` schema types.
- [ ] **Audit-11:** Refactor 5 instances of `<div onClick={...}>` used for modal backdrops to use `role="button"` and `tabIndex={0}`.

---

## Production Environment Setup (Manual Dashboard Tasks)

These are one-time setup tasks done through service dashboards, not code changes.

- [ ] **Rotate QR signing secret** — Run `ALTER DATABASE postgres SET app.qr_signing_secret = 'NEW_RANDOM_SECRET'` in Supabase SQL Editor. Old secret may have been exposed during early development.
- [ ] **Set ALLOWED_ORIGINS env var** — In Supabase Edge Functions secrets, set `ALLOWED_ORIGINS=https://tickets.magueynightclub.com,https://staff.magueynightclub.com,https://magueynightclub.com`. Currently defaults to hardcoded production domains in `_shared/cors.ts`.
- [ ] **Rotate Resend email API key** — Generate new key at resend.com/api-keys, update in Supabase Edge Function secrets (RESEND_API_KEY). Old key was briefly exposed in client bundle during early development.
- [ ] **Verify Vercel env vars** — Confirm all 3 Vercel projects have correct environment variables set for production (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_STRIPE_PUBLISHABLE_KEY, VITE_APP_URL, VITE_PURCHASE_SITE_URL).
- [ ] **Verify Stripe webhook endpoint** — In Stripe Dashboard > Webhooks, confirm endpoint URL points to production Supabase Edge Function URL (not localhost or test URL).
- [ ] **Verify DNS / custom domains** — Confirm Vercel custom domains are configured: magueynightclub.com, tickets.magueynightclub.com, staff.magueynightclub.com.

---

## P1 — Code Quality & Data Accuracy

These improve reliability and maintainability but are not launch blockers.

### TypeScript
- [ ] **Enable strict mode in maguey-pass-lounge** — `tsconfig.json` has `strict: false`, `noImplicitAny: false`, `strictNullChecks: false`. Maguey-nights already has strict mode enabled (Phase 22-04). Expect 100+ type errors to fix.
- [ ] **Enable strict mode in maguey-gate-scanner** — Same as above. `tsconfig.json` has `strict: false`.

### Test Coverage
- [ ] **Add tests for stripe-webhook/index.ts** — 1,489 lines with zero test coverage. Handles Stripe checkout.session.completed, payment_intent.succeeded, charge.refunded, and more. Critical payment path.
- [ ] **Expand scanner unit tests** — simple-scanner.ts (939 lines) has limited test coverage via scanner-service.test.ts.

### Data Accuracy
- [ ] **Fix ticket_count on orders table** — Always returns 0. Either add a computed column (`SELECT COUNT(*) FROM tickets WHERE order_id = orders.id`) or update it during order creation in `create_order_with_tickets_atomic`.
- [ ] **Fix ticket_type on orders table** — Always shows "General". Store the primary ticket type name during order creation.

### Code Cleanup
- [ ] **Remove /typography route from pass-lounge** — Dev-only typography reference page, should not be in production build. Gate behind `import.meta.env.DEV` or remove.
- [ ] **Remove /test-tickets route from pass-lounge** — Test ticket viewer, should be gated behind DEV mode.
- [ ] **Clean up root markdown files** — ~35 debug/analysis markdown files at project root (BLANK_SCREEN_FIX.md, DEBUG_BLANK_SCREENS.md, QUICK_FIX_BLANK_SCREENS.md, etc.). Consolidate useful ones into docs/ or delete stale ones.
- [ ] **Remove deploy_payload.json** — Untracked file at pass-lounge root, likely a build artifact.

---

## P2 — Future Enhancements

Nice-to-haves for future development cycles.

- [ ] **Restaurant payment integration** — RestaurantCheckout.tsx in maguey-nights has cart functionality but no Stripe integration. Would need a new Edge Function for restaurant orders.
- [ ] **Multi-venue support** — Currently single venue (Maguey Delaware). DB has venues/venue_branding tables ready but UI is single-venue.
- [ ] **Email template customization** — Owner can't edit email templates. Currently hardcoded HTML in stripe-webhook and process-email-queue Edge Functions.
- [ ] **Push notifications** — DB infrastructure exists (notification tables) but no browser push or mobile notification implementation.
- [ ] **SMS notifications via Twilio** — maguey-gate-scanner has Twilio dependency installed but SMS sending is not implemented in production flows.
- [ ] **PWA / mobile app wrapper** — Both scanner and pass-lounge could benefit from PWA manifest for install prompts, especially scanner at the door.
- [ ] **Promo code management UI** — Promo codes exist in DB and are supported in checkout flow, but no admin UI for creating/managing them.
- [ ] **Event newsletter automation** — newsletter_subscribers table exists, newsletter_sent_at/count on events table exists, but no automated newsletter sending.
- [ ] **Ticket transfer / resale** — Not implemented. Tickets are tied to purchaser email.

---

## Completed (v2.0 — Phases 14-23, finished 2026-02-15)

### Phase 14: Auth Foundation
- [x] Owner and employee accounts created in Supabase Auth
- [x] localStorage auth fallback gated behind `import.meta.env.DEV`
- [x] Auth state management refactored

### Phase 15: Auth Hardening & Login Flows
- [x] Owner login at /auth/owner (email/password, info@magueynightclub.com)
- [x] Employee login at /auth/employee (PIN/simple auth)
- [x] Auth.tsx simplified to pure redirect logic (45 lines, no demo buttons)
- [x] Demo quick-access buttons removed

### Phase 16: Route Protection
- [x] ProtectedRoute wrapper created for both apps
- [x] All 33+ dashboard routes wrapped with role checks
- [x] Unauthorized.tsx (403) pages created
- [x] DEV-only route gating (requireDev prop)

### Phase 17: Security Lockdown
- [x] QR signing secret moved to server-side (verify-qr-signature Edge Function)
- [x] VITE_QR_SIGNING_SECRET removed from all client bundles
- [x] CORS centralized in _shared/cors.ts with ALLOWED_ORIGINS env var
- [x] VIP anonymous RLS policies removed (migration 20260213000000)
- [x] Unsigned QR codes now rejected (was: accepted with warning)

### Phase 18: Scanner Improvements
- [x] Auto-detect tonight's event by date match
- [x] Offline unknown ticket warning/rejection
- [x] Failed scan logging to server (logFailedScan in simple-scanner.ts)
- [x] Manual entry rate limiting

### Phase 19: Dashboard Data Accuracy
- [x] Real revenue trend calculations (was: hardcoded 12.5%, 8.2%, -3.1%)
- [x] Staff names shown instead of UUIDs (join user profiles)
- [x] Real-time subscription optimization

### Phase 20: Dashboard & UI Bloat Cleanup
- [x] Monitoring pages gated behind DEV (Circuit Breakers, Rate Limits, Query Performance, Traces)
- [x] Owner sidebar simplified to 8 production items (Dashboard, Events, Ticket Sales, VIP Tables, Analytics, Staff, Audit Log, Settings)
- [x] Advanced Analytics simplified
- [x] NFC features gated behind DEV

### Phase 21: VIP & Events Polish
- [x] VIP drag-drop floor plan via @dnd-kit/core (database-persisted positions)
- [x] VIP invite sharing via Web Share API
- [x] Marketing site fallback events removed (Supabase-only)
- [x] Marketing site SEO (sitemap, robots.txt, structured data)

### Phase 22: Code Quality & Refactoring
- [x] orders-service.ts split from 2,600 lines into 8 modules in src/lib/orders/
- [x] AuthContext.tsx (pass-lounge) split from 840 lines into 81-line shell + 3 hooks
- [x] Gate-scanner components organized into 9 subdirectories (was: flat)
- [x] TypeScript strict mode enabled in maguey-nights (zero errors)

### Phase 23: CI/CD & Production Deployment
- [x] GitHub Actions pipeline: lint → unit-test → build → e2e (4 parallel Cypress containers)
- [x] Vercel deployment configuration cleaned up
- [x] Production environment documentation
- [x] Security headers verified at deployment level

---

## Completed (v1.0 — Phases 1-13, finished 2026-02-09)

28/28 requirements verified. Includes: ticket purchase flow, VIP booking, QR generation, email delivery, scanner with offline support, owner dashboard, event management, security headers, atomic transactions, fraud detection. Full details in `.planning/STATE.md`.
