# Phase 1: Payment Flow Hardening - Research

**Researched:** 2026-01-29
**Domain:** Stripe payment processing and webhook handling
**Confidence:** HIGH

## Summary

This research examines the current payment implementation in the Maguey Nightclub codebase and industry best practices for hardening Stripe payment flows for production. The system currently has working GA ticket and VIP table payment flows using Stripe Checkout Sessions and Payment Intents, with webhook handlers that process successful payments. However, critical production-hardening features are incomplete or missing: webhook idempotency is partially implemented (table exists but not enforced in webhook code), error messaging uses basic toast notifications without retry mechanisms, and testing infrastructure exists but lacks comprehensive failure scenario coverage.

The standard approach for production-grade Stripe integrations is: (1) webhook idempotency using Stripe event IDs as unique keys with database constraints as backup, (2) automatic retries with exponential backoff (5 attempts recommended), (3) comprehensive error handling with user-friendly messages and admin notifications, and (4) thorough testing using Stripe test mode, Stripe CLI for local webhook testing, and automated test suites covering both success and failure scenarios.

**Primary recommendation:** Harden the existing webhook handlers to enforce idempotency using the `webhook_idempotency` table (already exists in database), add comprehensive error handling with retry logic and owner notifications, enhance frontend error messaging with retry buttons, and expand test coverage to include failure scenarios using Stripe test mode and load testing.

## Standard Stack

The established libraries/tools for Stripe payment processing:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| stripe | ^20.0.0 | Stripe Node.js SDK for backend | Official Stripe SDK for server-side operations, used in Supabase Edge Functions |
| @stripe/stripe-js | ^8.3.0 | Stripe.js browser library | Official client-side library for tokenization and secure payment collection |
| @stripe/react-stripe-js | ^5.4.1 | React components for Stripe | Official React wrapper for Stripe Elements, provides payment form components |
| @supabase/supabase-js | ^2.78.0 | Supabase client library | Database and auth provider, used for order/ticket storage |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | ^2.1.8 | Unit testing framework | Already in package.json, for testing payment logic |
| @playwright/test | ^1.45.3 | E2E testing framework | Already in package.json, for testing checkout flows |
| sonner | ^1.7.4 | Toast notification library | Already in codebase, for user error messages |
| Stripe CLI | latest | Local webhook testing | Development and testing of webhook endpoints |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Stripe Checkout Sessions | Stripe Payment Intents only | Checkout Sessions provide hosted payment page (used for GA tickets), Payment Intents require custom UI (used for VIP tables). Current approach uses both appropriately. |
| Supabase Edge Functions | AWS Lambda / Vercel Functions | Edge Functions already in use, switching would require infrastructure rewrite. Keep existing. |
| Custom retry logic | Job queue (BullMQ, etc.) | Job queues add infrastructure complexity. Simple exponential backoff sufficient for this scale. |

**Installation:**
```bash
# Core dependencies already installed in package.json
# Development tools needed:
npm install -D stripe-cli  # For local webhook testing
```

## Architecture Patterns

### Current Project Structure
```
maguey-pass-lounge/
├── src/
│   ├── lib/
│   │   ├── stripe.ts                    # Stripe integration (checkout, payment intents)
│   │   ├── circuit-breaker.ts           # Circuit breaker for resilience
│   │   └── supabase.ts                  # Database client
│   ├── pages/
│   │   ├── Checkout.tsx                 # GA ticket selection
│   │   ├── Payment.tsx                  # GA ticket payment (redirects to Stripe)
│   │   ├── VIPBookingForm.tsx           # VIP table booking form
│   │   └── VipPayment.tsx               # VIP payment with embedded Stripe Elements
│   └── __tests__/
│       └── integration/
│           └── webhook-processing.test.ts # Webhook integration tests
├── supabase/
│   ├── functions/
│   │   ├── create-checkout-session/     # Creates GA checkout session
│   │   ├── create-vip-payment-intent/   # Creates VIP payment intent
│   │   ├── stripe-webhook/              # Main webhook handler (GA + VIP)
│   │   └── vip/webhook/                 # DEPRECATED VIP webhook (kept for compatibility)
│   └── migrations/
│       └── 20250325000000_add_webhook_idempotency.sql  # Idempotency table (EXISTS but NOT USED)
└── playwright/
    └── tests/
        └── checkout.spec.ts             # E2E checkout test (success path only)
```

