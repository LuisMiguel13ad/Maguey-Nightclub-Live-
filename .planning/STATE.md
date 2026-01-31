# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-29)

**Core value:** Customers can buy tickets/VIP tables, receive QR codes, and get scanned at the door seamlessly — a complete end-to-end flow that rivals Ticketmaster and Eventbrite.
**Current focus:** Phase 7 - UX Polish

## Current Position

Phase: 7 of 12 (UX Polish) - In Progress
Plan: 1 of 7 complete
Status: In progress
Last activity: 2026-01-31 — Completed 07-01-PLAN.md (Loading State UI Components)

Progress: [█████████████████████████████░] 49.3% (36/73 plans)

### Phase 7 Plans (In Progress)

| Plan | Objective | Wave | Status |
|------|-----------|------|--------|
| 07-01 | Loading state UI components | 1 | Complete |
| 07-02 | Checkout loading integration | 1 | Pending |
| 07-03 | Event listing skeletons | 1 | Pending |
| 07-04 | Form validation feedback | 2 | Pending |
| 07-05 | Error boundary components | 2 | Pending |
| 07-06 | Mobile touch feedback | 2 | Pending |
| 07-07 | Accessibility improvements | 3 | Pending |

### Phase 6 Plans (Complete)

| Plan | Objective | Wave | Status |
|------|-----------|------|--------|
| 06-01 | Health check endpoint | 1 | Complete |
| 06-02 | Rate limiting with Upstash Redis | 1 | Complete |
| 06-03 | Sentry integration for edge functions | 2 | Complete |
| 06-04 | Structured logging | 1 | Complete |
| 06-05 | Email alerts for critical errors | 3 | Complete |

### Phase 5 Plans

| Plan | Objective | Wave | Status |
|------|-----------|------|--------|
| 05-01 | Revenue discrepancies audit table + verify-revenue Edge Function | 1 | Complete |
| 05-02 | LiveIndicator + useDashboardRealtime hook | 1 | Complete |
| 05-03 | Revenue display components | 2 | Complete |
| 05-04 | Real-time dashboard updates | 2 | Complete |
| 05-05 | Event sync timing validation | 2 | Complete |

### Phase 4 Plans

| Plan | Objective | Wave | Status |
|------|-----------|------|--------|
| 04-01 | State transition enforcement (forward-only DB trigger) | 1 | Complete |
| 04-02 | Re-entry detection (VIP scan with re-entry support) | 1 | Complete |
| 04-03 | Realtime floor plan updates (Supabase subscriptions) | 1 | Complete |
| 04-04 | Owner event cancellation (bulk refund flow) | 2 | Complete |
| 04-05 | VIP scanner re-entry UI | 2 | Complete |
| 04-06 | GA scanner VIP link detection | 3 | Complete |
| 04-07 | Unified VIP checkout (GA + VIP in single purchase) | 2 | Complete |

### Phase 3 Plans

| Plan | Objective | Wave | Status |
|------|-----------|------|--------|
| 03-01 | Full-screen feedback overlays (success/rejection) | 1 | Complete |
| 03-02 | Offline ticket cache service with race condition handling | 1 | Complete |
| 03-03 | Scan history, check-in counter, offline banner | 2 | Complete |
| 03-04 | Enhanced error details and offline validation | 2 | Complete |
| 03-05 | Dashboard scanner status and human verification | 3 | Complete |

### Phase 2 Plans

| Plan | Objective | Status |
|------|-----------|--------|
| 02-01 | Email queue schema (email_queue, email_delivery_status) | Complete |
| 02-02 | Queue processor edge function | Complete |
| 02-03 | Resend webhook handler | Complete |
| 02-04 | Webhook email queueing (stripe-webhook integration) | Complete |
| 02-05 | Owner dashboard email status | Complete |
| 02-06 | Email delivery tests | Complete |

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
- Total plans completed: 36
- Average duration: 3.1 min
- Total execution time: 2.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 6 | 21 min | 3.5 min |
| 02 | 6 | 18 min | 3.0 min |
| 03 | 5 | 41 min | 8.2 min |
| 04 | 7 | 26 min | 3.7 min |
| 05 | 5 | 16 min | 3.2 min |
| 06 | 5 | 15 min | 3.0 min |
| 07 | 1 | 2 min | 2.0 min |

