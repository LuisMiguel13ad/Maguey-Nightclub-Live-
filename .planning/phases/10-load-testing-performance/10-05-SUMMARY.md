---
phase: 10-load-testing-performance
plan: 05
subsystem: load-testing
tags: [k6, webhook, load-test, stripe, burst-test]

dependency-graph:
  requires: [10-01-SUMMARY]
  provides: [webhook-burst-test]
  affects: [10-RESEARCH]

tech-stack:
  added: []
  patterns:
    - constant-arrival-rate executor
    - idempotency testing pattern
    - webhook signature generation

key-files:
  created:
    - load-tests/scenarios/webhook-burst.js
  modified: []

decisions:
  - id: "10-05-001"
    what: "constant-arrival-rate executor for burst"
    why: "Precise 5 req/sec rate for 10 seconds = exactly 50 requests"
  - id: "10-05-002"
    what: "Separate idempotency scenario"
    why: "Verify duplicate webhook handling after burst completes"
  - id: "10-05-003"
    what: "Zero timeout tolerance threshold"
    why: "Any timeout indicates unacceptable performance"

metrics:
  duration: 2 min
  completed: 2026-02-01
---

# Phase 10 Plan 05: Webhook Burst Load Test Summary

**One-liner:** k6 load test for 50 webhook events in 10 seconds with idempotency verification.

## What Was Done

Created the webhook burst load test (`load-tests/scenarios/webhook-burst.js`) that validates success criteria #4: "Webhook processing handles burst of 50 events without timeouts".

### Task Breakdown

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create webhook burst load test | d0570e3 | load-tests/scenarios/webhook-burst.js |

### Test Configuration

**Scenario 1: Webhook Burst**
- Executor: `constant-arrival-rate`
- Rate: 5 requests/second for 10 seconds
- Total: 50 unique webhook events
- VUs: 10-20 (pre-allocated/max)

**Scenario 2: Idempotency Test**
- Executor: `per-vu-iterations`
- VUs: 5
- Iterations: 3 per VU (same event sent 3 times)
- Start: After burst test (15s delay)

### Thresholds

| Metric | Threshold | Rationale |
|--------|-----------|-----------|
| webhook_duration p95 | < 1000ms | Webhook processing tolerance |
| webhook_errors rate | < 1% | Error rate target |
| timeouts count | < 1 | Zero tolerance for timeouts |

### Key Features

1. **Stripe Signature Generation** - Uses `generateStripeSignature` helper from 10-01
2. **Unique Event Generation** - Uses `generateWebhookEvent` helper for unique payloads
3. **Timeout Tracking** - Explicit counter for requests exceeding 30s
4. **Duplicate Detection** - Tracks idempotent responses in scenario 2
5. **Summary Report** - Human-readable output with all metrics

### Sample Output

```
================================================================================
                      WEBHOOK BURST LOAD TEST RESULTS
================================================================================

Configuration:
  Burst Test:      50 unique webhooks in 10 seconds (5/sec)
  Idempotency:     5 VUs x 3 iterations each (15 requests, 10 duplicates expected)
  Endpoint:        POST /functions/v1/stripe-webhook

Results:
  Total Processed: 50
  Signatures OK:   50
  Timeouts:        0
  Error Rate:      0.00%

Response Times:
  Average:         XXms
  P95:             XXms
  P99:             XXms
  Max:             XXms

Thresholds:
  PASS webhook_duration p(95)<1000
  PASS webhook_errors rate<0.01
  PASS timeouts count<1

Overall: PASS
================================================================================
```

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- [x] `load-tests/scenarios/webhook-burst.js` exists (268 lines)
- [x] Uses constant-arrival-rate executor for 5 req/sec
- [x] Generates valid Stripe signatures using helper
- [x] Idempotency test sends same event 3 times
- [x] Timeout tracking with zero tolerance threshold
- [x] Summary shows processed count, timeouts, and duplicates

## Usage

```bash
# Run webhook burst test
k6 run \
  -e SUPABASE_URL=https://your-project.supabase.co \
  -e STRIPE_WEBHOOK_SECRET=whsec_xxx \
  -e TEST_EVENT_ID=your-event-uuid \
  load-tests/scenarios/webhook-burst.js

# Output JSON results
k6 run --out json=results.json load-tests/scenarios/webhook-burst.js
```

## Next Phase Readiness

**Prerequisites Met:**
- Webhook burst test created and ready for execution
- Stripe signature generation helper integrated
- Idempotency verification included

**Remaining in Phase 10:**
- All 5 plans complete (10-01 through 10-05)

**Blockers:**
- k6 must be installed (`brew install k6`)
- STRIPE_WEBHOOK_SECRET environment variable required for valid signatures
