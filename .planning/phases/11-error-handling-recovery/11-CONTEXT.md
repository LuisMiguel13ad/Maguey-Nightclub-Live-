# Phase 11: Error Handling & Recovery - Context

**Gathered:** 2026-01-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Validate that all failure scenarios are handled gracefully — Stripe webhook failures retry and succeed, email delivery failures are retryable from dashboard, scanner handles offline correctly, payment failures don't leave orphaned records, and all error states show user-friendly recovery instructions.

This is validation and testing work, not new feature development. Cross-cut validation of PAY-04, EMAIL-03, SCAN-02, UX-02.

</domain>

<decisions>
## Implementation Decisions

### Failure Simulation Approach

**Stripe failures:**
- Use Stripe test mode triggers (built-in test card numbers and events)
- Test critical partial failures: payment-success-but-ticket-creation-fails, webhook-timeout-but-retry-succeeds

**Network failures (scanner offline):**
- Use Browser DevTools Network offline toggle during tests
- Verify graceful degradation when Supabase/Stripe unreachable

**Email failures:**
- Both approaches: Resend test mode + invalid addresses for E2E flow, DB manipulation for UI isolation testing

**Database/transaction failures:**
- Use constraint violation triggers to cause rollbacks
- Verify no orphaned records remain after failures

**Timeout scenarios:**
- Mock delayed responses via test framework beyond timeout thresholds

**Third-party dependency failures:**
- Full failover testing — verify UI shows helpful errors and retries work when services return

**Error observability:**
- Verify Sentry captures failures with correct context during tests

**Automation level:**
- Automated where possible (Stripe/email failures in CI)
- Manual for network/hardware simulation

**Load conditions:**
- Test failures under normal conditions only (Phase 10 handles load testing)

**VIP vs GA:**
- Unified testing — same failure patterns apply to both ticket types

### Recovery Verification Criteria

**Stripe webhook recovery:**
- Verify end result: ticket/reservation created AND status confirmed in database

**Email retry recovery:**
- Verify email_queue status = delivered after dashboard retry

**Scanner offline recovery:**
- Verify offline scans synced to server AND online indicator shown in UI

**Recovery timeframe:**
- Automatic retries should succeed within 5 minutes of initial failure

### Scenario Coverage Scope

**Prioritization:**
- Risk-based — focus on high-impact failures that lose money or block customers

**Payment failure scenarios (all priority):**
- Card declined
- Webhook timeout
- Duplicate webhook
- Ticket creation failure

**Scanner failure scenarios (priority):**
- Network loss during scan
- Invalid QR code rejection
- Already scanned ticket rejection

**Email failure scenarios (priority):**
- Initial delivery failure
- Permanent bounce handling
- Successful retry from dashboard

### Support Runbook Format

**Format:**
- Single markdown file: `.planning/SUPPORT-RUNBOOK.md`
- Version controlled, searchable

**Organization:**
- By symptom (e.g., "Customer didn't receive email", "Payment shows failed", "Scanner offline")

**Entry structure:**
Each issue includes:
1. Symptom — what the user/operator sees
2. Diagnosis — how to investigate
3. Resolution — how to fix
4. Escalation — when to escalate and to whom

**Audience:**
- Primary: Venue owner/operator (non-technical staff resolving issues during events)
- Language should be clear, non-technical, action-oriented

### Claude's Discretion

- Whether to test concurrent failures (multiple systems failing at once) — can determine based on complexity vs value
- Exact test case organization and naming conventions
- Specific Sentry verification approach
- Runbook visual formatting and examples

</decisions>

<specifics>
## Specific Ideas

- Runbook should help venue staff resolve issues during live events without developer support
- Symptom-based organization means staff can search for what they're seeing, not what system is broken
- Escalation path should be clear: what warrants a call vs what can wait until morning

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-error-handling-recovery*
*Context gathered: 2026-01-31*