**Recent Trend:**
- Last 5 plans: 07-01 (2 min), 06-05 (3 min), 06-04 (3 min), 06-03 (4 min), 06-02 (2 min)
- Trend: Consistent fast execution

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
| 2026-01-30 | 02-04 | queueEmail doesn't throw | Webhook must return 200 to Stripe for successful payments |
| 2026-01-30 | 02-04 | Email HTML generated before queueing | Synchronous HTML generation avoids lazy rendering issues |
| 2026-01-30 | 02-04 | supabase client passed to email functions | Required for queue insertion access |
| 2026-01-30 | 02-05 | Show last 5 emails in dashboard | Quick visibility without overwhelming UI |
| 2026-01-30 | 02-05 | Map for O(1) status lookup | Efficient matching by related_id |
| 2026-01-30 | 02-05 | Real-time subscription for email_queue | Instant updates when emails change status |
| 2026-01-30 | 02-06 | Behavior specification tests for edge functions | Deno runtime required; tests document expected behavior with assertions |
| 2026-01-30 | 02-06 | 36 tests covering queue and webhook behavior | 18 tests each for queue processor and webhook handler |
| 2026-01-30 | 03-01 | GA minimal display, VIP full details | GA throughput prioritized; VIP needs table info for seating staff |
| 2026-01-30 | 03-01 | 1.5s auto-dismiss for success | Per context decision - quick return to scanning |
| 2026-01-30 | 03-01 | Manual dismiss required for rejection | Staff must acknowledge rejection before next scan |
| 2026-01-30 | 03-01 | Full red screen for all rejection types | No color-coding by reason per context decision |
| 2026-01-30 | 03-02 | Partial unique index for race condition prevention | Only successful scans constrained (WHERE scan_success = true) |
| 2026-01-30 | 03-02 | Row-level locking with NOWAIT | Immediate rejection of concurrent scans via FOR UPDATE NOWAIT |
| 2026-01-30 | 03-02 | First-scan-wins conflict resolution | Timestamp comparison for offline sync determines winner |
| 2026-01-30 | 03-02 | 24-hour cache retention | Old event caches auto-cleaned per context decision |
| 2026-01-30 | 03-02 | Device ID in localStorage | Persistent device identification for conflict tracking |
| 2026-01-30 | 03-03 | Scan history limited to 10, displays 5 | Balance between visibility and screen real estate |
| 2026-01-30 | 03-03 | History only shown when idle | Hidden during success/rejection overlays |
| 2026-01-30 | 03-03 | Z-index hierarchy: offline(70), counter(65), nav(50), history(40) | Clear layering for proper overlay behavior |
| 2026-01-30 | 03-03 | CheckInCounter falls back to cache when offline | Uses getCheckedInCount from offline-ticket-cache |
| 2026-01-30 | 03-04 | Accept unknown tickets offline with warning | Tickets not in cache accepted, queued for verification when online |
| 2026-01-30 | 03-04 | Cache auto-refreshes on event selection | ensureCacheIsFresh called via useEffect when selectedEventId changes |
| 2026-01-30 | 03-04 | Rejection details flow through to overlays | ScanResult rejectionDetails passed directly to RejectionOverlay |
| 2026-01-30 | 04-01 | Array-based transition validation | Simple state machine doesn't need separate transition table |
| 2026-01-30 | 04-01 | confirmed→cancelled requires pre-event check | Business rule prevents cancellations during active events |
| 2026-01-30 | 04-01 | RAISE NOTICE for audit logging | Visible in Supabase logs, doesn't block transitions, simpler than table |
| 2026-01-30 | 04-01 | SECURITY DEFINER on trigger function | Ensures consistent execution context for database integrity rules |
| 2026-01-30 | 04-03 | Floor plan component self-contained | VIPTableFloorPlan fetches own data via useRealtimeFloorPlan hook |
| 2026-01-30 | 04-03 | Dual subscription approach | Subscribe to both vip_reservations (*) and event_vip_tables (UPDATE) |
| 2026-01-30 | 04-03 | Visual "Live" indicator | Pulsing green dot shows realtime subscriptions are active |
| 2026-01-31 | 04-07 | VIP purchaser MUST buy GA ticket | Context requirement enforced via required field validation in UI and edge function |
| 2026-01-31 | 04-07 | Unified QR code for entry + VIP host | GA ticket and VIP reservation share same qr_code_token for seamless check-in |
| 2026-01-31 | 04-07 | Auto-select first ticket tier | Reduces friction while maintaining required field constraint |
| 2026-01-31 | 04-07 | Rollback on Stripe failure | Delete ticket and reservation if payment intent creation fails |
| 2026-01-31 | 04-07 | vip_unified payment intent type | Metadata distinguishes unified checkouts from legacy VIP-only for webhook routing |
| 2026-01-31 | 04-04 | Events can only be cancelled before they start | Datetime check prevents cancellation of active events |
| 2026-01-31 | 04-04 | Only confirmed and checked_in reservations refundable | Pending reservations have no payment to refund |
| 2026-01-31 | 04-04 | Refund reason set to 'requested_by_customer' | Standard Stripe practice for event cancellations |
| 2026-01-31 | 04-04 | All tables reset to available after cancellation | Allows table reuse if event rescheduled |
| 2026-01-31 | 04-04 | Event cancellation_status column added | Tracks active vs cancelled events separately from other statuses |
| 2026-01-31 | 04-04 | Individual refund failures don't block others | Graceful degradation allows partial success scenarios |
| 2026-01-31 | 04-05 | Re-entry shown with gold 'RE-ENTRY GRANTED' banner and green success overlay | Re-entry preserves positive UX while being visually distinct |
| 2026-01-31 | 04-05 | Linked guests detected by guest_number === 0 | Differentiates GA tickets linked to VIP tables |
| 2026-01-31 | 04-05 | Last entry time formatted as HH:MM | Quick scanning readability for VIP staff |
| 2026-01-31 | 04-06 | VIP-linked GA tickets get re-entry privilege | Per 04-CONTEXT.md re-entry policy: VIP perk extends to linked guests |
| 2026-01-31 | 04-06 | Regular GA tickets remain one-time entry | Non-linked GA rejected on second scan to maintain standard policy |
| 2026-01-31 | 04-06 | Atomic guest count updates with row locking | increment_vip_checked_in uses FOR UPDATE to prevent race conditions |
| 2026-01-31 | 04-06 | Re-entry shows gold banner with VIP table info | Consistent with 04-05 VIP scanner re-entry UI pattern |
| 2026-01-31 | 05-01 | $1 discrepancy threshold for logging | Per RESEARCH.md - small timing discrepancies are normal |
| 2026-01-31 | 05-01 | Service role INSERT only for revenue_discrepancies | Prevents unauthorized discrepancy injection |
| 2026-01-31 | 05-01 | Authenticated SELECT/UPDATE for revenue_discrepancies | Owners need to view and mark resolved |
| 2026-01-31 | 05-02 | Pulsing green dot with animate-ping | Visual live indicator consistent with existing UI |
| 2026-01-31 | 05-02 | Visibility change triggers full data refresh | Catch up on missed updates when tab regains focus |
| 2026-01-31 | 05-02 | Channel names include timestamp | Prevent stale subscription conflicts |
| 2026-01-31 | 05-02 | onUpdate ref pattern | Prevents unnecessary re-subscriptions when callback changes |
| 2026-01-31 | 05-04 | Events filter for upcoming/published by default | useEventsRealtime filters to future events, excludes cancelled/draft |
| 2026-01-31 | 05-04 | Visibility change triggers data refresh | Tab regaining focus fetches latest data to catch missed updates |
| 2026-01-31 | 05-04 | CheckInProgress multi-event support | Component can display single event or aggregate multiple events |
| 2026-01-31 | 05-04 | Live indicator in Checkout | Pulsing green dot shows when real-time subscription is active |
| 2026-01-31 | 05-03 | 5-minute cache TTL for Stripe rate limits | Per RESEARCH.md pitfall on Stripe API rate limits |
| 2026-01-31 | 05-03 | Show BOTH figures when discrepancy | User decision: transparency over hiding discrepancies |
| 2026-01-31 | 05-03 | Month-to-date verification default | Practical default period for dashboard load |
| 2026-01-31 | 05-05 | Testing deferred to end-of-phase UAT | User decision: focus on completion, test at end |
| 2026-01-31 | 05-05 | Discrepancies export added to Advanced Export | Audit compliance for revenue verification history |
| 2026-01-31 | 06-02 | Fail-open pattern for rate limiting | Availability over strict rate limiting when Upstash unavailable |
| 2026-01-31 | 06-02 | Webhook endpoints exempt from rate limiting | Stripe/Resend webhooks have own replay protection |
| 2026-01-31 | 06-02 | Sliding window algorithm for rate limiting | More accurate than fixed window |
| 2026-01-31 | 06-02 | IP-based rate limiting via x-forwarded-for | Client identification using Supabase-set header |
| 2026-01-31 | 06-03 | defaultIntegrations: false for edge functions | Prevents scope contamination across concurrent requests |
| 2026-01-31 | 06-03 | await captureError() with 2s flush timeout | Ensures errors are sent before edge function terminates |
| 2026-01-31 | 06-03 | Filter ResizeObserver errors in frontend | Common browser noise that clutters Sentry dashboard |
| 2026-01-31 | 06-03 | VITE_SENTRY_DSN environment variable | Standard Vite pattern for frontend configuration |
| 2026-01-31 | 07-01 | min-w-[120px] on LoadingButton | Prevents button size change during loading state |
| 2026-01-31 | 07-01 | Skeleton dimensions match exact content layout | Zero layout shift during content loading |
| 2026-01-31 | 07-01 | Set-based loading state | Supports multiple concurrent loading operations |

