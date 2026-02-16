# Integration Improvements & Recommendations

Based on the comprehensive analysis, here are specific improvements you can implement:

## 🔒 Security Improvements

### 1. Enable Leaked Password Protection

**Location:** Supabase Dashboard → Authentication → Password Security

**Steps:**
1. Navigate to your Supabase project dashboard
2. Go to Authentication → Password Security
3. Enable "Leaked Password Protection"
4. This will check passwords against HaveIBeenPwned.org

**Impact:** Prevents users from using compromised passwords

---

### 2. Add Rate Limiting to Edge Functions

**File:** `supabase/functions/event-availability/index.ts`

**Add this at the top:**
```typescript
// Rate limiting (simple in-memory, consider Redis for production)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const limit = rateLimitMap.get(ip);
  
  if (!limit || now > limit.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60000 }); // 1 minute window
    return true;
  }
  
  if (limit.count >= 100) { // 100 requests per minute
    return false;
  }
  
  limit.count++;
  return true;
}

// In the serve function:
const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
if (!checkRateLimit(clientIp)) {
  return new Response(
    JSON.stringify({ error: 'Rate limit exceeded' }),
    { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

**Impact:** Prevents abuse and DDoS attacks

---

### 3. Add Webhook Signature Verification

**File:** `supabase/functions/ticket-webhook/index.ts`

**Add Stripe webhook verification:**
```typescript
import Stripe from 'https://esm.sh/stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

// Verify Stripe webhook signature
const stripeSignature = req.headers.get('stripe-signature');
const webhookSecret = Deno.env.get('STRripe_WEBHOOK_SECRET');

if (stripeSignature && webhookSecret) {
  try {
    const event = stripe.webhooks.constructEvent(
      await req.text(),
      stripeSignature,
      webhookSecret
    );
    // Process verified event
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Invalid webhook signature' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
```

**Impact:** Prevents unauthorized ticket creation

---

## 📊 Monitoring & Observability

### 4. Add Error Tracking

**Install Sentry:**
```bash
npm install @sentry/react @sentry/browser
```

**Add to `src/main.tsx`:**
```typescript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [
    new Sentry.BrowserTracing(),
  ],
  tracesSampleRate: 1.0,
});
```

**Impact:** Better visibility into production errors

---

### 5. Add Request Logging

**File:** `supabase/functions/event-availability/index.ts`

**Add logging:**
```typescript
const logRequest = {
  timestamp: new Date().toISOString(),
  function: 'event-availability',
  eventName,
  ip: req.headers.get('x-forwarded-for'),
  userAgent: req.headers.get('user-agent'),
};

console.log(JSON.stringify(logRequest));

// Optionally store in a logs table
await supabase.from('function_logs').insert({
  function_name: 'event-availability',
  event_name: eventName,
  ip_address: req.headers.get('x-forwarded-for'),
  user_agent: req.headers.get('user-agent'),
  created_at: new Date().toISOString(),
});
```

**Impact:** Better debugging and audit trail

---

## ⚡ Performance Improvements

### 6. Add Database Indexes

**Create migration:**
```sql
-- Add indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_tickets_event_name ON tickets(event_name);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_qr_token ON tickets(qr_token);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_event_id ON orders(event_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_is_active ON events(is_active);
```

**Impact:** Faster queries, especially for large datasets

---

### 7. Add Caching for Event Availability

**File:** `supabase/functions/event-availability/index.ts`

**Add caching:**
```typescript
// Simple cache (consider Redis for production)
const cache = new Map<string, { data: any; expiresAt: number }>();

const cacheKey = `availability:${eventName}`;
const cached = cache.get(cacheKey);

if (cached && Date.now() < cached.expiresAt) {
  return new Response(
    JSON.stringify(cached.data),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' } }
  );
}

// ... fetch data ...

// Cache for 30 seconds
cache.set(cacheKey, {
  data: response,
  expiresAt: Date.now() + 30000,
});

// Clean up old cache entries periodically
if (cache.size > 1000) {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now > value.expiresAt) {
      cache.delete(key);
    }
  }
}
```

**Impact:** Reduced database load, faster responses

---

## 🔄 Resilience Improvements

### 8. Add Retry Logic

**Create utility:**
```typescript
// src/lib/retry.ts
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries - 1) {
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt)));
      }
    }
  }
  
  throw lastError || new Error('Operation failed after retries');
}

// Usage:
import { retryOperation } from '@/lib/retry';

const data = await retryOperation(
  () => supabase.from('tickets').select('*').eq('id', ticketId).single(),
  3,
  1000
);
```

**Impact:** Better resilience to transient failures

---

## 🧪 Testing Improvements

### 9. Add Integration Tests

**Create:** `tests/integration/purchase-flow.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

describe('Purchase Flow Integration', () => {
  it('should create order and tickets via webhook', async () => {
    // Test webhook endpoint
    const response = await fetch('/functions/v1/ticket-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tickets: [{
          ticket_id: 'TEST-123',
          event_name: 'Test Event',
          ticket_type: 'VIP',
        }],
      }),
    });
    
    expect(response.status).toBe(201);
    
    // Verify ticket was created
    const { data } = await supabase
      .from('tickets')
      .select('*')
      .eq('ticket_id', 'TEST-123')
      .single();
    
    expect(data).toBeDefined();
  });
});
```

**Impact:** Catch integration issues early

---

## 📝 Documentation Improvements

### 10. Add API Documentation

**Create:** `docs/API.md`

Document all edge functions with:
- Request/response formats
- Error codes
- Rate limits
- Authentication requirements

**Use OpenAPI/Swagger:**
```yaml
openapi: 3.0.0
paths:
  /functions/v1/event-availability/{eventName}:
    get:
      summary: Get event availability
      parameters:
        - name: eventName
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: object
```

**Impact:** Better developer experience

---

## 🎯 Priority Implementation Order

1. **Week 1:**
   - ✅ Enable leaked password protection (5 min)
   - ✅ Add database indexes (15 min)
   - ✅ Add rate limiting (2 hours)

2. **Week 2:**
   - Add webhook signature verification (1 hour)
   - Add error tracking (2 hours)
   - Add request logging (2 hours)

3. **Week 3:**
   - Add caching (3 hours)
   - Add retry logic (3 hours)
   - Add integration tests (8 hours)

4. **Ongoing:**
   - Monitor performance
   - Optimize queries
   - Update documentation

---

## 📞 Support

If you need help implementing any of these improvements, feel free to ask!