### Pattern 1: Webhook Idempotency Check (CURRENTLY MISSING IN CODE)
**What:** Check if a webhook event has already been processed before handling it
**When to use:** At the start of every webhook handler function
**Example:**
```typescript
// Source: https://docs.stripe.com/webhooks + current codebase migration file
// NOTE: The webhook_idempotency table EXISTS in the database but is NOT used in stripe-webhook/index.ts

// CURRENT CODE (stripe-webhook/index.ts, line 538-570):
// Missing idempotency check - goes straight to signature verification

// RECOMMENDED PATTERN:
serve(async (req) => {
  const dynamicCorsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: dynamicCorsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    const signature = req.headers.get("stripe-signature");
    const body = await req.text();
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";

    // STEP 1: Parse event to get event ID
    const event = JSON.parse(body);
    const eventId = event.id;

    // STEP 2: Check idempotency BEFORE signature verification
    // This prevents replay attacks and reduces processing load
    const { data: idempotencyCheck } = await supabase
      .rpc('check_webhook_idempotency', {
        p_idempotency_key: eventId,
        p_webhook_type: 'stripe'
      })
      .single();

    if (idempotencyCheck?.is_duplicate) {
      console.log('Duplicate webhook event, returning cached response:', eventId);
      return new Response(
        JSON.stringify(idempotencyCheck.cached_response || { received: true }),
        {
          status: idempotencyCheck.cached_status || 200,
          headers: { ...dynamicCorsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    // STEP 3: Verify signature (current code does this)
    if (webhookSecret && signature) {
      const isValid = await verifyStripeSignature(body, signature, webhookSecret);
      if (!isValid) {
        console.error("Invalid Stripe webhook signature");
        return new Response("Invalid signature", { status: 401 });
      }
    }

    // STEP 4: Process webhook event (current code does this)
    // ... existing webhook processing logic ...

    // STEP 5: Update idempotency record with response
    const responseData = { received: true };
    await supabase.rpc('update_webhook_idempotency', {
      p_record_id: idempotencyCheck.record_id,
      p_response_data: responseData,
      p_response_status: 200
    });

    return new Response(JSON.stringify(responseData), {
      headers: { ...dynamicCorsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...dynamicCorsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
```

### Pattern 2: Database Constraint Backup for Idempotency
**What:** Use database unique constraints to prevent duplicate records even if webhook logic fails
**When to use:** On tables that webhooks create records in (tickets, vip_reservations, orders)
**Example:**
```sql
-- Source: https://docs.stripe.com/webhooks + industry best practices
-- CURRENT: tickets table has no Stripe payment intent constraint
-- RECOMMENDED: Add unique constraint on stripe_payment_intent_id or similar

-- For tickets table (GA tickets):
ALTER TABLE tickets
ADD CONSTRAINT unique_ticket_stripe_session
UNIQUE (stripe_session_id, ticket_type_id, order_id);

-- For vip_reservations table (VIP tables):
ALTER TABLE vip_reservations
ADD CONSTRAINT unique_vip_stripe_payment
UNIQUE (stripe_payment_intent_id);

-- For orders table:
ALTER TABLE orders
ADD CONSTRAINT unique_order_stripe_session
UNIQUE (stripe_session_id);
```