### Pending Todos

- Configure OWNER_EMAIL environment variable in Supabase Dashboard
- Install k6 for load testing: `brew install k6`
- Set up RESEND_API_KEY environment variable for email sending (Phase 2)
- Set up RESEND_WEBHOOK_SECRET environment variable for webhook verification (Phase 2)
- Configure Resend webhook endpoint in Resend Dashboard (Phase 2)
- Configure pg_cron job for process-email-queue (Phase 2) - see migration docs
- Install Deno for edge function test execution (optional): `brew install deno`
- Set up UPSTASH_REDIS_REST_URL environment variable for rate limiting (Phase 6)
- Set up UPSTASH_REDIS_REST_TOKEN environment variable for rate limiting (Phase 6)
- Set up SENTRY_DSN environment variable in Supabase Dashboard for edge function error tracking (Phase 6)
- Set up VITE_SENTRY_DSN environment variable in frontend deployments for error tracking (Phase 6)

### Blockers/Concerns

**Launch Hardening Focus:**
This is brownfield work — all features are built. Roadmap focuses on reliability, testing, and polish. No new features should be added during launch prep unless critical for go-live.

**Cross-Phase Dependencies:**
- Phases 8-9 (E2E testing) depend on Phases 1-4 (core hardening) being complete
- Phase 10 (load testing) requires E2E flows validated first
- Phase 12 (launch review) is gate for production deployment

**Migration Naming:**
Several pre-existing migrations had non-standard naming. Repaired during 02-01 execution.

## Workflow Practices

### Cleanup After Each Milestone

After completing a milestone (set of phases), run a cleanup checkpoint:

**Quick Checklist:**
1. Dead imports/exports - Check for references to deleted files
2. Orphaned scripts - Debug scripts at root level should move to `/scripts/`
3. Migration state - Ensure all migrations are staged/committed
4. Documentation sync - Verify port numbers, URLs, and file paths are accurate

**Cleanup Structure:**
```
/scripts/
├── debug/    # Inspection and verification utilities
├── seed/     # Test data seeding scripts
└── e2e/      # End-to-end test scripts
```

**Last Cleanup:** 2026-01-31 (after Phase 5)
- Removed dead VIP component exports
- Deleted duplicate supabase file
- Organized 17 debug scripts into /scripts/
- Deleted 4 orphaned crew pages
- Consolidated VIP migrations

## Session Continuity

Last session: 2026-01-31
Stopped at: Completed 07-01-PLAN.md (Loading State UI Components)
Resume file: None
Next action: Continue Phase 7 - run /gsd:execute-phase with 07-02-PLAN.md
