# Phase 2: Email Reliability - Research

**Researched:** 2026-01-29
**Domain:** Transactional email delivery, retry mechanisms, webhook tracking
**Confidence:** HIGH

## Summary

This phase implements reliable email delivery for ticket and VIP confirmations using a database-backed queue with exponential backoff retries. The current implementation uses Resend API directly in a "fire-and-forget" pattern from the Stripe webhook handler, with no retry mechanism if the email fails.

The standard approach is:
1. **Email Queue Table**: Store pending emails in database with retry metadata
2. **Background Processor**: Use pg_cron + pg_net to invoke an Edge Function that processes the queue
3. **Webhook Tracking**: Receive Resend webhooks (email.sent, email.delivered, email.bounced) to track delivery status
4. **Dashboard Integration**: Show email status per ticket/reservation with manual retry capability

**Primary recommendation:** Decouple email sending from webhook response using a database queue. Process queue with pg_cron every minute. Track delivery via Resend webhooks with Svix signature verification.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Resend API | v1 | Email sending | Already in use; simple REST API with webhook support |
| svix | latest | Webhook signature verification | Resend uses Svix infrastructure; provides HMAC-SHA256 verification |
| pg_cron | built-in | Job scheduling | Supabase built-in; invoke edge functions on schedule |
| pg_net | built-in | HTTP from Postgres | Supabase built-in; call edge functions from cron jobs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Supabase Vault | built-in | Secret storage | Store API keys securely for pg_cron HTTP calls |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pg_cron + pg_net | pgmq (Postgres message queue) | pgmq more complex but better for high volume; overkill for email retries |
| Database queue | Redis/BullMQ | External dependency; database queue simpler for this scale |
| Polling with pg_cron | Database triggers | Triggers can't make HTTP calls; polling more reliable |

**Installation:**
```bash
# No npm install needed - using Resend REST API directly
# svix for Deno:
import { Webhook } from "https://esm.sh/svix@1.34.0";
```

## Architecture Patterns

### Recommended Project Structure
```
supabase/functions/
├── stripe-webhook/           # Existing - adds to email_queue instead of sending directly
├── process-email-queue/      # NEW - processes pending emails with retries
└── resend-webhook/           # NEW - receives Resend delivery status webhooks

supabase/migrations/
├── 20260201_email_queue.sql  # email_queue table
└── 20260202_email_status.sql # email_delivery_status table + Resend webhook tracking
```

### Pattern 1: Database-Backed Email Queue
**What:** Store emails in database table before sending; background process handles delivery with retries
**When to use:** When email delivery must survive webhook timeouts and transient failures
**Example:**
```typescript
// In stripe-webhook/index.ts - instead of sending directly:
// Source: Supabase patterns + Resend best practices

interface EmailQueueEntry {
  id: string;
  email_type: 'ga_ticket' | 'vip_confirmation';
  recipient_email: string;
  subject: string;
  html_body: string;
  related_id: string; // ticket_id or reservation_id
  status: 'pending' | 'processing' | 'sent' | 'delivered' | 'failed';
  attempt_count: number;
  max_attempts: number;
  next_retry_at: string;
  last_error: string | null;
  error_context: object;
  created_at: string;
  updated_at: string;
}

// Add to queue instead of sending directly
async function queueEmail(supabase: SupabaseClient, entry: Omit<EmailQueueEntry, 'id' | 'created_at' | 'updated_at'>) {
  const { error } = await supabase
    .from('email_queue')
    .insert({
      ...entry,
      status: 'pending',
      attempt_count: 0,
      max_attempts: 5,
      next_retry_at: new Date().toISOString(),
    });

  if (error) {
    console.error('Failed to queue email:', error);
    // Don't throw - webhook must return 200 to Stripe
  }
}
```

### Pattern 2: Exponential Backoff with Jitter
**What:** Calculate retry delay using exponential growth + random jitter to prevent thundering herd
**When to use:** All retry mechanisms
**Example:**
```typescript
// Source: https://dev.to/andreparis/queue-based-exponential-backoff-a-resilient-retry-pattern-for-distributed-systems-37f3

function calculateNextRetryTime(attemptCount: number): Date {
  // Base delay: 1 minute, max delay: 30 minutes
  const baseDelayMs = 60 * 1000; // 1 minute
  const maxDelayMs = 30 * 60 * 1000; // 30 minutes

  // Exponential: 1min, 2min, 4min, 8min, 16min (capped at 30min)
  const exponentialDelay = Math.min(
    baseDelayMs * Math.pow(2, attemptCount),
    maxDelayMs
  );

  // Add jitter: +/- 10% to prevent thundering herd
  const jitter = exponentialDelay * 0.1 * (Math.random() * 2 - 1);

  return new Date(Date.now() + exponentialDelay + jitter);
}
```