### Pattern 3: Payment Failure with Retry
**What:** Handle payment failures with automatic retry capability and exponential backoff
**When to use:** When Stripe payment fails or webhook processing fails after successful payment
**Example:**
```typescript
// Source: https://www.svix.com/resources/webhook-best-practices/retries/
// CURRENT: Payment.tsx shows errors in toast but no retry mechanism (lines 264-327)

// RECOMMENDED: Add retry logic with exponential backoff
async function createCheckoutSessionWithRetry(
  orderData: CheckoutSessionData,
  maxRetries: number = 5,
  baseDelayMs: number = 1000
): Promise<{ url: string; sessionId: string; orderId: string }> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await createCheckoutSession(orderData);
    } catch (error) {
      lastError = error as Error;

      // Don't retry user errors (card declined, invalid params)
      if (error.message.includes('card_declined') ||
          error.message.includes('insufficient_funds') ||
          error.message.includes('expired_card')) {
        throw error;
      }

      // Calculate exponential backoff with jitter
      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000;

      console.log(`Checkout session creation failed, attempt ${attempt + 1}/${maxRetries}, retrying in ${delay}ms`);

      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries exhausted - notify owner and throw
  await notifyOwnerOfFailedPayment(orderData, lastError);
  throw lastError;
}

// Owner notification function
async function notifyOwnerOfFailedPayment(
  orderData: CheckoutSessionData,
  error: Error | null
): Promise<void> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  // Create pending payment record
  await fetch(`${supabaseUrl}/functions/v1/notify-payment-failure`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      eventId: orderData.eventId,
      customerEmail: orderData.customerEmail,
      amount: orderData.totalAmount,
      error: error?.message || 'Unknown error',
      timestamp: new Date().toISOString(),
    }),
  });
}
```

### Pattern 4: User-Friendly Error Display with Retry Button
**What:** Show clear, actionable error messages with retry capability
**When to use:** When payment or checkout fails on frontend
**Example:**
```typescript
// Source: https://docs.stripe.com/error-handling + user decisions from CONTEXT.md
// CURRENT: Payment.tsx shows error in Alert component (line 264-269) but no retry button

// RECOMMENDED: Toast with retry button (per user decisions)
import { toast } from "sonner";

// Payment error handler
const handlePaymentError = (error: Error) => {
  // Simple, friendly message (per user decision)
  const userMessage = "Payment failed. Please try again.";

  // Show toast with retry button (per user decision: 5 second auto-dismiss)
  toast.error(userMessage, {
    duration: 5000,
    action: {
      label: 'Retry',
      onClick: () => {
        // Show loading overlay (per user decision)
        setIsLoading(true);
        handleCheckout();
      },
    },
  });

  // Log detailed error for debugging (per user decision)
  console.error('Payment error:', {
    message: error.message,
    timestamp: new Date().toISOString(),
    customerEmail: orderData.customerEmail,
  });
};
```

### Anti-Patterns to Avoid
- **Processing webhooks without idempotency checks:** Even though database has idempotency table, current code doesn't use it. This can cause duplicate tickets/reservations when Stripe retries.
- **Blocking webhook responses on slow operations:** Current code sends email synchronously in webhook (line 898-901 in stripe-webhook/index.ts). Move email sending to background queue or use fire-and-forget to keep webhook response fast.
- **Using webhook events as single source of truth:** Current code doesn't verify payment status independently. Should poll Stripe API for payment status as fallback if webhook fails.
- **Storing sensitive card data:** Code correctly uses Stripe.js for tokenization, never touches raw card numbers.
- **Not logging webhook processing:** Current code has good console.log statements but no structured logging for production monitoring.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Webhook signature verification | Custom HMAC implementation | Stripe's webhook signature verification (already used in code, line 468-508) | Stripe's verification handles timestamp validation, prevents replay attacks, and is battle-tested |
| Payment retry logic | Simple setTimeout loop | Exponential backoff with jitter | Prevents thundering herd problem, follows industry best practices, reduces load during outages |
| Duplicate webhook detection | Simple in-memory Set | Database table with RPC functions (already exists: webhook_idempotency table) | In-memory storage lost on restart, doesn't work across multiple server instances, database persists state |
| Error message normalization | Switch/case on error codes | Stripe's error object with user_message field + custom mapping | Stripe provides localized messages, handles edge cases, updates automatically |
| Idempotency key generation | UUID or timestamp | Stripe event.id for webhooks, session.id for checkouts | Guaranteed unique by Stripe, naturally deduplicates retries |
| Circuit breaker for resilience | Custom failure tracking | Library like opossum or custom implementation (already exists: circuit-breaker.ts) | Already implemented in codebase with proper state management |

