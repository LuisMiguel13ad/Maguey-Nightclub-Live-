---
phase: 02-email-reliability
plan: 02
subsystem: api
tags: [resend, email, queue, edge-function, pg_cron, exponential-backoff]

# Dependency graph
requires:
  - phase: 02-01
    provides: email_queue table schema
provides:
  - Email queue processor edge function
  - pg_cron setup documentation
  - Exponential backoff retry mechanism
affects: [02-03-resend-webhook, 02-05-integration, email-delivery]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Queue processor with optimistic locking"
    - "Exponential backoff with jitter for retries"
    - "Batch processing to avoid rate limits"

key-files:
  created:
    - maguey-pass-lounge/supabase/functions/process-email-queue/index.ts
    - maguey-pass-lounge/supabase/migrations/20260130100001_email_queue_cron.sql
  modified: []

key-decisions:
  - "Batch size of 10 emails per minute to avoid Resend rate limits"
  - "Optimistic locking with status check prevents double-processing"
  - "pg_cron setup documented (requires Supabase Dashboard configuration)"

patterns-established:
  - "Queue processor pattern: fetch pending, lock, process, update status"
  - "Exponential backoff: 1min base, 2x growth, 30min cap, 10% jitter"

# Metrics
duration: 2min
completed: 2026-01-30
---

# Phase 02 Plan 02: Queue Processor Summary

**Email queue processor edge function with Resend API integration and exponential backoff retry mechanism**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-30T02:27:02Z
- **Completed:** 2026-01-30T02:29:06Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created process-email-queue edge function that processes up to 10 pending emails per minute
- Implemented exponential backoff retry (1m -> 2m -> 4m -> 8m -> 16m, capped at 30m)
- Optimistic locking prevents double-processing by concurrent invocations
- Documented pg_cron setup with both Dashboard and SQL/Vault approaches

## Task Commits

Each task was committed atomically:

1. **Task 1: Create process-email-queue edge function** - `b9fccec` (feat)
2. **Task 2: Setup pg_cron job for queue processing** - `1a957bf` (docs)

## Files Created/Modified
- `maguey-pass-lounge/supabase/functions/process-email-queue/index.ts` - Edge function that processes email queue with retry logic
- `maguey-pass-lounge/supabase/migrations/20260130100001_email_queue_cron.sql` - Migration documenting pg_cron setup requirements

## Decisions Made
- **Batch size of 10:** Prevents hitting Resend rate limits during high-volume periods
- **Optimistic locking:** Using `eq('status', 'pending')` on update ensures concurrent invocations don't process same email
- **pg_cron via Dashboard:** Secrets (project URL, service role key) cannot be safely stored in migrations, so setup documented for Dashboard configuration

## Deviations from Plan

None - plan executed exactly as written.

## User Setup Required

**External services require manual configuration:**

1. **pg_cron Job Configuration:**
   - Go to Supabase Dashboard -> Database -> Cron Jobs
   - Create job named `process-email-queue`
   - Schedule: `* * * * *` (every minute)
   - Command: HTTP POST to `/functions/v1/process-email-queue` with service role key

2. **Environment Variables (if not already configured):**
   - `RESEND_API_KEY` - API key from Resend dashboard
   - `EMAIL_FROM_ADDRESS` - Verified sender email (default: tickets@magueynightclub.com)

See migration file `20260130100001_email_queue_cron.sql` for detailed setup instructions.

## Next Phase Readiness
- Queue processor ready for integration with webhook handler (02-03)
- Can receive delivery status updates via `resend_email_id` correlation
- Ready for checkout flow integration (02-05)

---
*Phase: 02-email-reliability*
*Completed: 2026-01-30*
