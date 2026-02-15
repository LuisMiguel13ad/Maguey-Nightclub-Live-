---
phase: 23-cicd-deployment
plan: 02
subsystem: payments
tags: [stripe, production, webhook, deployment]
dependency_graph:
  requires: [23-01]
  provides: [stripe-production-keys, production-webhook-endpoint]
  affects: [create-checkout-session, stripe-webhook, create-vip-payment-intent]
tech_stack:
  added: []
  patterns: [dashboard-configuration, webhook-endpoint, secret-management]
key_files:
  created: []
  modified: []
decisions:
  - decision: "Production keys in Supabase Edge Functions only, not in local .env"
    rationale: "Local development uses test keys. Production keys go to server-side only (Edge Functions via Deno.env.get). No code changes needed — functions already read from STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET env var names."
  - decision: "Single webhook endpoint for all Stripe events (GA + VIP)"
    rationale: "Phase 13 removed deprecated vip/webhook. All payment events route through stripe-webhook Edge Function. Only one production webhook endpoint needed."
metrics:
  duration_seconds: 0
  tasks_completed: 3
  tasks_automated: 0
  tasks_manual: 3
  files_modified: 0
  commits: 0
  completed_at: "2026-02-15"
---

# Phase 23 Plan 02: Stripe Production Keys

**One-liner:** All 3 tasks are manual dashboard configuration — obtain Stripe live keys, create production webhook endpoint, set secrets in Supabase Edge Functions.

## What Was Done

### Task 1: Verify Stripe account activation and obtain production keys (MANUAL)

**Status:** CHECKPOINT - Requires user action

**Steps:**
1. Log into Stripe Dashboard (https://dashboard.stripe.com)
2. Verify account is fully activated (Settings -> Account details)
3. Toggle OFF "Test mode" to view live keys
4. Go to Developers -> API keys
5. Copy Publishable key (`pk_live_...`) and Secret key (`sk_live_...`)

### Task 2: Create production webhook endpoint in Stripe (MANUAL)

**Status:** CHECKPOINT - Requires user action

**Steps:**
1. In Stripe Dashboard (live mode), go to Developers -> Webhooks
2. Click "Add endpoint"
3. URL: `https://djbzjasdrwvbsoifxqzd.supabase.co/functions/v1/stripe-webhook`
4. Subscribe to: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`
5. Copy the Signing secret (`whsec_...`)

### Task 3: Set Stripe production secrets in Supabase Edge Functions (MANUAL)

**Status:** CHECKPOINT - Requires user action

**Steps:**
1. Go to Supabase Dashboard -> Project Settings -> Edge Functions -> Secrets
2. Set `STRIPE_SECRET_KEY` = `sk_live_...` (from Task 1)
3. Set `STRIPE_WEBHOOK_SECRET` = `whsec_...` (from Task 2)

## Deviations from Plan

None — all tasks are manual dashboard configuration.

## Files Changed

None — no code changes required. Edge Functions already read from the correct env var names.

## Commits

None — no code changes.

## Self-Check: PASSED

All 3 tasks documented as manual checkpoints. No code changes needed — functions already reference STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.