**Key insight:** Stripe has already solved most payment edge cases (retries, security, deduplication). The database migration already created the idempotency infrastructure. The main work is wiring existing solutions together, not building new ones. Focus on integration, testing, and monitoring rather than reinventing payment primitives.

## Common Pitfalls

### Pitfall 1: Webhook Idempotency Table Exists But Isn't Used
**What goes wrong:** The codebase has a complete idempotency table (`webhook_idempotency`) with RPC functions (`check_webhook_idempotency`, `update_webhook_idempotency`) created in migration `20250325000000_add_webhook_idempotency.sql`, but the webhook handler (`stripe-webhook/index.ts`) doesn't call these functions. This means duplicate webhooks will process multiple times, creating duplicate tickets, reservations, and emails.

**Why it happens:** Migration was created but integration work was incomplete. The functions exist and are ready to use, just not wired up.

**How to avoid:** Add idempotency check at start of webhook handler (see Architecture Pattern 1 above). The infrastructure is ready, just needs to be called.

**Warning signs:** Multiple tickets created for same payment intent ID, duplicate emails sent, users report receiving multiple confirmations.

### Pitfall 2: Synchronous Email Sending in Webhook Handler
**What goes wrong:** Current webhook code sends emails synchronously using `await sendTicketEmail()` and `await sendVipConfirmationEmail()` (lines 898-901, 1150-1153 in stripe-webhook/index.ts). If email service is slow or down, webhook response is delayed or times out, causing Stripe to retry the entire webhook, leading to duplicate processing attempts.

