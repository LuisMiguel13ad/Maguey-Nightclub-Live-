# Codebase Concerns

**Analysis Date:** 2026-01-29

## Tech Debt

**Large Monolithic Services:**
- Issue: Core services exceed 2700 lines (orders-service) and 1370 lines (events-service)
- Files: `maguey-pass-lounge/src/lib/orders-service.ts` (2730 lines), `maguey-pass-lounge/src/lib/events-service.ts` (1370 lines)
- Impact: Difficult to test, maintain, and reason about. High risk of introducing bugs during refactoring.
- Fix approach: Break into domain-specific modules (payment-handling, ticket-validation, inventory-management). Extract sagas into separate orchestration layer.

**Multiple VIP System Migrations:**
- Issue: 37 migration files with several incomplete/duplicate VIP implementations (dated 20260122, 20260128, 20260129)
- Files: `maguey-pass-lounge/supabase/migrations/` (multiple 20260128_*.sql and 20250129_restore_vip_functions.sql files)
- Impact: Difficult to understand current schema state. Risk of applying wrong migrations. Database schema documentation is fragmented.
- Fix approach: Consolidate VIP schema into single canonical migration. Archive old migrations. Create migration audit trail documenting what each version changed and why.

**Test Files Left at Root:**
- Issue: Multiple TypeScript test/debug scripts at project root (check-schema.ts, check-rpc.ts, check-ticket-token.ts, seed-vip-reservation.ts, verify-linked-ticket.ts, types_dump.ts)
- Files: Root directory contains `check-*.ts`, `verify-*.ts`, `seed-*.ts`, `types_dump.ts`
- Impact: Creates confusion about project structure. May get accidentally committed. Difficult to distinguish dev tools from project code.
- Fix approach: Move all to `scripts/` directory or `tools/` directory. Add to .gitignore if temporary.

**Untracked HTML Debug File:**
- Issue: `apply_vip_fix.html` (21KB) in root directory appears to be a debug/migration assistant
- Files: `apply_vip_fix.html`
- Impact: Dead code taking up space. May contain sensitive debugging information.
- Fix approach: Move to archived directory or remove if no longer needed. Document any critical logic in migration guides.

**Environment Configuration in Supabase Functions:**
- Issue: Environment variables loaded multiple ways with fallbacks (`VITE_EMAIL_API_KEY` vs `RESEND_API_KEY`, `VITE_SUPABASE_URL` vs `SUPABASE_URL`)
- Files: `maguey-pass-lounge/supabase/functions/stripe-webhook/index.ts` (lines 78-80, 289-290)
- Impact: Inconsistent naming increases risk of misconfiguration. Hard to audit which env vars are actually needed.
- Fix approach: Establish single canonical env var names across all functions. Document in setup guide.

**Stripe Circuit Breaker Bypass in VIP Payments:**
- Issue: `createVipPaymentIntent()` in stripe.ts explicitly bypasses circuit breaker protection (line 444 comment)
- Files: `maguey-pass-lounge/src/lib/stripe.ts` (line 444)
- Impact: VIP payments not protected from cascading failures. If Stripe API is down, VIP reservations can fail catastrophically.
- Fix approach: Apply circuit breaker to VIP payment intent creation. Test circuit state before attempting payment.

**No Automatic Webhook Signature Verification in Development:**
- Issue: Webhook signature verification skipped if no secret configured (stripe-webhook index.ts, lines 481-482)
- Files: `maguey-pass-lounge/supabase/functions/stripe-webhook/index.ts` (lines 481-482)
- Impact: In development/testing without STRIPE_WEBHOOK_SECRET, malicious requests could trigger order/ticket creation without authentication
- Fix approach: Require webhook secret even in development. Use test secret from Stripe dashboard. Add warning logs if skipping verification.

**Hard-coded Port Numbers and URLs:**
- Issue: Frontend URLs and ports scattered across email templates and migration documentation
- Files: `maguey-pass-lounge/supabase/functions/stripe-webhook/index.ts` (line 80), various .md docs
- Impact: Difficult to change deployment targets. Risk of hardcoded production URLs in test environments.
- Fix approach: Centralize URL configuration. Pass frontend URL as environment variable to all functions. Use config layer for domain/port.

## Known Bugs