### Pattern 3: pg_cron + pg_net for Queue Processing
**What:** Schedule cron job to call Edge Function that processes email queue
**When to use:** Background job processing in Supabase
**Example:**
```sql
-- Source: https://supabase.com/docs/guides/functions/schedule-functions

-- Store secrets in vault
SELECT vault.create_secret('https://project-ref.supabase.co', 'project_url');
SELECT vault.create_secret('your-service-role-key', 'service_role_key');

-- Schedule queue processor every minute
SELECT cron.schedule(
  'process-email-queue',
  '* * * * *',  -- every minute
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
           || '/functions/v1/process-email-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

### Pattern 4: Svix Webhook Signature Verification
**What:** Verify Resend webhook authenticity using HMAC-SHA256 signatures
**When to use:** Resend webhook endpoint
**Example:**
```typescript
// Source: https://docs.svix.com/receiving/verifying-payloads/how + Resend docs

import { Webhook } from "https://esm.sh/svix@1.34.0";

async function verifyResendWebhook(
  rawBody: string,
  headers: Headers
): Promise<{ type: string; data: unknown }> {
  const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");

  if (!webhookSecret) {
    throw new Error("RESEND_WEBHOOK_SECRET not configured");
  }

  const wh = new Webhook(webhookSecret);

  // Resend uses Svix headers
  const svixId = headers.get("svix-id");
  const svixTimestamp = headers.get("svix-timestamp");
  const svixSignature = headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    throw new Error("Missing Svix headers");
  }

  // Verify signature (throws on failure)
  const verified = wh.verify(rawBody, {
    "svix-id": svixId,
    "svix-timestamp": svixTimestamp,
    "svix-signature": svixSignature,
  });

  return verified as { type: string; data: unknown };
}
```

### Anti-Patterns to Avoid
- **Fire-and-forget in webhooks:** Never send emails directly in webhook handlers without queueing - Stripe times out after 5 seconds
- **setTimeout for retries:** Process crashes lose scheduled retries; use database-backed queue instead
- **Blocking on email in webhook:** Email can take seconds; queue and return 200 immediately
- **Ignoring Resend webhooks:** Without delivery tracking, you don't know if emails actually arrived

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Webhook signature verification | Custom HMAC | svix library | Handles timing-safe comparison, timestamp validation, replay prevention |
| Exponential backoff calculation | Simple doubling | Standard formula with jitter | Jitter prevents thundering herd when many emails fail simultaneously |
| Job scheduling | setInterval in Edge Function | pg_cron | Process restarts lose scheduled jobs; pg_cron persists in database |
| HTTP from database | N/A | pg_net | Supabase built-in, async, non-blocking |

**Key insight:** Email delivery looks simple but has many edge cases: rate limits, temporary failures, bounces, spam filtering. The queue pattern handles all these gracefully with retry capability.

## Common Pitfalls

### Pitfall 1: Parsing JSON Before Signature Verification
**What goes wrong:** Svix signature verification fails
**Why it happens:** JSON.parse() and JSON.stringify() can change whitespace/ordering
**How to avoid:** Always use raw request body (req.text()) for verification, then parse JSON after
**Warning signs:** "Invalid signature" errors even with correct secret

### Pitfall 2: Blocking Webhook Response for Email
**What goes wrong:** Stripe webhook times out (5 second limit), retries, creates duplicates
**Why it happens:** Email sending can take 1-3 seconds; combined with DB operations exceeds timeout
**How to avoid:** Queue email in database, return 200 immediately, process asynchronously
**Warning signs:** Stripe webhook failures, duplicate tickets/emails

### Pitfall 3: Not Handling Resend Rate Limits
**What goes wrong:** Burst of emails after event purchase triggers Resend rate limiting
**Why it happens:** Many tickets purchased at once, all try to send immediately
**How to avoid:** Queue with staggered processing (pg_cron processes batch every minute)
**Warning signs:** 429 errors from Resend, emails not sending during peak

### Pitfall 4: Missing Webhook Secret in Production
**What goes wrong:** Anyone can send fake delivery status updates
**Why it happens:** Secret not configured in Supabase dashboard
**How to avoid:** Require RESEND_WEBHOOK_SECRET env var; reject if missing
**Warning signs:** Accepting all webhook requests without verification

### Pitfall 5: Infinite Retry Loop
**What goes wrong:** Permanently failing emails keep retrying forever
**Why it happens:** No max attempt limit or permanent failure detection
**How to avoid:** Set max_attempts (5); mark as 'failed' after exhausting; detect hard bounces
**Warning signs:** Same email in queue for days; database growing indefinitely

## Code Examples

Verified patterns from official sources:

### Process Email Queue Edge Function
```typescript
// Source: Supabase patterns + verified Resend API

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const now = new Date().toISOString();

  // Fetch pending emails ready for retry (limit batch size)
  const { data: pendingEmails, error: fetchError } = await supabase
    .from('email_queue')
    .select('*')
    .eq('status', 'pending')
    .lte('next_retry_at', now)
    .order('created_at', { ascending: true })
    .limit(10);  // Process 10 per minute to avoid rate limits

  if (fetchError || !pendingEmails?.length) {
    return new Response(JSON.stringify({ processed: 0 }), { status: 200 });
  }

  let processed = 0;
  let failed = 0;

  for (const email of pendingEmails) {
    // Mark as processing (prevents double-processing)
    await supabase
      .from('email_queue')
      .update({ status: 'processing', updated_at: now })
      .eq('id', email.id)
      .eq('status', 'pending');  // Optimistic locking

    try {
      // Send via Resend
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: Deno.env.get("EMAIL_FROM_ADDRESS") || "tickets@magueynightclub.com",
          to: [email.recipient_email],
          subject: email.subject,
          html: email.html_body,
        }),
      });

      if (response.ok) {
        const { id: resendEmailId } = await response.json();

        // Mark as sent, store Resend ID for webhook correlation
        await supabase
          .from('email_queue')
          .update({
            status: 'sent',
            resend_email_id: resendEmailId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', email.id);

        processed++;
      } else {
        throw new Error(`Resend API error: ${response.status}`);
      }
    } catch (error) {
      const newAttemptCount = email.attempt_count + 1;

      if (newAttemptCount >= email.max_attempts) {
        // Permanently failed - notify owner
        await supabase
          .from('email_queue')
          .update({
            status: 'failed',
            attempt_count: newAttemptCount,
            last_error: error.message,
            updated_at: new Date().toISOString(),
          })
          .eq('id', email.id);

        // TODO: Call notify-email-failure function
        failed++;
      } else {
        // Schedule retry with exponential backoff
        const nextRetry = calculateNextRetryTime(newAttemptCount);

        await supabase
          .from('email_queue')
          .update({
            status: 'pending',
            attempt_count: newAttemptCount,
            next_retry_at: nextRetry.toISOString(),
            last_error: error.message,
            updated_at: new Date().toISOString(),
          })
          .eq('id', email.id);
      }
    }
  }

  return new Response(JSON.stringify({ processed, failed }), { status: 200 });
});

