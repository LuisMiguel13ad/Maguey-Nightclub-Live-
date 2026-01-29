# Phase 2: Email Reliability — Context

## Phase Goal

Guarantee ticket and VIP confirmation emails deliver consistently with correct content.

## Requirements Covered

- EMAIL-01: GA ticket confirmation emails deliver within 2 minutes with valid QR code
- EMAIL-02: VIP reservation confirmation emails include correct QR code and table assignment
- EMAIL-03: Failed email sends are logged with retry capability

## Success Criteria

1. GA ticket confirmation emails deliver within 2 minutes of purchase with valid QR code
2. VIP reservation confirmation emails include correct QR code and table assignment details
3. Failed email sends are logged in database with retry capability
4. Resend API failures trigger fallback retry logic

## Decisions Captured

### Retry Behavior

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Max retries | 5 attempts | Balance between persistence and accepting permanent failures |
| Delay pattern | Exponential backoff | Increases delay between retries to avoid hammering failed service |
| Retry mechanism | Background queue | Decouples email from webhook response; doesn't block request |
| Fallback provider | None (Resend only) | Single provider simplifies implementation; Resend has good reliability |

### Failure Handling

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Permanent failure action | Log + Alert owner | Owner needs visibility to manually resolve |
| Manual retry capability | Yes, from dashboard | Owners can retry failed emails without developer intervention |
| Failure retention | 30 days | Matches idempotency retention from Phase 1 |
| Customer notification | None | Owner handles manually; customers can view tickets in app |

### Logging & Visibility

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Email states tracked | Sent, Delivered | Core states needed; Opened requires tracking pixel (not needed) |
| Dashboard view | Per-ticket status | Show email status on each ticket/reservation row |
| Resend webhooks | Yes | Real-time delivery status updates |
| Error detail level | Full context | Error message, stack trace, request payload, retry count |

### Testing Approach

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Test scope | Unit + Integration + E2E + Webhook tests | Comprehensive coverage of email flow |
| Test email addresses | Resend test addresses | Built-in sandbox addresses that don't actually send |
| CI pipeline | Unit + Integration only | Fast CI; E2E tests run manually |

## Technical Implications

### Email Queue System

Need to implement a background queue for email retries:
- Store pending emails in database table (email_queue)
- Background worker processes queue with exponential backoff
- Track attempt count, next retry time, status

### Database Schema Additions

```sql
-- email_queue table for retry mechanism
CREATE TABLE email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_type TEXT NOT NULL, -- 'ga_ticket' | 'vip_confirmation'
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  related_id UUID, -- ticket_id or reservation_id
  status TEXT DEFAULT 'pending', -- pending, sent, delivered, failed
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  next_retry_at TIMESTAMPTZ,
  last_error TEXT,
  error_context JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- email_delivery_status for webhook tracking
CREATE TABLE email_delivery_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resend_email_id TEXT UNIQUE NOT NULL,
  queue_id UUID REFERENCES email_queue(id),
  status TEXT NOT NULL, -- sent, delivered, bounced
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Resend Webhook Setup

Need to configure Resend webhook endpoint to receive:
- `email.sent` — Email accepted by Resend
- `email.delivered` — Email delivered to recipient
- `email.bounced` — Email permanently rejected

### Dashboard Updates

Add email status indicator to:
- Ticket rows in owner dashboard
- VIP reservation rows
- Optional: "Retry" button for failed emails

## Existing Code Reference

From Phase 1 research, current email sending:
- GA tickets: `send-ticket-email/index.ts` — Supabase Edge Function
- VIP confirmations: `send-vip-confirmation/index.ts` — Supabase Edge Function
- Both use Resend API directly (fire-and-forget pattern from Phase 1)

## Dependencies

- Phase 1 complete (payment flows working, tickets/reservations created)
- Resend API key configured
- Resend webhook endpoint needs to be set up in Resend dashboard

---

*Captured: 2026-01-29 via /gsd:discuss-phase 2*
