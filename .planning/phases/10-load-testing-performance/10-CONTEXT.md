# Phase 10: Load Testing & Performance - Context

## Phase Goal
System handles production-level traffic without degradation

## Success Criteria (from ROADMAP)
1. System handles 100 concurrent ticket purchases without errors
2. Scanner handles 10 simultaneous scans at gate without lag
3. Dashboard loads within 3 seconds under normal traffic
4. Webhook processing handles burst of 50 events without timeouts
5. Database queries complete within acceptable thresholds under peak load

## Context Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Load testing tool | k6 | Modern, JS-based, already in STATE.md todos |
| Target environment | Staging/Test | Avoid impacting production data |
| Latency threshold | p95 < 500ms | Balanced target for edge functions |

## Technical Constraints

### k6 Setup
- Install: `brew install k6`
- Scripts written in JavaScript
- Supports HTTP, WebSocket, and gRPC
- Built-in metrics and thresholds

### Test Targets
1. **Ticket Purchases**: POST to stripe-webhook edge function
2. **Scanner**: POST to scan_ticket_atomic RPC
3. **Dashboard**: GET events, tickets, revenue data
4. **Webhooks**: Stripe webhook processing endpoint

### Environment Variables
- `SUPABASE_URL`: Test project URL
- `SUPABASE_ANON_KEY`: For authenticated requests
- `STRIPE_TEST_SK`: For creating test payment intents

## Test Scenarios

### Scenario 1: Ticket Purchase Load
- 100 virtual users
- Each completes full checkout flow
- Target: 0% error rate, p95 < 500ms

### Scenario 2: Scanner Burst
- 10 simultaneous scan requests
- Mix of valid/invalid tickets
- Target: 0% error rate, p95 < 200ms

### Scenario 3: Dashboard Load
- 20 concurrent dashboard viewers
- Real-time subscription connections
- Target: Initial load < 3s, updates < 100ms

### Scenario 4: Webhook Burst
- 50 webhook events in 10 seconds
- Simulates event end rush
- Target: All processed, no timeouts

## Risk Mitigation
- Use test Stripe keys only
- Clean up test data after runs
- Rate limit tests to avoid Supabase throttling
- Monitor costs during testing