**Why it happens:** Simplest implementation is to send email immediately. But webhooks should respond within 5 seconds (Stripe's timeout), and email sending can take longer.

**How to avoid:**
- Option 1: Fire-and-forget email sending (don't await, handle errors separately)
- Option 2: Queue emails for background processing (use Supabase job queue or separate Edge Function)
- Option 3: Return 200 immediately, process email asynchronously

**Warning signs:** Webhook timeouts in Stripe dashboard, duplicate webhook retries, slow webhook response times.

### Pitfall 3: Missing Database Constraints for Stripe IDs
**What goes wrong:** Tables like `tickets`, `orders`, and `vip_reservations` don't have unique constraints on Stripe resource IDs (payment_intent_id, session_id). Even with idempotency checks, database race conditions or logic errors could create duplicate records.

**Why it happens:** Application-level idempotency seems sufficient, but defense-in-depth requires database-level enforcement.

**How to avoid:** Add unique constraints on Stripe IDs (see Architecture Pattern 2). This is backup protection that catches bugs in application logic.

**Warning signs:** Duplicate tickets in database with same stripe_payment_intent_id, duplicate orders with same stripe_session_id.

### Pitfall 4: No Owner Notification on Payment-to-Ticket Failures
**What goes wrong:** Payment succeeds in Stripe, but ticket/reservation creation fails in database (network error, database constraint violation, etc.). Customer is charged but receives no ticket. Webhook returns 500 error, Stripe retries, but error persists. No one is notified.

**Why it happens:** Current code doesn't distinguish between payment failures (expected) and post-payment failures (critical). No alerting system for post-payment failures.

**How to avoid:**
- Detect when payment succeeded but ticket creation failed
- Create "pending" record in database visible in owner dashboard
- Send email to owner with payment details and error
- Implement manual reconciliation workflow for owner

**Warning signs:** Customer support tickets about charged-but-no-ticket, discrepancy between Stripe successful payments and ticket count in database.

### Pitfall 5: Testing Only Success Paths
**What goes wrong:** Current test suite (playwright/tests/checkout.spec.ts) only tests successful payment with test card 4242 4242 4242 4242. Doesn't test declined cards, webhook failures, duplicate webhooks, network errors, etc.

**Why it happens:** Success path is easiest to test and most common in development. Failure scenarios require mocking and are harder to reproduce.

**How to avoid:**
- Use Stripe's test cards for decline scenarios (4000 0000 0000 0002 for generic decline)
- Test webhook idempotency by sending same event.id twice
- Test webhook signature validation with invalid signatures
- Use Stripe CLI to trigger specific webhook events
- Add load tests to verify system handles 50 concurrent payments (per user requirement)

**Warning signs:** Production errors that never occurred in testing, unclear how system behaves under failure, no confidence in error handling.

### Pitfall 6: Circuit Breaker Not Applied to Webhook Processing
**What goes wrong:** Code has circuit breaker for frontend Stripe API calls (circuit-breaker.ts, used in stripe.ts), but webhook processing has no circuit breaker. If database is down, every webhook retry hammers the database, making recovery slower.

**Why it happens:** Circuit breaker was added for frontend resilience, webhook backend wasn't considered.

**How to avoid:** Wrap database operations in webhook handler with circuit breaker pattern. If database is failing, return 503 Service Unavailable to Stripe, triggering longer retry intervals.

**Warning signs:** Database connection exhaustion during outages, webhooks timing out during database issues, slow recovery after database comes back online.

## Code Examples

Verified patterns from official sources:

### Stripe Event ID Idempotency Check
```typescript
// Source: https://docs.stripe.com/webhooks (official Stripe docs)
// Pattern: Check event.id before processing webhook

const supabase = createClient(/* ... */);
const event = JSON.parse(body);

// Check if we've processed this event before
const { data: existing } = await supabase
  .from('webhook_idempotency')
  .select('id')
  .eq('idempotency_key', event.id)
  .eq('webhook_type', 'stripe')
  .single();

if (existing) {
  console.log('Duplicate webhook event:', event.id);
  return new Response(JSON.stringify({ received: true }), { status: 200 });
}

// Process event...

// Record that we processed it
await supabase
  .from('webhook_idempotency')
  .insert({
    idempotency_key: event.id,
    webhook_type: 'stripe',
    processed_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
  });
```

### Exponential Backoff with Jitter
```typescript
// Source: https://www.svix.com/resources/webhook-best-practices/retries/ (verified pattern)
// Pattern: Retry with exponential backoff and jitter

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 5,
  baseDelayMs: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;

      // Exponential backoff: 1s, 2s, 4s, 8s, 16s
      // Jitter: add random 0-1000ms to prevent thundering herd
      const delay = (baseDelayMs * Math.pow(2, attempt)) + (Math.random() * 1000);

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Should not reach here');
}
```

### Stripe Test Card Numbers
```typescript
// Source: https://docs.stripe.com/testing (official Stripe testing guide)
// Pattern: Use specific test cards to trigger different scenarios

const TEST_CARDS = {
  // Success scenarios
  SUCCESS: '4242 4242 4242 4242',
  SUCCESS_3DS: '4000 0025 0000 3155', // Requires 3D Secure authentication

  // Decline scenarios
  GENERIC_DECLINE: '4000 0000 0000 0002',
  INSUFFICIENT_FUNDS: '4000 0000 0000 9995',
  LOST_CARD: '4000 0000 0000 9987',
  STOLEN_CARD: '4000 0000 0000 9979',
  EXPIRED_CARD: '4000 0000 0000 0069',
  INCORRECT_CVC: '4000 0000 0000 0127',
  PROCESSING_ERROR: '4000 0000 0000 0119',

  // Special scenarios
  CHARGE_SUCCEEDS_BUT_DISPUTE_LATER: '4000 0000 0000 0259',
};

// In tests:
await page.getByLabel('Card number').fill(TEST_CARDS.INSUFFICIENT_FUNDS);
await page.getByRole('button', { name: /complete purchase/i }).click();
await expect(page.getByText(/insufficient funds/i)).toBeVisible();
```

### Webhook Signature Verification
```typescript
// Source: Current codebase stripe-webhook/index.ts lines 468-508
// Pattern: Verify webhook signature before processing (already implemented correctly)

async function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const parts = signature.split(",");
    const timestamp = parts.find((p) => p.startsWith("t="))?.split("=")[1];
    const v1Signature = parts.find((p) => p.startsWith("v1="))?.split("=")[1];

    if (!timestamp || !v1Signature) {
      console.error("Missing timestamp or signature");
      return false;
    }

    const signedPayload = `${timestamp}.${payload}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBytes = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(signedPayload)
    );

    const expectedSignature = Array.from(new Uint8Array(signatureBytes))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return expectedSignature === v1Signature;
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}
```

### Testing Webhooks Locally with Stripe CLI
```bash
# Source: https://docs.stripe.com/webhooks/test (official Stripe testing)
# Pattern: Forward webhooks to local development server

