# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-09)

**Core value:** Customers can buy tickets/VIP tables, receive QR codes, and get scanned at the door seamlessly — a complete end-to-end flow that rivals Ticketmaster and Eventbrite.
**Current focus:** v2.0 Launch Readiness — fixing P0 blockers and P1 issues from system analysis

## Current Position

**Milestone:** v2.0 Launch Readiness
Phase: 17 of 23 (Security Lockdown) — IN PROGRESS
Plan: 3 of 4
Status: IN PROGRESS
Last activity: 2026-02-14 — Plan 17-01 complete (Server-side QR verification, offline signature caching, P0 blocker R01 resolved)

Progress: [█████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 22% (8/36 plans)

### v2.0 Phase Status

| Phase | Name | Plans | Status |
|-------|------|-------|--------|
| 14 | Auth Foundation & Account Setup | 3/3 | Complete |
| 15 | Auth Hardening & Login Flows | 3/3 | Complete |
| 16 | Route Protection | 2/2 | Complete |
| 17 | Security Lockdown | 3/4 | In Progress |
| 18 | Scanner Improvements | 0/4 | Not Started |
| 19 | Dashboard Data Accuracy | 0/4 | Not Started |
| 20 | Dashboard & UI Bloat Cleanup | 0/4 | Not Started |
| 21 | VIP & Events Polish | 0/5 | Not Started |
| 22 | Code Quality & Refactoring | 0/4 | Not Started |
| 23 | CI/CD & Production Deployment | 0/3 | Not Started |

---

### Phase 14 Plans (Complete)

| Plan | Objective | Wave | Status |
|------|-----------|------|--------|
| 14-01 | Create Supabase Auth accounts (owner + employee) | 1 | Complete |
| 14-02 | Gate localStorage auth behind DEV flag | 2 | Complete |
| 14-03 | Credential & environment verification automation | 1 | Complete |

### Phase 15 Plans (Complete)

| Plan | Objective | Wave | Status |
|------|-----------|------|--------|
| 15-01 | Create owner login page at /auth/owner | 1 | Complete |
| 15-02 | Create employee login page at /auth/employee | 1 | Complete |
| 15-03 | Update /auth to redirect to /auth/employee | 2 | Complete |

### Phase 16 Plans (Complete)

| Plan | Objective | Wave | Status |
|------|-----------|------|--------|
| 16-01 | Create ProtectedRoute wrapper and Unauthorized page | 1 | Complete |
| 16-02 | Apply route protection to dashboard routes | 1 | Complete |

### Phase 17 Plans (In Progress)

| Plan | Objective | Wave | Status |
|------|-----------|------|--------|
| 17-01 | Move QR signing to server-side Edge Function | 1 | Not Started |
| 17-02 | Migrate all Edge Functions to shared CORS handler | 1 | Not Started |
| 17-03 | Remove anonymous VIP RLS access | 1 | Complete |
| 17-04 | Enforce unsigned QR rejection in scanner | 1 | Not Started |

### Phase 16 Complete

Both plans executed in wave 1. Created ProtectedRoute wrapper component with auth, role, and DEV-mode gating. Applied route protection to all 33 protected routes (4 employee routes with auth-only, 28 owner/monitoring routes with role restriction, 1 dev route with requireDev + owner). Added post-login redirect support using location.state.from for seamless return to intended destination. P0 blocker R06 (dashboard routes not protected at route level) RESOLVED.

### Phase 15 Complete

All 3 plans executed across 2 waves. Created specialized login pages (/auth/owner and /auth/employee) with role validation, touch-friendly mobile UI, and remember-me functionality. Replaced 1,110-line Auth.tsx with 52-line redirect component, eliminating all demo code (handleDemoLogin, promote-to-owner, quick access buttons). Updated all sign-out handlers with role-specific navigation and gated localStorage calls behind DEV. P0 blockers R08 (demo shortcuts) and R09 (localStorage in production) RESOLVED.

### Phase 14 Complete

All 3 plans executed across 2 waves. Real Supabase Auth accounts created for owner (info@magueynightclub.com, role:owner) and employee (Luismbadillo13@gmail.com, role:employee). All localStorage auth fallbacks gated behind import.meta.env.DEV — production builds only use Supabase sessions. Environment and credential consistency validated across all 3 sites.

---

### v1.0 History (Archived 2026-02-09)

### Phase 13 Plans (Complete)

| Plan | Objective | Wave | Status |
|------|-----------|------|--------|
| 13-01 | Consolidate QR signature validation (hex → base64) | 1 | Complete |
| 13-02 | Remove deprecated VIP webhook | 1 | Complete |

### Phase 13 Complete

Both gap closure plans executed in parallel. Scanner-service.ts consolidated from @noble/hashes hex to crypto.subtle base64, matching production webhook and simple-scanner. Deprecated vip/webhook endpoint removed. All 42 scanner tests pass.

### Phase 12 Plans (Complete)

| Plan | Objective | Wave | Status |
|------|-----------|------|--------|
| 12-01 | Requirements verification matrix | 1 | Complete |
| 12-02 | Environment & backup documentation | 1 | Complete |
| 12-03 | Go/No-Go decision | 2 | Complete |

### Phase 12 Complete

All 3 launch readiness review plans complete. Go/No-Go decision: **GO** with 100% weighted score (28/28 requirements verified). System is ready for production deployment.

### Phase 11 Plans (Complete)

| Plan | Objective | Wave | Status |
|------|-----------|------|--------|
| 11-01 | Orphan record prevention tests | 1 | Complete |
| 11-02 | Email failure test suite | 1 | Complete |
| 11-03 | Scanner offline recovery tests | 1 | Complete |
| 11-04 | Support runbook creation | 2 | Complete |

### Phase 11 Complete

All 4 error handling and recovery plans complete. Test suites validate payment failures, email delivery, and scanner offline mode. Support runbook documents troubleshooting procedures for venue operators.

### Phase 10 Plans (Complete)

| Plan | Objective | Wave | Status |
|------|-----------|------|--------|
| 10-01 | k6 infrastructure setup | 1 | Complete |
| 10-02 | Ticket purchase load test | 1 | Complete |
| 10-03 | Scanner burst load test | 1 | Complete |
| 10-04 | Dashboard load test | 2 | Complete |
| 10-05 | Webhook burst load test | 2 | Complete |

### Phase 10 Complete

All 5 load testing plans complete. k6 infrastructure with 4 test scenarios ready for execution.

### Phase 9 Plans (Complete)

| Plan | Objective | Wave | Status |
|------|-----------|------|--------|
| 09-01 | Migration verification and seed data setup | 1 | Complete |
| 09-02 | VIP checkout E2E test | 1 | Complete |
| 09-03 | Floor plan realtime updates test | 1 | Complete |
| 09-04 | Manual UAT: VIP scanner flows | 2 | Deferred |
| 09-05 | Manual UAT: GA+VIP link re-entry | 2 | Deferred |
| 09-06 | Concurrent check-in tests | 2 | Complete |
| 09-07 | Email delivery verification | 2 | Complete |

### Phase 8 Plans (Complete)

| Plan | Objective | Wave | Status |
|------|-----------|------|--------|
| 08-01 | Cypress E2E infrastructure setup | 1 | Complete |
| 08-02 | Health check and CI pipeline | 1 | Complete |
| 08-03 | GA happy path E2E tests | 1 | Complete |
| 08-04 | Edge case and offline E2E tests | 2 | Complete |

### Phase 9 Context Decisions (2026-01-31)

| Gray Area | Decision |
|-----------|----------|
| Migration Prerequisites | Verify first - Plan 1 checks all VIP RPCs exist |
| Testing Approach | Hybrid - Playwright for UI flows, manual UAT for scanner |
| Scanner Input | URL parameter `?qr=TOKEN` for testing |
| Offline Testing | DevTools Network offline simulation |
| Test Data | SQL seed script creates complete test data |
| Email Verification | Full delivery via Resend webhooks |
| Concurrent Check-ins | Database-level SQL concurrency test |

See: `.planning/phases/09-vip-end-to-end-testing/09-CONTEXT.md`

### Phase 7 Plans (Complete)

| Plan | Objective | Wave | Status |
|------|-----------|------|--------|
| 07-01 | Loading state UI components | 1 | Complete |
| 07-02 | User-friendly error messages | 1 | Complete |
| 07-03 | Event listing skeletons | 1 | Complete |
| 07-04 | Checkout flow UX (breadcrumb, persistence, transitions) | 2 | Complete |
| 07-05 | Page loading state integration | 2 | Complete |
| 07-06 | Scanner UX integration (wake lock, offline modal, haptics) | 2 | Complete |
| 07-07 | Checkout UX integration (stepper, persistence, transitions) | 3 | Complete |

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
- Total plans completed: 71
- Average duration: 3.0 min
- Total execution time: 3.8 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 6 | 21 min | 3.5 min |
| 02 | 6 | 18 min | 3.0 min |
| 03 | 5 | 41 min | 8.2 min |
| 04 | 7 | 26 min | 3.7 min |
| 05 | 5 | 16 min | 3.2 min |
| 06 | 5 | 15 min | 3.0 min |
| 07 | 7 | 16 min | 2.3 min |
| 08 | 4 | 11 min | 2.8 min |
| 09 | 5 | 15 min | 3.0 min |
| 10 | 5 | 9 min | 1.8 min |
| 11 | 4 | 11 min | 2.8 min |
| 12 | 3 | 15 min | 5.0 min |
| 14 | 3 | 20 min | 6.7 min |
| 15 | 3 | 5 min | 1.7 min |
| 16 | 2 | 4 min | 2.0 min |
| 17 | 1 | 1.9 min | 1.9 min |

**Recent Trend:**
- Last 5 plans: 17-03 (1.9 min), 16-02 (2.7 min), 16-01 (1 min), 15-03 (2 min), 15-02 (1.5 min)
- Trend: Phase 17 in progress — security lockdown with RLS hardening

*Updated after each plan completion*
| Phase 15 P03 | 110 | 3 tasks | 6 files |
| Phase 15 P03 | 2 | 3 tasks | 6 files |
| Phase 16 P01 | 63 | 2 tasks | 2 files |
| Phase 16 P02 | 160 | 2 tasks | 3 files |
| Phase 17 P03 | 114 | 2 tasks | 2 files |
| Phase 17 P01 | 163 | 3 tasks | 4 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

| Date | Plan | Decision | Rationale |
|------|------|----------|-----------|
| 2026-02-14 | 15-03 | /auth redirects to /auth/employee by default | Employees are the primary users of the scanner portal — they need the quickest access path |
| 2026-02-14 | 15-03 | Invitation and recovery flows redirect to /auth/owner | Administrative actions (team invites, password resets) are owner-only operations |
| 2026-02-14 | 15-03 | Owner sign-out returns to /auth/owner, employee sign-out to /auth/employee | Role-specific sign-out paths maintain context and prevent confused authentication attempts |
| 2026-02-14 | 15-03 | localStorage.clearUser() gated behind import.meta.env.DEV in all sign-out handlers | Production builds must never rely on localStorage for authentication — completes P0 requirement R09 |
| 2026-02-14 | 15-01 | Sign out non-owner accounts during /auth/owner login | Strict role enforcement prevents confused access attempts and maintains security boundaries |
| 2026-02-14 | 15-01 | Password reset redirectTo points to /auth/owner | User completes entire flow on specialized page for consistent UX |
| 2026-02-14 | 15-01 | Invitation URLs route to /auth/owner | All team onboarding flows through owner portal for consistent admin experience |
| 2026-02-14 | 15-02 | Touch-friendly h-12 inputs and buttons for mobile scanning devices at the door | Scanner staff use mobile devices at the door, need large tap targets for quick authentication |
| 2026-02-14 | 15-02 | Remember me stores email only (not credentials) for convenience without security compromise | Convenience feature without security risk - password still required on each login |
| 2026-02-14 | 14-02 | Gate all localStorage auth fallbacks behind import.meta.env.DEV | Production builds must never trust localStorage for authentication — only real Supabase sessions are valid |
| 2026-02-14 | 14-03 | Handle Resend restricted API keys as valid | Restricted send-only keys are more secure and should be recognized as valid configuration |
| 2026-02-14 | 14-03 | Parse .env files independently without process.env pollution | Using dotenv.parse() with readFileSync ensures clean comparison without side effects |
| 2026-02-14 | 14-03 | Use native fetch API for credential validation | Node 18+ has built-in fetch, no need for axios or node-fetch dependencies |
| 2026-02-14 | 14-01 | Case-insensitive email matching for user lookup | Supabase stores emails lowercase but user input may vary in casing |
| 2026-02-14 | 14-01 | Update password when updating existing users | Ensures accounts can sign in with documented credentials after script run |
| 2026-02-14 | 14-01 | Auto-confirm emails (email_confirm: true) | Production accounts don't need verification emails - direct access required |
| 2026-02-14 | 14-01 | Separate admin and anon clients for verification | Admin API for user listing, anon client for realistic sign-in testing |
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
| 2026-01-31 | 05-01 | ### Decisions

 discrepancy threshold for logging | Per RESEARCH.md - small timing discrepancies are normal |
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
| 2026-01-31 | 07-02 | Error toasts persist until dismissed (duration: Infinity) | Per CONTEXT.md - errors require user acknowledgment |
| 2026-01-31 | 07-02 | All errors include action button | Either "Try Again" with retry callback or "Contact Support" mailto |
| 2026-01-31 | 07-02 | Professional/formal tone for all error messages | No technical jargon in user-facing errors |
| 2026-01-31 | 07-04 | Green checkmark for completed steps | Visual progress indicator with click-to-navigate |
| 2026-01-31 | 07-04 | Only persist firstName, lastName, email | Phone excluded for privacy |
| 2026-01-31 | 07-04 | Graceful localStorage quota exceeded handling | Console warning only, fail silently |
| 2026-01-31 | 07-04 | 300ms default transition duration | Matches tailwindcss-animate convention |
| 2026-01-31 | 07-05 | Skeleton grids match actual content layouts | Zero layout shift during content loading |
| 2026-01-31 | 07-05 | LoadingButton integrated for checkout action | Processing state with disabled interactions |
| 2026-01-31 | 07-05 | Promo code button disabled during payment | Prevents double-submission during async operations |
| 2026-01-31 | 07-06 | Wake lock active only during QR/NFC mode | Releases in manual mode to save battery |
| 2026-01-31 | 07-06 | Offline acknowledgment resets on reconnect | Fresh modal shown for each offline event |
| 2026-01-31 | 07-06 | Haptic patterns: success (50ms), VIP (triple), reentry (double), rejection (200-100-200) | Distinct feedback per scan result type |
| 2026-01-31 | 07-07 | Auto-advance step 1 to 2 on ticket selection | Stepper advances when user selects tickets |
| 2026-01-31 | 07-07 | Step 3 set on checkout click | Shows payment progress before navigation |
| 2026-01-31 | 07-07 | Form value priority: user > persisted > empty | Logged-in user data takes precedence over localStorage |
| 2026-01-31 | 07-07 | showError with retry for checkout errors | All checkout errors include retry callback |
| 2026-01-31 | 07-07 | Welcome back message for guests with persisted data | Shows when hasPersistedData && !user |
| 2026-01-31 | 08-01 | Cypress at project root | Cross-app testing requires single Cypress installation at monorepo root |
| 2026-01-31 | 08-01 | chromeWebSecurity disabled for Stripe | Required for Stripe iframe handling in E2E tests |
| 2026-01-31 | 08-01 | cy.session for auth caching | Caches authentication across specs to reduce test time |
| 2026-01-31 | 08-01 | cy.task for Supabase DB operations | Node-side database verification for E2E tests |
| 2026-01-31 | 08-01 | Video auto-cleanup | Delete videos for passing specs to conserve disk space |
| 2026-01-31 | 08-02 | Health checks run first in CI | Fail-fast on environment issues before running test suite |
| 2026-01-31 | 08-02 | 4 parallel containers with manual split | No Cypress Cloud, manual spec splitting across workers |
| 2026-01-31 | 08-02 | Build artifacts shared between jobs | Build once, distribute to test containers for efficiency |
| 2026-01-31 | 08-02 | serve package for CI serving | Static file serving in CI instead of dev servers |
| 2026-01-31 | 08-03 | Recursive polling for email verification | More reliable than fixed wait for async operations |
| 2026-01-31 | 08-03 | Direct REST API for email_queue | Query Supabase directly via cy.request() for faster verification |
| 2026-01-31 | 08-03 | cy.origin args passing | All variables needed inside origin callback passed via args object |
| 2026-01-31 | 08-03 | this.skip() for conditional tests | Skip scan tests gracefully if test ticket creation fails |
| 2026-01-31 | 08-04 | fillStripeDeclined for payment failure tests | Reuse existing custom command instead of raw iframe manipulation |
| 2026-01-31 | 08-04 | cy.intercept forceNetworkError for offline | Simulate network failure via Cypress intercept rather than browser DevTools |
| 2026-01-31 | 08-04 | Flexible selectors for UI variations | Multiple selector patterns accommodate different UI implementations |
| 2026-01-31 | 08-04 | Direct scanner URL navigation | Visit scannerUrl/auth instead of cy.origin for cleaner cross-app testing |
| 2026-01-31 | 09-03 | Test event_vip_tables.is_available changes | VIPTablesPage subscribes to event_vip_tables updates, not vip_reservations status |
| 2026-01-31 | 09-03 | UI state: available=button, reserved=RESERVED text | UI only differentiates available vs reserved, not pending vs confirmed |
| 2026-01-31 | 09-07 | 60-second timeout for delivery webhook | Resend delivery can take 10-60 seconds per RESEARCH.md |
| 2026-01-31 | 09-07 | 1-second polling interval for email queue | Avoids overwhelming database while ensuring timely detection |
| 2026-01-31 | 09-07 | Email content verification via keywords | Check for 'qr', 'vip', 'reservation', 'table' in subject/body |
| 2026-01-31 | 10-01 | p95 < 500ms global threshold | Default performance target from CONTEXT.md |
| 2026-01-31 | 10-01 | Scanner p95 < 200ms threshold | Faster target for gate operations |
| 2026-01-31 | 10-01 | Dashboard p95 < 3s threshold | Acceptable load time for data-heavy views |
| 2026-01-31 | 10-01 | Webhook p95 < 1s threshold | Processing tolerance for Stripe events |
| 2026-01-31 | 10-02 | 100 VUs with ramping executor | Matches CONTEXT.md success criteria #1 |
| 2026-01-31 | 10-02 | Results output to load-tests/results/ | Enables CI artifact collection |
| 2026-02-01 | 10-05 | constant-arrival-rate executor for burst | Precise 5 req/sec for 10 seconds = exactly 50 requests |
| 2026-02-01 | 10-05 | Separate idempotency scenario | Verify duplicate webhook handling after burst completes |
| 2026-02-01 | 10-05 | Zero timeout tolerance threshold | Any timeout indicates unacceptable performance |
| 2026-02-01 | 12-01 | 90% weighted score threshold for GO | Critical categories require zero failures |
| 2026-02-01 | 12-01 | Pre-verified Infrastructure and UX from Phase 6-7 | 8 of 28 requirements already verified |
| 2026-02-01 | 12-01 | Test file mapping for all requirements | Each requirement linked to specific test path |
| 2026-02-01 | 12-02 | Grouped backend secrets by function category | Core, Payment, Email, QR, Notifications, Rate Limiting, Error Tracking, CORS |
| 2026-02-01 | 12-02 | Two-phase validation (Configured vs Validated) | Existence check separate from functional verification |
| 2026-02-01 | 12-02 | Four recovery scenarios documented | Database, Stripe webhook, email queue, complete environment |
| 2026-02-01 | 12-02 | Quarterly PITR testing schedule | Recovery testing recommended but deferred actual test |
- [Phase 15]: Touch-friendly h-12 inputs and buttons for mobile scanning devices at the door
- [Phase 15]: Remember me stores email only (not credentials) for convenience without security compromise
- [Phase 16-01]: ProtectedRoute accepts allowedRoles as optional array for flexible role combinations
- [Phase 16-01]: requireDev check happens BEFORE auth check to hide DEV-only routes in production
- [Phase 16-01]: Unauthorized page has role-aware navigation (owner->Dashboard, employee->Scanner)
- [Phase 16-02]: Promoter treated as owner-equivalent for route access (simplified MVP role model)
- [Phase 16-02]: /test-qr double-gated with requireDev + owner role (invisible in production)
- [Phase 16-02]: Post-login redirect uses replace: true to prevent back-button to login page
- [Phase 16-02]: Employee routes allow any authenticated user (owners can access scanner via superset access)
- [Phase 17-03]: Remove anonymous SELECT access from VIP tables - PII exposure (purchaser names, emails, phone numbers, QR tokens)
- [Phase 17-03]: SECURITY DEFINER RPC for token-based lookup - Safe bypass of RLS when lookup is by exact token (UUID)
- [Phase 17-01]: Edge Function verifySignature uses constant-time comparison to prevent timing attacks
- [Phase 17-01]: verifySignatureOffline uses simple string comparison (no timing attack concern for local cache)

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
- **⚠️ PRIORITY: Configure GitHub Secrets for E2E CI** (workflow temporarily disabled until configured)
  - Go to: https://github.com/LuisMiguel13ad/Maguey-Nightclub-Live-/settings/secrets/actions
  - Add these 7 secrets:
    1. `VITE_SUPABASE_URL` - Your Supabase project URL (from Supabase Dashboard → Settings → API)
    2. `VITE_SUPABASE_ANON_KEY` - Supabase anon/public key (from Supabase Dashboard → Settings → API)
    3. `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (from Supabase Dashboard → Settings → API)
    4. `STRIPE_TEST_PK` - Stripe test publishable key (from Stripe Dashboard → Developers → API keys)
    5. `STRIPE_TEST_SK` - Stripe test secret key (from Stripe Dashboard → Developers → API keys)
    6. `SCANNER_TEST_EMAIL` - Test user email for scanner login (create a test user in your auth system)
    7. `SCANNER_TEST_PASSWORD` - Test user password for scanner login
  - After adding secrets: Edit .github/workflows/e2e.yml to uncomment push/pull_request triggers

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

Last session: 2026-02-14
Stopped at: Completed 17-03-PLAN.md (Remove anonymous VIP RLS access)
Resume file: `.planning/phases/17-security-lockdown/17-03-SUMMARY.md`
Next action: Continue Phase 17 (Security Lockdown) via `/gsd:execute-plan 17-04` OR start with `/gsd:execute-plan 17-01` for earlier plans