**VIP Guest Pass Signature Generation Inconsistency:**
- Symptoms: QR codes generated in webhook may not match signatures verified in scanner
- Files: `maguey-pass-lounge/supabase/functions/stripe-webhook/index.ts` (lines 613-620, 873-879)
- Trigger: When VIP guest passes are created in webhook, signature format may differ from database-generated signatures
- Workaround: Verify both HMAC-SHA256 (from webhook) and SHA-256 (from database RPC) formats during scanning

**Unused Sidebar/Layout Components:**
- Symptoms: Sidebar component imported but not used in some page layouts
- Files: Multiple pages may import unused sidebar utilities
- Trigger: Page routing doesn't activate sidebar - components remain in DOM but unmounted
- Workaround: Check browser DevTools for unused imports before each release

**Port Configuration Inconsistency (PORT_CHANGES.md vs Vite configs):**
- Symptoms: PORT_CHANGES.md documents ports 3015-3017, but comment references old 3010-3011
- Files: `/PORT_CHANGES.md` (lines 33-34), `vite.config.ts` files
- Trigger: When developers read PORT_CHANGES.md and follow old instructions
- Workaround: Always check actual vite.config.ts for current port configuration

## Security Considerations

**Credentials in Environment Variables:**
- Risk: Stripe keys, Supabase keys, RESEND API keys, and QR signing secrets stored in .env files
- Files: `.env`, `.env.bak`, `.env.local` files across three projects
- Current mitigation: .env files in .gitignore (assumed), env-example files provided
- Recommendations:
  1. Add pre-commit hook to prevent .env commits
  2. Use Vault or AWS Secrets Manager for production secrets
  3. Document all required env vars with descriptions
  4. Never log sensitive values (already doing this in logger)

**Anon Key Exposed in Stripe/VIP Functions:**
- Risk: VITE_SUPABASE_ANON_KEY passed in request headers to Edge Functions
- Files: `maguey-pass-lounge/src/lib/stripe.ts` (lines 157-158), `maguey-pass-lounge/supabase/functions/` (all functions)
- Current mitigation: Anon key is public key (intended use), RLS policies restrict data access
- Recommendations:
  1. Verify RLS policies block unauthorized table access
  2. Use row-level policies to restrict vip_reservations to owner only
  3. Add IP whitelisting for Edge Functions if possible
  4. Implement rate limiting per API key

**QR Token Exposed in Email HTML:**
- Risk: VIP guest QR tokens visible in plaintext in confirmation emails
- Files: `maguey-pass-lounge/supabase/functions/stripe-webhook/index.ts` (line 114, email template)
- Current mitigation: Tokens are single-use and tied to reservation ID
- Recommendations:
  1. Don't display raw token in email body - use links instead
  2. Hash tokens in transit/display and verify during scanning
  3. Add expiration to QR tokens (currently no TTL)
  4. Log all QR token validations for audit trail

**Missing Input Validation on Email Addresses:**
- Risk: Customer email stored without validation, could cause email delivery issues
- Files: Multiple places in orders-service, stripe.ts, webhook handlers
- Current mitigation: Email captured from Stripe session (already validated by Stripe)
- Recommendations:
  1. Add explicit email format validation before storage
  2. Implement email verification flow for all users
  3. Add retry logic for email failures

**Metadata Stored Without Schema Validation:**
- Risk: `package_snapshot` and other metadata stored as JSON without schema enforcement
- Files: `maguey-pass-lounge/supabase/functions/stripe-webhook/index.ts` (line 577-587)
- Current mitigation: TypeScript types define expected structure
- Recommendations:
  1. Add Zod validation schemas for all metadata structures
  2. Validate before database insert
  3. Add migration to validate existing metadata

## Performance Bottlenecks

**N+1 Query in VIP Confirmation Email:**
- Problem: Email generation in webhook fetches events, tables, and guest passes separately (webhook lines 998-1016)
- Files: `maguey-pass-lounge/supabase/functions/stripe-webhook/index.ts` (lines 998-1016)
- Cause: Separate queries for eventData, fullReservation, guestPassesData instead of single join
- Improvement path: Use single query with select(*) and nested table relations to fetch all data at once

**Cache Invalidation Too Broad:**
- Problem: Availability cache invalidation uses prefix wildcard, invalidating all availability caches
- Files: `maguey-pass-lounge/src/lib/orders-service.ts` (line 103)
- Cause: `cache.deleteByPrefix('availability:')` clears all caches even for unaffected events
- Improvement path: Only invalidate specific event and ticket type caches involved in order