# Install Stripe CLI
brew install stripe/stripe-cli/stripe  # macOS
# or download from https://github.com/stripe/stripe-cli/releases

# Login to Stripe account
stripe login

# Forward webhooks to local server
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook

# In another terminal, trigger specific webhook events
stripe trigger checkout.session.completed
stripe trigger payment_intent.succeeded
stripe trigger payment_intent.payment_failed

# Test with specific amounts (in cents)
stripe trigger checkout.session.completed --amount 5000  # $50.00
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual webhook retry tracking | Stripe automatic retries with exponential backoff | Stripe v2 API (2015+) | Developers no longer need custom retry logic, Stripe handles retries for up to 3 days |
| Application-level idempotency only | Database constraints + application checks | Industry best practice (2020+) | Defense-in-depth prevents bugs, race conditions from creating duplicates |
| Checkout form custom UI | Stripe Checkout hosted page or Payment Element | Stripe v3 API (2019+) | Reduces PCI compliance scope, faster integration, better UX |
| Polling for payment status | Webhooks as primary notification | Stripe webhooks (2012+) | Real-time updates, reduced API calls, better user experience |
| In-memory circuit breaker | Persistent circuit breaker state | Modern resilience patterns (2018+) | Works across server restarts and multiple instances |

**Deprecated/outdated:**
- **Stripe Charges API**: Replaced by Payment Intents API (2019). Current code correctly uses Payment Intents.
- **Stripe Sources API**: Replaced by Payment Methods API (2019). Not used in current code.
- **Manual 3D Secure flow**: Replaced by automatic handling in Payment Intents. Current code gets this for free.
- **Separate VIP webhook endpoint** (vip/webhook/index.ts): Code comment marks as DEPRECATED, consolidated into main stripe-webhook. Should be removed after migration.

## Open Questions

Things that couldn't be fully resolved:

1. **Load Testing Target: 50 Concurrent Payments**
   - What we know: User requirement specifies 50 concurrent payments as target (from CONTEXT.md)
   - What's unclear: No existing load tests in codebase, unclear what "concurrent" means (50 payments in same second? 50 in-flight Stripe API calls? 50 webhooks processing simultaneously?)
   - Recommendation: Define concurrent as "50 checkout sessions created within 10 second window" + "50 webhooks received within 10 second window". Use k6 or Artillery for load testing. Add to Phase 1 testing requirements.

2. **Staging Environment Database Setup**
   - What we know: User decision says "Use BOTH Stripe test mode AND staging environment"
   - What's unclear: Does staging environment exist? Is it separate Supabase project? Same project, different schema?
   - Recommendation: Check if staging Supabase project exists. If not, create one. Use Stripe test mode in both local dev and staging. Use separate webhook signing secrets.

