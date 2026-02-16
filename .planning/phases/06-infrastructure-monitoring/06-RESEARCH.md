# Phase 6: Infrastructure & Monitoring - Research

**Researched:** 2026-01-31
**Domain:** Production Monitoring, Rate Limiting, Error Tracking, Alerting
**Confidence:** HIGH

## Summary

This research covers the complete infrastructure and monitoring stack needed for the Maguey Nightclub Live project. The project already has Sentry integrated in maguey-pass-lounge with @sentry/react, and uses Resend for email delivery. The focus areas are:

1. **Health Check Endpoints** - Creating a unified health check edge function to monitor DB, Stripe, Resend, and edge function availability
2. **Rate Limiting** - Using Upstash Redis with @upstash/ratelimit for tiered rate limiting across edge functions
3. **Sentry Integration** - Extending existing @sentry/react setup to gate-scanner and nights, plus adding Sentry to edge functions via npm:@sentry/deno
4. **Structured Logging** - JSON logging patterns for edge functions with request ID correlation
5. **Email Alerts** - Using existing Resend integration with pg_cron for aggregated critical error alerts

**Primary recommendation:** Use Upstash Redis for rate limiting (established pattern in Supabase docs), extend existing Sentry setup to all apps, and create a health-check edge function that validates all critical services.

## Standard Stack

The established libraries/tools for this domain:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @sentry/react | ^10.32.0 | Frontend error tracking | Already in maguey-pass-lounge, official React SDK |
| @sentry/deno (npm) | latest | Edge function error tracking | Official Sentry SDK for Deno, documented by Supabase |
| @upstash/ratelimit | latest | Rate limiting | Official Supabase recommendation, serverless-optimized |
| @upstash/redis | latest | Redis client for rate limiting | HTTP-based, no TCP connections needed |
| Resend | 6.4.2 | Email alerts | Already integrated in project |
| pg_cron | built-in | Scheduled tasks | Native Supabase extension |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pg_net | built-in | HTTP from database | Call edge functions from cron jobs |
| Supabase Vault | built-in | Secret storage | Store Upstash credentials securely |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Upstash Redis | PostgreSQL rate limiting | DB load vs external dependency |
| Sentry | Self-hosted error tracking | Cost vs maintenance |
| pg_cron | External scheduler (e.g., GitHub Actions) | Integrated vs external management |

**Installation:**
```bash
# Frontend apps (gate-scanner, nights - already have for pass-lounge)
npm install @sentry/react

# No npm install needed for edge functions - use esm.sh imports
```

## Architecture Patterns

### Recommended Project Structure

```
supabase/functions/
├── health-check/           # Health check endpoint
│   └── index.ts
├── _shared/                 # Shared utilities
│   ├── rate-limiter.ts     # Upstash rate limiting wrapper
│   ├── logger.ts           # Structured logging utility
│   ├── sentry.ts           # Sentry initialization
│   └── cors.ts             # CORS headers (existing pattern)
└── [existing functions]/   # Add rate limiting + Sentry
```

### Pattern 1: Health Check Response Format

**What:** Standard JSON health check response following RFC Health Check Draft
**When to use:** All health check endpoints
**Example:**
```typescript
// Source: Industry standard health check pattern
interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version?: string;
  checks: {
    [service: string]: {
      status: 'healthy' | 'unhealthy';
      responseTime?: number;
      message?: string;
    };
  };
}

// Response example
{
  "status": "healthy",
  "timestamp": "2026-01-31T12:00:00Z",
  "checks": {
    "database": { "status": "healthy", "responseTime": 45 },
    "stripe": { "status": "healthy", "responseTime": 120 },
    "resend": { "status": "healthy", "responseTime": 85 },
    "edge_functions": { "status": "healthy" }
  }
}
```

### Pattern 2: Upstash Rate Limiting in Edge Functions

