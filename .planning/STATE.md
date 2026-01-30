# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-29)

**Core value:** Customers can buy tickets/VIP tables, receive QR codes, and get scanned at the door seamlessly — a complete end-to-end flow that rivals Ticketmaster and Eventbrite.
**Current focus:** Phase 2 - Email Reliability

## Current Position

Phase: 2 of 12 (Email Reliability)
Plan: 3 of 6 complete
Status: In progress
Last activity: 2026-01-30 — Completed 02-02-PLAN.md (Queue processor edge function)

Progress: [█████████░] 12.5% (9/72 plans)

### Phase 2 Plans

| Plan | Objective | Status |
|------|-----------|--------|
| 02-01 | Email queue schema (email_queue, email_delivery_status) | Complete |
| 02-02 | Queue processor edge function | Complete |
| 02-03 | Resend webhook handler | Complete |
| 02-04 | Email templates (GA ticket, VIP confirmation) | Pending |
| 02-05 | Integration with existing checkout flows | Pending |
| 02-06 | Email delivery tests | Pending |

### Phase 1 Plans

| Plan | Objective | Status |
|------|-----------|--------|
| 01-01 | Database constraints and payment_failures table | Complete |
| 01-02 | Webhook idempotency and non-blocking email | Complete |
| 01-03 | Frontend error handling with toast/retry | Complete |
| 01-04 | Owner notification system for payment failures | Complete |
| 01-05 | Failure scenario tests (E2E + integration) | Complete |
| 01-06 | Load tests for 50 concurrent payments | Complete |

## Performance Metrics

**Velocity:**
- Total plans completed: 9
- Average duration: 3.3 min
- Total execution time: 0.5 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 6 | 21 min | 3.5 min |
| 02 | 3 | 9 min | 3 min |

**Recent Trend:**
- Last 5 plans: 02-02 (2 min), 02-03 (1 min), 02-01 (6 min), 01-06 (2 min), 01-05 (est)
- Trend: Fast (clear patterns from research, focused plans)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

| Date | Plan | Decision | Rationale |
|------|------|----------|-----------|
| 2026-01-29 | 01-01 | Partial unique indexes for nullable columns | Standard constraints don't handle NULLs correctly in PostgreSQL |
| 2026-01-29 | 01-01 | RLS allows all authenticated users | No owner_assignments table exists; can restrict later |
| 2026-01-29 | 01-01 | 30-day idempotency retention | Extended from 7 days for extra protection against late duplicates |
| 2026-01-29 | 01-02 | Check idempotency before signature verification | Reduces processing load for replay attacks |
| 2026-01-29 | 01-02 | Fail-open on idempotency errors | Availability over strict deduplication |
| 2026-01-29 | 01-02 | Fire-and-forget email pattern | Ensures webhook responds within 5s timeout |
| 2026-01-29 | 01-03 | Toast notifications for payment errors | User decision: toast (not modal), 5s auto-dismiss, retry button |
| 2026-01-29 | 01-03 | Shared payment-errors.ts utility | Centralized error handling for consistent GA/VIP UX |
| 2026-01-29 | 01-03 | No technical details in error messages | User-friendly messages only ("Payment failed. Please try again.") |
| 2026-01-29 | 01-04 | 5 retries with 500ms base delay | Balances resilience with webhook timeout constraints |
| 2026-01-29 | 01-04 | Fire-and-forget notifications | Owner notification must not block webhook response |
| 2026-01-29 | 01-04 | Return 200 on ticket creation failure | Payment succeeded, Stripe shouldn't retry. Failure logged for manual resolution. |
| 2026-01-29 | 01-05 | E2E tests use route interception | App uses Stripe Checkout (redirect), so error tests intercept session creation calls |
| 2026-01-29 | 01-05 | Webhook tests are documentation-focused | Without valid Stripe signatures, tests document expected behavior |
| 2026-01-29 | 01-06 | 50 VUs target for load tests | Per user decision: typical busy night capacity |
| 2026-01-29 | 01-06 | p95 < 5s checkout, p95 < 3s webhooks | Performance thresholds for acceptable UX |
| 2026-01-30 | 02-01 | Email-based RLS using recipient_email | Ticket system uses anonymous purchases, ownership via email match |
| 2026-01-30 | 02-01 | 5 max retries with exponential backoff | 30s base, max 30 min wait between retries |
| 2026-01-30 | 02-01 | SECURITY DEFINER for queue functions | Queue operations need to bypass RLS for service-level operations |
| 2026-01-30 | 02-03 | svix for Resend webhook verification | Resend uses Svix infrastructure for webhook delivery |
| 2026-01-30 | 02-03 | Raw body before parsing | Signature verification requires exact body bytes |
| 2026-01-30 | 02-03 | email.complained treated as failure | Spam complaints should prevent future sends |
| 2026-01-30 | 02-02 | Batch size of 10 emails per minute | Prevents hitting Resend rate limits |
| 2026-01-30 | 02-02 | Optimistic locking for queue processing | Prevents double-processing by concurrent invocations |
| 2026-01-30 | 02-02 | pg_cron setup via Dashboard | Secrets cannot be stored in migrations |

### Pending Todos

- Configure OWNER_EMAIL environment variable in Supabase Dashboard
- Install k6 for load testing: `brew install k6`
- Set up RESEND_API_KEY environment variable for email sending (Phase 2)
- Set up RESEND_WEBHOOK_SECRET environment variable for webhook verification (Phase 2)
- Configure Resend webhook endpoint in Resend Dashboard (Phase 2)
- Configure pg_cron job for process-email-queue (Phase 2) - see migration docs

### Blockers/Concerns

**Launch Hardening Focus:**
This is brownfield work — all features are built. Roadmap focuses on reliability, testing, and polish. No new features should be added during launch prep unless critical for go-live.

**Cross-Phase Dependencies:**
- Phases 8-9 (E2E testing) depend on Phases 1-4 (core hardening) being complete
- Phase 10 (load testing) requires E2E flows validated first
- Phase 12 (launch review) is gate for production deployment

**Migration Naming:**
Several pre-existing migrations had non-standard naming. Repaired during 02-01 execution.

## Session Continuity

Last session: 2026-01-30T02:29:06Z
Stopped at: Completed 02-02-PLAN.md (Queue processor edge function)
Resume file: None