3. **Email Sending Reliability**
   - What we know: Webhook sends emails synchronously using Resend API (RESEND_API_KEY in env)
   - What's unclear: What happens if Resend is down? Should emails be queued? Is there retry for email failures?
   - Recommendation: Move email sending to fire-and-forget pattern (don't await). Create separate Edge Function for email processing that polls failed_emails table. Decouple email sending from webhook response.

4. **Owner Dashboard Notification Mechanism**
   - What we know: User decision says "notify owner via BOTH email AND dashboard notification" for failed payments
   - What's unclear: Dashboard notification system doesn't exist in codebase. How should it work?
   - Recommendation: Create `payment_failures` table with columns: id, event_id, customer_email, amount, error_message, resolved (boolean), created_at. Owner dashboard queries unresolved failures. Email sends separately using Resend.

5. **Cleanup Schedule for Idempotency Records**
   - What we know: User decision says "Store processed webhook event IDs for 30 days, then purge"
   - What's unclear: No scheduled job exists to call `cleanup_expired_webhook_idempotency()` function
   - Recommendation: Use Supabase pg_cron extension to schedule daily cleanup at 2am UTC. Add to Phase 1 implementation.

## Sources

### Primary (HIGH confidence)
- Stripe Official Documentation - [Webhooks](https://docs.stripe.com/webhooks) - Core webhook handling patterns
- Stripe Official Documentation - [Error Handling](https://docs.stripe.com/error-handling) - Error codes and user messages
- Stripe Official Documentation - [Testing](https://docs.stripe.com/testing) - Test cards and test mode
- Stripe Official Documentation - [Idempotent Requests](https://docs.stripe.com/api/idempotent_requests) - Idempotency best practices
- Current codebase - /maguey-pass-lounge/src/lib/stripe.ts - Existing payment integration
- Current codebase - /maguey-pass-lounge/supabase/functions/stripe-webhook/index.ts - Webhook handler
- Current codebase - /maguey-pass-lounge/supabase/migrations/20250325000000_add_webhook_idempotency.sql - Idempotency infrastructure

### Secondary (MEDIUM confidence)
- Svix - [Webhook Retry Best Practices](https://www.svix.com/resources/webhook-best-practices/retries/) - Exponential backoff patterns
- Hookdeck - [How to Implement Webhook Idempotency](https://hookdeck.com/webhooks/guides/implement-webhook-idempotency) - Industry patterns
- Hookdeck - [How to Test Stripe Webhooks Locally](https://hookdeck.com/webhooks/platforms/how-to-test-and-replay-stripe-webhooks-locally) - Local testing setup
- Medium - [Handling Payment Webhooks Reliably](https://medium.com/@sohail_saifii/handling-payment-webhooks-reliably-idempotency-retries-validation-69b762720bf5) - Implementation patterns
- Duncan Mackenzie - [Handling duplicate events from Stripe](https://www.duncanmackenzie.net/blog/handling-duplicate-stripe-events/) - Real-world experience

### Tertiary (LOW confidence)
- MagicBell - [Stripe Webhooks Complete Guide](https://www.magicbell.com/blog/stripe-webhooks-guide) - Overview and examples
- LaunchDarkly - [Best practices for testing Stripe webhook event processing](https://launchdarkly.com/blog/best-practices-for-testing-stripe-webhook-event-processing/) - Testing strategies

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Libraries verified in package.json, versions confirmed, all are industry standard
- Architecture: HIGH - Current codebase examined directly, patterns verified against official Stripe docs
- Pitfalls: HIGH - Based on analysis of current code gaps (idempotency not used, synchronous email) and official Stripe recommendations
- Testing approach: MEDIUM - Stripe testing docs are authoritative, but load testing specifics need definition

**Research date:** 2026-01-29
**Valid until:** 2026-03-01 (30 days for stable Stripe APIs, payment patterns change slowly)