**What:** Tiered rate limiting using Upstash Redis sliding window algorithm
**When to use:** All public edge function endpoints
**Example:**
```typescript
// Source: https://supabase.com/docs/guides/functions/examples/rate-limiting
import { Ratelimit } from "https://cdn.skypack.dev/@upstash/ratelimit@latest";
import { Redis } from "https://esm.sh/@upstash/redis@latest";

// Create tiered rate limiters
const authRateLimiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(20, "60 s"), // 20/min for auth/payment
  prefix: "maguey:auth",
});

const readRateLimiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(200, "60 s"), // 200/min for reads
  prefix: "maguey:read",
});

// Usage in edge function
const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
const { success, remaining, reset } = await authRateLimiter.limit(clientIP);

if (!success) {
  return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
    status: 429,
    headers: {
      "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString(),
      "X-RateLimit-Remaining": remaining.toString(),
    },
  });
}
```

### Pattern 3: Sentry for Edge Functions (Deno)

**What:** Error tracking in Supabase Edge Functions using @sentry/deno
**When to use:** All edge functions
**Example:**
```typescript
// Source: https://supabase.com/docs/guides/functions/examples/sentry-monitoring
import * as Sentry from "https://deno.land/x/sentry/index.mjs";

Sentry.init({
  dsn: Deno.env.get("SENTRY_DSN"),
  defaultIntegrations: false, // IMPORTANT: Disable for concurrent request safety
  tracesSampleRate: 0.1,
});

// Set execution context tags
Sentry.setTag("region", Deno.env.get("SB_REGION"));
Sentry.setTag("execution_id", Deno.env.get("SB_EXECUTION_ID"));

Deno.serve(async (req) => {
  try {
    // Your handler code
  } catch (e) {
    Sentry.captureException(e);
    await Sentry.flush(2000); // IMPORTANT: Flush before response
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
    });
  }
});
```

### Pattern 4: Structured Logging with Request ID

**What:** JSON-formatted logs with request correlation
**When to use:** All edge function console output
**Example:**
```typescript
// Structured logger utility
interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  requestId: string;
  message: string;
  context?: Record<string, unknown>;
}

function createLogger(requestId: string) {
  const log = (level: LogEntry['level'], message: string, context?: Record<string, unknown>) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      requestId,
      message,
      context,
    };
    console.log(JSON.stringify(entry));
  };

  return {
    info: (msg: string, ctx?: Record<string, unknown>) => log('info', msg, ctx),
    warn: (msg: string, ctx?: Record<string, unknown>) => log('warn', msg, ctx),
    error: (msg: string, ctx?: Record<string, unknown>) => log('error', msg, ctx),
  };
}

// Usage
const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
const logger = createLogger(requestId);
logger.info("Processing checkout", { eventId, ticketCount: 3 });
```

### Pattern 5: Sentry React 18 Setup

**What:** Error boundary and error hooks for React 18 apps
**When to use:** All React frontend apps (gate-scanner, pass-lounge, nights)
**Example:**
```typescript
// Source: https://docs.sentry.io/platforms/javascript/guides/react/
import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";

// Initialize early in entry point
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
  replaysOnErrorSampleRate: 0.1,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
  ],
});

// React 18 error hooks
const root = createRoot(container, {
  onUncaughtError: Sentry.reactErrorHandler(),
  onCaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
});

// Or use ErrorBoundary component
<Sentry.ErrorBoundary fallback={<ErrorFallback />}>
  <App />
</Sentry.ErrorBoundary>
```

### Anti-Patterns to Avoid

- **Rate limiting after function invocation:** Too late - function already executed. Use Upstash at the start.
- **Sharing Sentry scope across requests:** Disable defaultIntegrations in edge functions to prevent breadcrumb contamination.
- **Stringifying Headers directly:** Use `Object.fromEntries(req.headers)` - Headers objects are opaque to JSON.stringify.
- **Long console.log messages:** Max 10,000 chars per log, 100 events per 10 seconds.
- **Blocking on Sentry.flush():** Use fire-and-forget for non-critical paths, flush only on errors.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate limiting | In-memory counters | @upstash/ratelimit | Distributed, serverless-optimized, sliding window algorithm |
| Error tracking | Console.error + manual alerts | Sentry | Stack traces, user context, release tracking, source maps |
| Scheduled tasks | External cron | pg_cron + pg_net | Native to Supabase, no external dependency |
| API health checks | Manual pings | Dedicated health-check function | Standardized format, aggregated status |
| Log aggregation | grep through dashboard | Structured JSON logs | Searchable, parseable by log tools |

