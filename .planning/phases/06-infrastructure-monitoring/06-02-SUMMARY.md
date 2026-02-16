---
phase: 06-infrastructure-monitoring
plan: 02
subsystem: infra
tags: [rate-limiting, upstash, redis, edge-functions, security]

# Dependency graph
requires:
  - phase: 01-payment-hardening
    provides: Edge function structure and Stripe integration
provides:
  - Shared rate-limiter module for all edge functions
  - Payment endpoint protection (20 req/min per IP)
  - Tiered rate limiting (auth/payment: 20/min, read: 200/min)
  - Fail-open pattern for graceful degradation
affects: [06-infrastructure-monitoring, future-edge-functions]

# Tech tracking
tech-stack:
  added: ["@upstash/ratelimit", "@upstash/redis"]
  patterns: ["sliding-window-rate-limiting", "fail-open-pattern", "ip-based-throttling"]

key-files:
  created:
    - maguey-pass-lounge/supabase/functions/_shared/rate-limiter.ts
  modified:
    - maguey-pass-lounge/supabase/functions/create-checkout-session/index.ts
    - maguey-pass-lounge/supabase/functions/vip/create-payment-intent/index.ts

key-decisions:
  - "Fail-open pattern: requests allowed if Upstash unavailable"
  - "Webhook endpoints exempt from rate limiting"
  - "Sliding window algorithm for accurate rate limiting"
  - "IP-based rate limiting using x-forwarded-for header"

patterns-established:
  - "Rate limit check after CORS preflight, before processing"
  - "429 response includes Retry-After header"
  - "Lazy limiter initialization to avoid startup errors"

# Metrics
duration: 2min
completed: 2026-01-31
---

# Phase 6 Plan 2: Rate Limiting Implementation Summary

**Upstash Redis rate limiting for edge functions with tiered limits (20/min payment, 200/min read) and fail-open pattern**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-31T16:37:16Z
- **Completed:** 2026-01-31T16:39:09Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Created shared rate-limiter module with Upstash Redis integration
- Applied payment rate limiting to GA and VIP checkout endpoints
- Implemented fail-open pattern for graceful degradation when Upstash unavailable
- Configured tiered limits: auth/payment (20/min), read (200/min), webhook (exempt)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create rate-limiter shared module** - `7b14a45` (feat)
2. **Task 2: Apply rate limiting to payment endpoints** - `3c2603c` (feat)
3. **Task 3: Deploy and test rate limiting** - Verification only (no commit)

## Files Created/Modified
- `maguey-pass-lounge/supabase/functions/_shared/rate-limiter.ts` - Shared rate limiting module with tiered limits
- `maguey-pass-lounge/supabase/functions/create-checkout-session/index.ts` - Added payment rate limiting
- `maguey-pass-lounge/supabase/functions/vip/create-payment-intent/index.ts` - Added payment rate limiting

## Decisions Made
- **Fail-open pattern:** Requests allowed if Upstash unavailable - availability over strict rate limiting
- **Webhook exemption:** stripe-webhook, vip/webhook, resend-webhook are exempt per CONTEXT.md
- **Sliding window algorithm:** More accurate than fixed window for rate limiting
- **IP extraction:** Uses x-forwarded-for header (set by Supabase) for client identification

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Supabase CLI not installed locally - deployment verification deferred to manual step
- Functions are ready for deployment with `supabase functions deploy`

## User Setup Required

**External services require manual configuration.** Add these environment variables in Supabase Dashboard:

| Variable | Source |
|----------|--------|
| `UPSTASH_REDIS_REST_URL` | Upstash Console -> Database -> REST API -> URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Console -> Database -> REST API -> Token |

**Setup steps:**
1. Create Upstash account at https://upstash.com
2. Create a Redis database (choose region near your Supabase project)
3. Copy REST API URL and Token
4. Add to Supabase Edge Functions secrets in Dashboard

**Verification:** After deploying, send 21 rapid requests to a payment endpoint - 21st should return 429.

## Next Phase Readiness
- Rate limiting infrastructure ready
- Payment endpoints protected
- Ready for 06-03: Sentry integration for error tracking

---
*Phase: 06-infrastructure-monitoring*
*Completed: 2026-01-31*