function calculateNextRetryTime(attemptCount: number): Date {
  const baseDelayMs = 60 * 1000;
  const maxDelayMs = 30 * 60 * 1000;
  const exponentialDelay = Math.min(baseDelayMs * Math.pow(2, attemptCount), maxDelayMs);
  const jitter = exponentialDelay * 0.1 * (Math.random() * 2 - 1);
  return new Date(Date.now() + exponentialDelay + jitter);
}
```

### Resend Webhook Handler
```typescript
// Source: Resend docs + Svix verification

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Webhook } from "https://esm.sh/svix@1.34.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error("RESEND_WEBHOOK_SECRET not configured");
      return new Response("Server misconfigured", { status: 500 });
    }

    // Get raw body for signature verification
    const rawBody = await req.text();

    // Verify webhook signature
    const wh = new Webhook(webhookSecret);
    const svixHeaders = {
      "svix-id": req.headers.get("svix-id") || "",
      "svix-timestamp": req.headers.get("svix-timestamp") || "",
      "svix-signature": req.headers.get("svix-signature") || "",
    };

    let event: { type: string; data: { email_id: string; [key: string]: unknown } };
    try {
      event = wh.verify(rawBody, svixHeaders) as typeof event;
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return new Response("Invalid signature", { status: 401 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { type, data } = event;
    const resendEmailId = data.email_id;

    console.log(`Resend webhook: ${type} for email ${resendEmailId}`);

    // Update email_queue status based on event type
    switch (type) {
      case "email.delivered":
        await supabase
          .from('email_queue')
          .update({ status: 'delivered', updated_at: new Date().toISOString() })
          .eq('resend_email_id', resendEmailId);
        break;

      case "email.bounced":
        await supabase
          .from('email_queue')
          .update({
            status: 'failed',
            last_error: `Bounced: ${data.bounce?.message || 'Unknown'}`,
            error_context: data.bounce,
            updated_at: new Date().toISOString(),
          })
          .eq('resend_email_id', resendEmailId);
        break;

      case "email.delivery_delayed":
        // Log but don't change status - delivery may still succeed
        console.warn(`Email ${resendEmailId} delivery delayed`);
        break;
    }

    // Store in email_delivery_status for audit trail
    await supabase
      .from('email_delivery_status')
      .insert({
        resend_email_id: resendEmailId,
        event_type: type,
        event_data: data,
      });

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Resend webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

### Database Schema
```sql
-- Source: Phase context decisions + Supabase patterns

-- Email queue table for retry mechanism
CREATE TABLE email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_type TEXT NOT NULL CHECK (email_type IN ('ga_ticket', 'vip_confirmation')),
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  related_id UUID,  -- ticket_id or reservation_id
  resend_email_id TEXT,  -- Populated after successful send
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'delivered', 'failed')),
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  next_retry_at TIMESTAMPTZ DEFAULT NOW(),
  last_error TEXT,
  error_context JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for queue processing
CREATE INDEX idx_email_queue_pending ON email_queue(next_retry_at)
  WHERE status = 'pending';
CREATE INDEX idx_email_queue_resend_id ON email_queue(resend_email_id)
  WHERE resend_email_id IS NOT NULL;
CREATE INDEX idx_email_queue_related ON email_queue(related_id, email_type);

-- Email delivery status for webhook tracking (audit trail)
CREATE TABLE email_delivery_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resend_email_id TEXT NOT NULL,
  event_type TEXT NOT NULL,  -- email.sent, email.delivered, email.bounced
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_delivery_resend_id ON email_delivery_status(resend_email_id);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fire-and-forget emails | Database queue with retries | Standard practice | Emails survive webhook timeouts |
| No delivery tracking | Resend webhooks | Resend feature | Know if emails actually delivered |
| setTimeout retries | pg_cron scheduling | Supabase feature | Retries survive process restarts |
| Manual HMAC | Svix library | Industry standard | Timing-safe verification, replay protection |

**Deprecated/outdated:**
- Polling Resend API for status: Use webhooks instead (real-time, no API calls)
- In-memory retry queues: Database-backed queues survive restarts

## Open Questions

Things that couldn't be fully resolved:

1. **Resend rate limits**
   - What we know: Resend has rate limits but specific numbers not documented publicly
   - What's unclear: Exact limits per second/minute
   - Recommendation: Start with 10 emails/minute batch size; adjust if 429 errors

2. **Webhook retry behavior**
   - What we know: Resend retries webhooks for up to 10 hours if no 200 response
   - What's unclear: Exact retry schedule (exponential backoff intervals)
   - Recommendation: Implement idempotency using resend_email_id to handle duplicate webhooks

## Sources

### Primary (HIGH confidence)
- [Supabase Scheduling Functions](https://supabase.com/docs/guides/functions/schedule-functions) - pg_cron + pg_net patterns
- [Supabase pg_net Extension](https://supabase.com/docs/guides/database/extensions/pg_net) - HTTP from Postgres
- [Svix Webhook Verification](https://docs.svix.com/receiving/verifying-payloads/how-manual) - Signature verification
- [Resend Webhooks Blog](https://resend.com/blog/webhooks) - Webhook setup and event types

### Secondary (MEDIUM confidence)
- [Resend Event Types Reference](https://resend.com/docs/dashboard/webhooks/event-types) - email.sent, email.delivered, email.bounced events
- [Queue-Based Exponential Backoff Pattern](https://dev.to/andreparis/queue-based-exponential-backoff-a-resilient-retry-pattern-for-distributed-systems-37f3) - Retry formula with jitter
- [Supabase Jobs with Tables](https://www.jigz.dev/blogs/how-i-solved-background-jobs-using-supabase-tables-and-edge-functions) - Table-based queue pattern
- [Inngest Resend Integration](https://www.inngest.com/docs/guides/resend-webhook-events) - Webhook payload examples

### Tertiary (LOW confidence)
- Resend npm package version 6.7.0 (from web search, verified current)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - pg_cron, pg_net, Resend, svix all well-documented
- Architecture: HIGH - Queue pattern is established; verified with official Supabase docs
- Pitfalls: MEDIUM - Based on common patterns and known issues; may be edge cases
- Code examples: HIGH - Based on official documentation patterns

**Research date:** 2026-01-29
**Valid until:** 2026-03-01 (30 days - stable technologies)