**Key insight:** These are solved problems with mature solutions. Custom implementations add maintenance burden and miss edge cases (rate limit races, error grouping, timezone handling for cron).

## Common Pitfalls

### Pitfall 1: Sentry Scope Contamination in Edge Functions

**What goes wrong:** Breadcrumbs and context from one request appear in another request's error report
**Why it happens:** Sentry's default integrations share global state; edge functions handle concurrent requests
**How to avoid:** Set `defaultIntegrations: false` in Sentry.init() for edge functions
**Warning signs:** Error reports show unrelated breadcrumbs or user context

### Pitfall 2: Rate Limit Counter Race Conditions

**What goes wrong:** Rate limits exceeded when using in-memory or simple DB counters
**Why it happens:** Concurrent requests create race conditions in check-then-increment patterns
**How to avoid:** Use Upstash's atomic sliding window implementation
**Warning signs:** Rate limits allow more requests than configured during traffic spikes

### Pitfall 3: Missing Retry-After Header

**What goes wrong:** Clients hammer the API repeatedly after 429 responses
**Why it happens:** Without Retry-After, clients don't know when to retry
**How to avoid:** Always include Retry-After header in 429 responses (in seconds)
**Warning signs:** 429 rate spikes in logs with repeated client IPs

### Pitfall 4: Health Check Timeouts

**What goes wrong:** Health check marks service unhealthy due to slow response, not actual failure
**Why it happens:** Health check times out waiting for external service (Stripe, Resend)
**How to avoid:** Set reasonable timeouts per service (2-5s for external APIs), use AbortController
**Warning signs:** Flapping health status, false unhealthy alerts

### Pitfall 5: Alert Spam from Repeated Errors

**What goes wrong:** Owner receives hundreds of emails for the same error
**Why it happens:** Each error triggers an alert without deduplication
**How to avoid:** Aggregate errors before alerting using a digest table with pg_cron
**Warning signs:** Owner unsubscribes from alerts due to noise

### Pitfall 6: Webhook Rate Limiting

**What goes wrong:** Stripe/Resend webhooks blocked by rate limiting
**Why it happens:** Webhook endpoints included in rate limit rules
**How to avoid:** Exempt webhook endpoints from rate limiting (they have their own replay protection)
**Warning signs:** Missed webhook events, payment confirmations delayed

## Code Examples

Verified patterns from official sources:

### Health Check Edge Function

