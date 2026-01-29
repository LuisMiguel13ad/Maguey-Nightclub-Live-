# Phase 1: Payment Flow Hardening - Context

**Gathered:** 2026-01-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Ensure GA and VIP payment flows complete reliably end-to-end without failures or duplicate charges. The payment system exists — we're hardening it for production. This covers PAY-01 through PAY-04: GA ticket purchase, VIP table booking, webhook idempotency, and error messaging.

</domain>

<decisions>
## Implementation Decisions

### Error Messaging
- Toast notification for payment failures (not modal or inline)
- Auto-dismiss after 5 seconds
- Simple, friendly messages: "Payment failed. Please try again." — no technical details
- Same error treatment for VIP and GA (consistent experience)
- Retry button appears on the toast notification
- Full loading overlay during retry (prevent interaction)
- No retry limit — let customers keep trying
- Log all failed payment attempts for analytics and debugging

### Duplicate Handling
- Silently skip duplicate webhook events (return 200, no action)
- Detection method: BOTH Stripe event ID check AND database constraints as backup
- Auto-delete any duplicate tickets that somehow get created
- Store processed webhook event IDs for 30 days, then purge

### Failure Recovery
- Retry automatically when payment succeeds but ticket creation fails
- 5 retry attempts with backoff before escalating
- After all retries fail: notify owner via BOTH email AND dashboard notification
- Failed payments create a "pending" record visible in dashboard
- Owner can see payments awaiting ticket creation

### Testing Approach
- Use BOTH Stripe test mode AND staging environment
- Essential failure scenarios: card declined, webhook timeout, duplicate event
- Full automated test coverage for all payment paths
- CI/CD: tests must pass before code can merge
- Extra test scenarios for VIP (guest passes, table assignments)
- Include load testing in this phase (not just Phase 10)
- Target: 50 concurrent payments

### Claude's Discretion
- Exact staging environment setup (check existing codebase first)
- Database setup (determine if separate test project exists)
- Retry backoff timing (exponential vs fixed intervals)
- Specific Stripe test card numbers to use

</decisions>

<specifics>
## Specific Ideas

- Error toasts should feel non-intrusive — 5 seconds auto-dismiss with retry button
- Owner should have visibility into payment issues without digging — dashboard alerts + email
- 50 concurrent payments is the target for a typical busy night at the venue

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-payment-flow-hardening*
*Context gathered: 2026-01-29*