**Large Circuit Breaker State Tracking:**
- Problem: Each circuit breaker maintains full state change history in memory
- Files: `maguey-pass-lounge/src/lib/circuit-breaker.ts`
- Cause: No limits on state change listeners or event history
- Improvement path: Implement circular buffer for last N state changes. Clean up dead listeners periodically.

**VIP Tables Query Performance:**
- Problem: EventVipTables with all relations may be slow for high-capacity events
- Files: `maguey-pass-lounge/src/lib/vip-tables-service.ts`
- Cause: Multiple joined table fetches without pagination
- Improvement path: Add pagination to VIP table lists. Use indexed queries on event_id + availability flags.

## Fragile Areas

**VIP Reservation Payment State Machine:**
- Files: `maguey-pass-lounge/supabase/functions/stripe-webhook/index.ts` (lines 816-1052)
- Why fragile: Complex state transitions (pending → confirmed → checked_in) with multiple data modifications. If any step fails, partial data leaves system in inconsistent state.
- Safe modification: Use database transactions for all state transitions. Add idempotency tokens to webhook processing.
- Test coverage: Need integration tests for full payment→reservation→email flow. Currently only unit tests.

**Webhook Signature Verification:**
- Files: `maguey-pass-lounge/supabase/functions/stripe-webhook/index.ts` (lines 388-428)
- Why fragile: Manual HMAC-SHA256 calculation must match Stripe's implementation exactly. Off-by-one in timestamp parsing breaks verification.
- Safe modification: Use Stripe's official verification library if available for Deno. Add test vectors from Stripe documentation.
- Test coverage: Mock Stripe webhook signatures and test against real verification logic.

**QR Code Generation and Validation:**
- Files: Multiple files generate QR tokens (crypto.randomUUID), different formats for VIP vs GA tickets
- Why fragile: No centralized token format. VIP tokens use "VIP-..." prefix, GA uses UUID. Migration risk if format changes.
- Safe modification: Create TokenGenerator interface. Implement for each format. Test round-trip through scanner.
- Test coverage: Missing: scanner integration tests that verify actual QR codes work end-to-end.

**Email Queue and Resend Integration:**
- Files: `maguey-pass-lounge/src/lib/email-queue.ts`, webhook email sending
- Why fragile: Email failures don't fail the order. If Resend is down, customer gets no confirmation.
- Safe modification: Implement email retry queue with exponential backoff. Add admin UI to resend failed emails.
- Test coverage: Missing tests for Resend API failures. Only success paths tested.

**Large Page Components (1000+ lines):**
- Files: `maguey-pass-lounge/src/pages/VIPBookingForm.tsx` (1204 lines), `Checkout.tsx` (1082 lines), `VipPayment.tsx` (894 lines)
- Why fragile: Multiple responsibilities, hard to isolate bugs. State management scattered across component.
- Safe modification: Extract form logic into custom hooks. Extract state into Context. Break into sub-components.
- Test coverage: Large components harder to unit test. Need to split before improving coverage.

## Scaling Limits

**In-Memory Cache Without Size Limits:**
- Current capacity: No limit specified for cache entries
- Limit: In long-running processes, cache could consume unbounded memory
- Scaling path: Add max-size limit with LRU eviction. Use Redis for distributed cache if multiple instances.

**Stripe Webhook Queue Unbounded:**
- Current capacity: All webhook events processed immediately, no queue
- Limit: High traffic spike could overwhelm Edge Function CPU
- Scaling path: Add Pub/Sub queue for webhook events. Process asynchronously with concurrency control.

**RLS Policy Complexity:**
- Current capacity: Each table has multiple RLS policies for different user types
- Limit: Policy evaluation time increases with number of policies and complexity
- Scaling path: Document all policies. Consolidate where possible. Add indexes on RLS policy columns (user_id, event_id).

**Email Sending Throughput:**
- Current capacity: Single Resend API calls per webhook, no batching
- Limit: Rate limits on Resend API could block email sending
- Scaling path: Implement email queue with batch sending. Add async email processing separate from webhook.

## Dependencies at Risk

**Outdated Supabase Client:**
- Risk: @supabase/supabase-js@^2.78.0 (Jan 2025). Check for security patches regularly.
- Impact: If vulnerable version exists, auth/database operations could be compromised
- Migration plan: Monthly dependency audit. Update to latest patch version. Test against staging environment.

**Stripe.js Library Pinning:**
- Risk: @stripe/stripe-js@^8.3.0 with caret allows major version updates automatically
- Impact: Major version update could change payment flow behavior unexpectedly
- Migration plan: Change to ~8.3.0 (patch updates only). Review Stripe changelog before major upgrades.