```typescript
// supabase/functions/health-check/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ServiceCheck {
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  message?: string;
}

async function checkDatabase(supabase: ReturnType<typeof createClient>): Promise<ServiceCheck> {
  const start = Date.now();
  try {
    // Simple query to verify DB connection
    const { error } = await supabase.from('events').select('id').limit(1);
    if (error) throw error;
    return { status: 'healthy', responseTime: Date.now() - start };
  } catch (e) {
    return { status: 'unhealthy', message: e.message };
  }
}

async function checkStripe(): Promise<ServiceCheck> {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    // Use Stripe's healthcheck endpoint
    const response = await fetch('https://api.stripe.com/healthcheck', {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response.ok
      ? { status: 'healthy', responseTime: Date.now() - start }
      : { status: 'unhealthy', message: `Status: ${response.status}` };
  } catch (e) {
    clearTimeout(timeout);
    return { status: 'unhealthy', message: e.message };
  }
}

async function checkResend(): Promise<ServiceCheck> {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    // Verify Resend API key by listing domains (lightweight call)
    const response = await fetch('https://api.resend.com/domains', {
      headers: { 'Authorization': `Bearer ${Deno.env.get("RESEND_API_KEY")}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response.ok
      ? { status: 'healthy', responseTime: Date.now() - start }
      : { status: 'unhealthy', message: `Status: ${response.status}` };
  } catch (e) {
    clearTimeout(timeout);
    return { status: 'unhealthy', message: e.message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Run checks in parallel
  const [database, stripe, resend] = await Promise.all([
    checkDatabase(supabase),
    checkStripe(),
    checkResend(),
  ]);

  const checks = { database, stripe, resend, edge_functions: { status: 'healthy' as const } };

  // Determine overall status
  const allHealthy = Object.values(checks).every(c => c.status === 'healthy');
  const anyUnhealthy = Object.values(checks).some(c => c.status === 'unhealthy');

  const response = {
    status: allHealthy ? 'healthy' : anyUnhealthy ? 'unhealthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
  };

  return new Response(JSON.stringify(response), {
    status: allHealthy ? 200 : 503,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
```

### Rate Limiter Shared Module

```typescript
// supabase/functions/_shared/rate-limiter.ts
import { Ratelimit } from "https://cdn.skypack.dev/@upstash/ratelimit@latest";
import { Redis } from "https://esm.sh/@upstash/redis@latest";

type EndpointType = 'auth' | 'payment' | 'read' | 'webhook';

const rateLimiters: Record<EndpointType, Ratelimit> = {
  auth: new Ratelimit({
    redis: new Redis({
      url: Deno.env.get("UPSTASH_REDIS_REST_URL")!,
      token: Deno.env.get("UPSTASH_REDIS_REST_TOKEN")!,
    }),
    limiter: Ratelimit.slidingWindow(20, "60 s"),
    prefix: "maguey:auth",
  }),
  payment: new Ratelimit({
    redis: new Redis({
      url: Deno.env.get("UPSTASH_REDIS_REST_URL")!,
      token: Deno.env.get("UPSTASH_REDIS_REST_TOKEN")!,
    }),
    limiter: Ratelimit.slidingWindow(20, "60 s"),
    prefix: "maguey:payment",
  }),
  read: new Ratelimit({
    redis: new Redis({
      url: Deno.env.get("UPSTASH_REDIS_REST_URL")!,
      token: Deno.env.get("UPSTASH_REDIS_REST_TOKEN")!,
    }),
    limiter: Ratelimit.slidingWindow(200, "60 s"),
    prefix: "maguey:read",
  }),
  webhook: null as any, // Webhooks exempt from rate limiting
};

export async function checkRateLimit(
  req: Request,
  endpointType: EndpointType
): Promise<{ allowed: boolean; response?: Response }> {
  // Webhooks are exempt
  if (endpointType === 'webhook') {
    return { allowed: true };
  }

  const limiter = rateLimiters[endpointType];
  if (!limiter) {
    return { allowed: true };
  }

  // Get client identifier (IP address)
  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "unknown";

  const { success, remaining, reset } = await limiter.limit(clientIP);

  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);
    return {
      allowed: false,
      response: new Response(
        JSON.stringify({
          error: "Rate limit exceeded",
          retryAfter,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": retryAfter.toString(),
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": reset.toString(),
          },
        }
      ),
    };
  }

  return { allowed: true };
}
```

### Sentry Edge Function Wrapper

```typescript
// supabase/functions/_shared/sentry.ts
import * as Sentry from "https://deno.land/x/sentry/index.mjs";

let initialized = false;

export function initSentry() {
  if (initialized) return;

  const dsn = Deno.env.get("SENTRY_DSN");
  if (!dsn) {
    console.log("[Sentry] No DSN configured, skipping initialization");
    return;
  }

  Sentry.init({
    dsn,
    defaultIntegrations: false, // CRITICAL: Prevents scope contamination
    tracesSampleRate: 0.1,
    environment: Deno.env.get("ENVIRONMENT") || "production",
  });

  initialized = true;
}

export function setRequestContext(req: Request) {
  Sentry.setTag("region", Deno.env.get("SB_REGION") || "unknown");
  Sentry.setTag("execution_id", Deno.env.get("SB_EXECUTION_ID") || "unknown");
  Sentry.setTag("function", req.url);
}

export async function captureError(error: Error, context?: Record<string, unknown>) {
  Sentry.captureException(error, { extra: context });
  await Sentry.flush(2000);
}

export { Sentry };
```

### Alert Digest Table and Aggregation

```sql
-- Migration: Create alert_digest table for aggregating errors
CREATE TABLE IF NOT EXISTS alert_digest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_type TEXT NOT NULL,
  error_hash TEXT NOT NULL, -- Hash of error message for grouping
  first_occurrence TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_occurrence TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  sample_error JSONB NOT NULL, -- First error details for context
  notified_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  UNIQUE(error_hash, DATE(first_occurrence))
);

-- Function to aggregate errors (called by edge functions)
CREATE OR REPLACE FUNCTION aggregate_error(
  p_error_type TEXT,
  p_error_message TEXT,
  p_error_details JSONB
) RETURNS UUID AS $$
DECLARE
  v_hash TEXT;
  v_id UUID;
BEGIN
  -- Create hash from error type and message
  v_hash := md5(p_error_type || ':' || p_error_message);

  -- Upsert error into digest
  INSERT INTO alert_digest (error_type, error_hash, sample_error)
  VALUES (p_error_type, v_hash, p_error_details)
  ON CONFLICT (error_hash, DATE(first_occurrence))
  DO UPDATE SET
    last_occurrence = NOW(),
    occurrence_count = alert_digest.occurrence_count + 1
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- pg_cron job to send digest emails (every 15 minutes)
SELECT cron.schedule(
  'send-error-digest',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
           || '/functions/v1/send-error-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `deno.land/x/sentry` | `npm:@sentry/deno` | 2024 | npm import is now recommended, deno.land deprecated |
| In-memory rate limits | Upstash Redis | Ongoing | Distributed rate limiting works across function instances |
| Manual error emails | Sentry + digest | Best practice | Proper error grouping, actionable alerts |
| Console.log strings | Structured JSON | Best practice | Searchable logs, better debugging |

**Deprecated/outdated:**
- `deno.land/x/sentry` import: Use `npm:@sentry/deno` or `https://deno.land/x/sentry/index.mjs`
- PostgreSQL-only rate limiting: Works but adds DB load; Upstash preferred for high-traffic

## Open Questions

Things that couldn't be fully resolved:

1. **Upstash Free Tier Limits**
   - What we know: Upstash has a free tier with 10,000 commands/day
   - What's unclear: Whether this is sufficient for Maguey's traffic
   - Recommendation: Start with free tier, monitor usage, upgrade if needed

2. **Sentry Deno SDK Maturity**
   - What we know: Official SDK exists, documented by Supabase
   - What's unclear: Some GitHub issues report inconsistencies with Deno.serve instrumentation
   - Recommendation: Use documented pattern with defaultIntegrations: false

3. **Resend Health Check Endpoint**
   - What we know: No dedicated health endpoint documented
   - What's unclear: Best lightweight API call to verify connectivity
   - Recommendation: Use `/domains` list endpoint with short timeout

## Sources

### Primary (HIGH confidence)
- [Supabase Edge Functions Rate Limiting](https://supabase.com/docs/guides/functions/examples/rate-limiting) - Official rate limiting guide
- [Supabase Sentry Monitoring](https://supabase.com/docs/guides/functions/examples/sentry-monitoring) - Official Sentry integration
- [Supabase Edge Functions Logging](https://supabase.com/docs/guides/functions/logging) - Logging constraints and patterns
- [Supabase Scheduling Functions](https://supabase.com/docs/guides/functions/schedule-functions) - pg_cron + edge functions
- [Sentry Deno SDK](https://docs.sentry.io/platforms/javascript/guides/deno/) - Official Deno documentation
- [Sentry React SDK](https://docs.sentry.io/platforms/javascript/guides/react/) - React 18 error boundary patterns
- [Upstash Ratelimit Getting Started](https://upstash.com/docs/redis/sdks/ratelimit-ts/gettingstarted) - Official ratelimit docs
- [Upstash Ratelimit GitHub](https://github.com/upstash/ratelimit-js) - Library source and examples

### Secondary (MEDIUM confidence)
- [Stripe Health Alerts](https://docs.stripe.com/health-alerts) - Stripe monitoring capabilities
- [Resend Status](https://resend-status.com) - Resend service status page

### Tertiary (LOW confidence)
- Community discussions on rate limiting approaches

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries are official recommendations from Supabase/Sentry docs
- Architecture: HIGH - Patterns verified from official documentation
- Pitfalls: MEDIUM - Some derived from community discussions and best practices
- Health check patterns: MEDIUM - No official Resend health endpoint documented

**Research date:** 2026-01-31
**Valid until:** 2026-03-01 (30 days - stable domain, well-documented stack)