**Three.js and Vanta Visual Dependencies:**
- Risk: three@^0.182.0 and vanta@0.5.24 are heavy dependencies only used for animations
- Impact: Large bundle size. If library becomes unmaintained, no updates available
- Migration plan: Consider swapping for lightweight CSS-based animations. Lazy-load if used only on marketing pages.

**Resend Email Service Lock-in:**
- Risk: Custom email sending tightly coupled to Resend API
- Impact: Switching providers requires refactoring email generation and sending
- Migration plan: Create email provider abstraction interface. Implement Resend adapter. Support switching to SendGrid/Mailgun.

## Missing Critical Features

**No Email Retry Mechanism:**
- Problem: If Resend fails, customer gets no ticket/confirmation email. No way to retry.
- Blocks: Email confirmations for large batches. Recovery from Resend outages.
- Fix approach: Add email queue table. Implement async worker to retry failed emails. Add admin UI to view/retry emails.

**No Audit Trail for VIP Operations:**
- Problem: VIP reservation changes (status updates, checkins) not logged with who changed them
- Blocks: Compliance audits. Dispute resolution. Understanding what happened to a reservation.
- Fix approach: Add audit_log table. Log all VIP operations with timestamp, user, old value, new value.

**No Rate Limiting on Endpoints:**
- Problem: No protection against brute force on login/signup or API spam
- Blocks: Cannot scale to production with DOS protection.
- Fix approach: Implement rate limiting per IP/email. Add CAPTCHA for signup. Use Cloudflare/WAF.

**No Health Check Endpoints:**
- Problem: Cannot monitor if system is functioning. No liveness/readiness probes.
- Blocks: Kubernetes deployments. Load balancer health checks.
- Fix approach: Add /health and /ready endpoints. Check database connectivity, Stripe API, email service.

**No Observability Dashboard:**
- Problem: Cannot see system metrics, errors, or performance in one place
- Blocks: Debugging issues in production. Understanding bottlenecks.
- Fix approach: Set up Grafana dashboard pulling from monitoring and metrics exports. Configure Sentry for error tracking.

## Test Coverage Gaps

**Payment Flow Not Fully Tested:**
- What's not tested: Checkout session creation → Stripe payment → webhook processing → ticket issuance. End-to-end flow missing.
- Files: `maguey-pass-lounge/supabase/functions/create-checkout-session/index.ts`, `stripe-webhook/index.ts`
- Risk: Payment could fail silently. Orders could be created without tickets. Critical revenue impact if bug introduced.
- Priority: High - this is core revenue flow

**VIP Reservation State Transitions Not Tested:**
- What's not tested: Pending → Confirmed → Checked-in → Completed flow with concurrent operations
- Files: `maguey-pass-lounge/src/lib/vip-tables-service.ts`, webhook handlers
- Risk: Race conditions during concurrent VIP checkins. Overbooking tables. State corruption.
- Priority: High - directly impacts VIP customer experience

**Webhook Idempotency Not Tested:**
- What's not tested: Duplicate webhook events handled correctly. Should not create duplicate tickets/reservations.
- Files: `maguey-pass-lounge/supabase/functions/stripe-webhook/index.ts`
- Risk: Stripe retries duplicate events → duplicate tickets created → inventory inconsistent
- Priority: High - webhook failures are common in production

**Scanner QR Verification Not Tested:**
- What's not tested: Invalid signatures rejected. Valid signatures accepted. Expired tokens handled.
- Files: `maguey-gate-scanner/src/lib/` (scanner verification logic)
- Risk: Invalid QRs accepted at gate. Valid QRs rejected. Security breach.
- Priority: Critical - gate security depends on this

**Email Generation Not Tested:**
- What's not tested: HTML email templates render correctly. All dynamic content interpolated. Special characters escaped.
- Files: `maguey-pass-lounge/src/lib/email-template.ts`, webhook email generation
- Risk: Customer emails malformed. QR tokens missing. Customer can't access event.
- Priority: High - customer communication is critical

**Race Condition in Inventory Management:**
- What's not tested: Two simultaneous checkout requests for last ticket. Only one should succeed.
- Files: `maguey-pass-lounge/src/lib/orders-service.ts`, RPC functions
- Risk: Overselling tickets. Negative inventory. Financial loss.
- Priority: Critical - inventory is currency

---

*Concerns audit: 2026-01-29*
