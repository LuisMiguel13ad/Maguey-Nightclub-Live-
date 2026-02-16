# Phase 10: Load Testing & Performance - Research

**Researched:** 2026-01-31
**Domain:** k6 load testing, Supabase Edge Functions, Stripe webhooks, WebSocket subscriptions
**Confidence:** HIGH

## Summary

This research covers load testing patterns for the Maguey Nightclub system using k6, the JavaScript-based load testing tool specified in CONTEXT.md. The system requires testing across multiple domains: ticket purchase flows hitting Supabase Edge Functions, scanner operations against RPC endpoints, Stripe webhook burst handling, and Supabase Realtime subscriptions.

k6 is well-suited for this task with native support for HTTP requests, WebSockets, and thresholds configuration. The established pattern involves writing JavaScript test scripts with `options` objects defining VU (virtual user) stages, thresholds, and scenarios. Multiple scenarios can test different endpoints simultaneously with different load profiles.

**Primary recommendation:** Use k6 with separate scenarios for each critical path (purchases, scanning, webhooks, dashboard), configure p95 < 500ms thresholds as specified, and simulate Stripe webhooks by generating valid HMAC signatures programmatically.

## Standard Stack

The established tools for load testing Supabase applications.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| k6 | Latest (v0.50+) | Load testing runner | Modern, JS-based, official Grafana tool, built-in metrics |
| k6/http | Built-in | HTTP requests | Native k6 module for REST API testing |
| k6/ws | Built-in | WebSocket testing | Native k6 module for Supabase Realtime |
| k6/metrics | Built-in | Custom metrics | Track domain-specific measurements |
| k6/check | Built-in | Response validation | Assertion framework for pass/fail |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| k6/data SharedArray | Built-in | Test data management | When testing with JSON payloads at scale |
| k6/execution | Built-in | Iteration context | Accessing VU/iteration info for unique data |
| k6-utils | 1.3.0+ | Helper functions | Random selection, stage detection |
| @grafana/k6-cloud | Optional | Cloud execution | Distributed testing at scale |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| k6 | JMeter | JMeter is GUI-heavy, less CI/CD friendly; k6 is developer-centric |
| k6 | Artillery | Artillery lacks native WebSocket support depth |
| k6 | Locust | Locust requires Python; k6 uses JavaScript matching stack |

**Installation:**
```bash
# macOS
brew install k6

# Windows
winget install k6

# Linux/Docker
docker pull grafana/k6
```

## Architecture Patterns

### Recommended Project Structure
```
load-tests/
├── config/
│   └── thresholds.js       # Shared threshold definitions
├── scenarios/
│   ├── ticket-purchase.js  # 100 VU purchase load test
│   ├── scanner-burst.js    # 10 VU simultaneous scans
│   ├── dashboard-load.js   # 20 VU dashboard viewers
│   └── webhook-burst.js    # 50 webhook events burst
├── helpers/
│   ├── auth.js             # Supabase auth token generation
│   ├── stripe-signature.js # HMAC signature for webhooks
│   └── data-generators.js  # Test data factories
├── data/
│   ├── test-events.json    # Event IDs for testing
│   ├── test-tickets.json   # Valid ticket tokens
│   └── webhook-payloads.json # Sample Stripe payloads
└── run-all.js              # Combined multi-scenario test
```

### Pattern 1: Multi-Scenario Test Structure
**What:** Run multiple test scenarios with different VU counts and executors
**When to use:** Testing the full system with realistic mixed traffic
**Example:**
```javascript
// Source: Grafana k6 documentation - Scenarios
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    ticket_purchases: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },  // Ramp up
        { duration: '1m', target: 100 },  // Hold at 100 VUs
        { duration: '30s', target: 0 },   // Ramp down
      ],
      exec: 'purchaseTickets',
    },
    scanner_operations: {
      executor: 'constant-vus',
      vus: 10,
      duration: '2m',
      startTime: '30s',  // Start after purchases begin
      exec: 'scanTickets',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],  // p95 < 500ms
    http_req_failed: ['rate<0.01'],    // Error rate < 1%
  },
};

export function purchaseTickets() {
  // Purchase flow implementation
}

export function scanTickets() {
  // Scanner flow implementation
}
```

### Pattern 2: Authenticated Requests to Supabase
**What:** Include Supabase anon key and optional JWT for authenticated requests
**When to use:** All Supabase Edge Function calls
**Example:**
```javascript
// Source: k6 HTTP Authentication documentation
import http from 'k6/http';

const SUPABASE_URL = __ENV.SUPABASE_URL;
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY;

export default function () {
  const payload = JSON.stringify({
    eventId: 'test-event-id',
    tickets: [{ ticketTypeId: 'ga', quantity: 2, unitPrice: 50, unitFee: 5 }],
    customerEmail: 'test@example.com',
    customerName: 'Test User',
    totalAmount: 110,
    successUrl: 'https://example.com/success',
    cancelUrl: 'https://example.com/cancel',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
  };

  const res = http.post(
    `${SUPABASE_URL}/functions/v1/create-checkout-session`,
    payload,
    params
  );

  check(res, {
    'status is 200': (r) => r.status === 200,
    'has sessionId': (r) => JSON.parse(r.body).sessionId !== undefined,
  });
}
```

### Pattern 3: Stripe Webhook Simulation with Signature
**What:** Generate valid HMAC-SHA256 signatures to simulate Stripe webhooks
**When to use:** Testing webhook burst handling (50 events in 10 seconds)
**Example:**
```javascript
// Source: Stripe webhook signatures documentation + k6
import http from 'k6/http';
import crypto from 'k6/crypto';
import encoding from 'k6/encoding';

const WEBHOOK_SECRET = __ENV.STRIPE_WEBHOOK_SECRET;
const SUPABASE_URL = __ENV.SUPABASE_URL;

function generateStripeSignature(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;

  // k6 uses crypto.hmac for HMAC-SHA256
  const signature = crypto.hmac('sha256', secret, signedPayload, 'hex');

  return `t=${timestamp},v1=${signature}`;
}

export default function () {
  const payload = JSON.stringify({
    id: `evt_test_${Date.now()}`,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: `cs_test_${Date.now()}`,
        payment_intent: `pi_test_${Date.now()}`,
        customer_email: 'test@example.com',
        metadata: {
          orderId: 'test-order-id',
          eventId: 'test-event-id',
          customerEmail: 'test@example.com',
          customerName: 'Test User',
          tickets: JSON.stringify([
            { ticketTypeId: 'ga', quantity: 1, unitPrice: 50, displayName: 'GA' }
          ]),
        },
      },
    },
  });

  const signature = generateStripeSignature(payload, WEBHOOK_SECRET);

  const res = http.post(
    `${SUPABASE_URL}/functions/v1/stripe-webhook`,
    payload,
    {
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': signature,
      },
    }
  );

  check(res, {
    'webhook accepted': (r) => r.status === 200,
  });
}
```

### Pattern 4: WebSocket for Realtime Subscriptions
**What:** Test Supabase Realtime subscriptions under load
**When to use:** Dashboard real-time updates testing
**Example:**
```javascript
// Source: k6 WebSocket documentation
import ws from 'k6/ws';
import { check } from 'k6';

const SUPABASE_URL = __ENV.SUPABASE_URL.replace('https://', 'wss://');
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY;

export default function () {
  const url = `${SUPABASE_URL}/realtime/v1/websocket?apikey=${SUPABASE_ANON_KEY}&vsn=1.0.0`;

  const res = ws.connect(url, {}, function (socket) {
    socket.on('open', () => {
      // Join a channel for ticket updates
      socket.send(JSON.stringify({
        topic: 'realtime:public:tickets',
        event: 'phx_join',
        payload: {},
        ref: '1',
      }));
    });

    socket.on('message', (data) => {
      const msg = JSON.parse(data);
      if (msg.event === 'phx_reply' && msg.payload.status === 'ok') {
        console.log('Joined channel successfully');
      }
    });

    // Keep connection alive for 30 seconds
    socket.setTimeout(function () {
      socket.close();
    }, 30000);

    // Send heartbeat every 25 seconds (Supabase requirement)
    socket.setInterval(function () {
      socket.send(JSON.stringify({
        topic: 'phoenix',
        event: 'heartbeat',
        payload: {},
        ref: Date.now().toString(),
      }));
    }, 25000);
  });

  check(res, { 'WebSocket connected': (r) => r && r.status === 101 });
}
```

### Anti-Patterns to Avoid
- **Hardcoding credentials:** Always use `__ENV` for secrets; never commit real keys
- **Skipping signature verification in tests:** Test with real signatures to validate the full path
- **Single-threaded webhook testing:** Webhooks need burst testing with concurrent requests
- **Ignoring ramp-down:** Always include graceful ramp-down to measure cleanup behavior
- **Testing production directly:** Use staging/test Supabase project as specified in CONTEXT.md

## Don't Hand-Roll

Problems that look simple but have existing solutions.

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HMAC signatures | Custom crypto | k6/crypto module | k6 has built-in crypto with hmac() |
| Random test data | Math.random loops | k6-utils randomItem | Proper distribution, SharedArray support |
| Response timing | Manual Date.now() | k6 built-in metrics | http_req_duration auto-captured |
| Concurrent execution | Promise.all patterns | k6 scenarios/executors | Native VU management with ramping |
| Result aggregation | Manual JSON output | k6 --out options | InfluxDB, JSON, cloud outputs built-in |
| Auth token refresh | setInterval | k6 setup() function | Runs once before VUs start |

**Key insight:** k6 provides batteries-included metrics, checks, and thresholds. Custom implementations add maintenance burden and miss built-in aggregation.

## Common Pitfalls

### Pitfall 1: Insufficient Test Data Isolation
**What goes wrong:** Tests use production event IDs or create real orders in production
**Why it happens:** Copying production URLs without switching to test environment
**How to avoid:**
- Create dedicated test events in staging Supabase
- Use `__ENV.SUPABASE_URL` pointing to test project
- Seed test data in setup() function
- Clean up test data in teardown()
**Warning signs:** Seeing test orders in production dashboard

### Pitfall 2: Webhook Signature Timestamp Drift
**What goes wrong:** Stripe signature validation fails with "timestamp too old"
**Why it happens:** Generating signature minutes before sending request
**How to avoid:**
- Generate signature immediately before http.post()
- Use current timestamp (Date.now() / 1000)
- Default Stripe tolerance is 5 minutes, but keep it fresh
**Warning signs:** Sporadic 401 responses on webhook endpoint

### Pitfall 3: WebSocket Connection Limits
**What goes wrong:** Tests fail with connection refused errors
**Why it happens:** Supabase Realtime has connection limits per project
**How to avoid:**
- Check Supabase plan limits (free tier: 200 concurrent)
- Use gracefulRampDown to close connections properly
- Add connection pooling delays between VUs
- Monitor connection count during test
**Warning signs:** "unable to connect to the project database" errors

### Pitfall 4: Rate Limiting by Supabase
**What goes wrong:** Requests return 429 Too Many Requests
**Why it happens:** Exceeding Edge Function rate limits
**How to avoid:**
- Start with lower VU counts and ramp up
- Add small sleep() between iterations
- Monitor rate limit headers in responses
- Use Supabase Pro tier for higher limits during testing
**Warning signs:** Sudden spike in error rate after initial success

### Pitfall 5: Test Machine Resource Exhaustion
**What goes wrong:** Metrics show high latency but server is fine
**Why it happens:** Local machine running k6 becomes the bottleneck
**How to avoid:**
- Monitor k6 machine CPU/memory during test
- Use `--out cloud` for distributed execution
- Reduce data size in responses with `discardResponseBodies: true`
- Close WebSocket connections promptly
**Warning signs:** Latency increases linearly with VU count regardless of server

## Code Examples

Verified patterns for the Maguey Nightclub system.

### Complete Threshold Configuration
```javascript
// Source: Grafana k6 Thresholds documentation
export const options = {
  thresholds: {
    // Response time thresholds (from CONTEXT.md: p95 < 500ms)
    http_req_duration: [
      'p(95)<500',   // 95% of requests under 500ms
      'p(99)<1000',  // 99% under 1 second
    ],

    // Error rate threshold
    http_req_failed: ['rate<0.01'],  // Less than 1% errors

    // Custom check pass rate
    checks: ['rate>0.95'],  // 95% of checks must pass

    // Scenario-specific thresholds
    'http_req_duration{scenario:scanner}': ['p(95)<200'],  // Scanner faster
    'http_req_duration{scenario:webhook}': ['p(95)<1000'], // Webhooks allow 1s
  },
};
```

### Scanner Burst Test (10 Simultaneous Scans)
```javascript
// Test scanner RPC endpoint
import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';

const testTickets = new SharedArray('tickets', function () {
  return JSON.parse(open('./data/test-tickets.json'));
});

export const options = {
  scenarios: {
    scanner_burst: {
      executor: 'constant-vus',
      vus: 10,
      duration: '30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<200'],  // Scanner must be fast
    http_req_failed: ['rate<0.001'],   // Near-zero errors
  },
};

export default function () {
  const ticket = testTickets[Math.floor(Math.random() * testTickets.length)];

  const payload = JSON.stringify({
    qr_token: ticket.qr_token,
    qr_signature: ticket.qr_signature,
    event_id: ticket.event_id,
    scanned_by: 'load-test-user',
  });

  const res = http.post(
    `${__ENV.SUPABASE_URL}/rest/v1/rpc/scan_ticket_atomic`,
    payload,
    {
      headers: {
        'Content-Type': 'application/json',
        'apikey': __ENV.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${__ENV.SUPABASE_SERVICE_KEY}`,
      },
    }
  );

  check(res, {
    'scan successful': (r) => r.status === 200,
    'response under 200ms': (r) => r.timings.duration < 200,
  });
}
```

### Dashboard Load Test (20 Concurrent Viewers)
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    dashboard_viewers: {
      executor: 'constant-vus',
      vus: 20,
      duration: '3m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<3000'],  // Dashboard under 3s
  },
};

export default function () {
  const eventId = __ENV.TEST_EVENT_ID;
  const headers = {
    'apikey': __ENV.SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${__ENV.SUPABASE_SERVICE_KEY}`,
  };

  // Simulate dashboard data fetching
  const responses = http.batch([
    ['GET', `${__ENV.SUPABASE_URL}/rest/v1/events?id=eq.${eventId}`, null, { headers }],
    ['GET', `${__ENV.SUPABASE_URL}/rest/v1/tickets?event_id=eq.${eventId}&select=count`, null, { headers }],
    ['GET', `${__ENV.SUPABASE_URL}/rest/v1/orders?event_id=eq.${eventId}&status=eq.paid`, null, { headers }],
  ]);

  check(responses[0], { 'event loaded': (r) => r.status === 200 });
  check(responses[1], { 'ticket count loaded': (r) => r.status === 200 });
  check(responses[2], { 'orders loaded': (r) => r.status === 200 });

  sleep(5);  // Dashboard refresh interval
}
```

### Running Tests with Environment Variables
```bash
# Run ticket purchase load test
k6 run \
  -e SUPABASE_URL=https://your-test-project.supabase.co \
  -e SUPABASE_ANON_KEY=your-anon-key \
  -e SUPABASE_SERVICE_KEY=your-service-key \
  -e STRIPE_WEBHOOK_SECRET=whsec_test_xxx \
  -e TEST_EVENT_ID=test-event-uuid \
  scenarios/ticket-purchase.js

# Run with JSON output for analysis
k6 run --out json=results.json scenarios/webhook-burst.js

# Run with InfluxDB for Grafana visualization
k6 run --out influxdb=http://localhost:8086/k6 scenarios/full-load.js
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| k6/ws module | k6/experimental/websockets | k6 v0.40+ | More browser-like WebSocket API |
| Global options only | Scenarios with executors | k6 v0.27+ | Fine-grained control per test type |
| Custom rate metrics | http_req_failed built-in | k6 v0.31+ | Standard error rate tracking |
| Manual output parsing | --out cloud/influxdb | k6 v0.26+ | Native integrations for visualization |

**Deprecated/outdated:**
- `--type` CLI flag removed; use `scenarios` in options instead
- `options.ext.loadimpact` renamed to `options.cloud`
- k6.io domain redirects to grafana.com/docs/k6

## Open Questions

Things that couldn't be fully resolved.

1. **Supabase Realtime exact limits under load**
   - What we know: Free tier has 200 concurrent connections; benchmarks show 32k-250k for paid tiers
   - What's unclear: Exact limits for test project tier
   - Recommendation: Start WebSocket tests at 20 VUs, monitor connection count, scale up gradually

2. **Stripe test mode rate limits**
   - What we know: Stripe has rate limits but is lenient in test mode
   - What's unclear: Exact burst capacity for webhook simulation
   - Recommendation: Add 10ms sleep between webhook calls in burst test; monitor for 429s

3. **Edge Function cold start impact**
   - What we know: First request to idle function has cold start latency
   - What's unclear: How this affects p95 during burst scenarios
   - Recommendation: Include warm-up phase before measuring; exclude first 30s from threshold evaluation

## Sources

### Primary (HIGH confidence)
- [Grafana k6 Documentation](https://grafana.com/docs/k6/latest/) - Testing guides, thresholds, scenarios
- [Grafana k6 Thresholds](https://grafana.com/docs/k6/latest/using-k6/thresholds/) - p95/p99 configuration
- [Grafana k6 Scenarios](https://grafana.com/docs/k6/latest/using-k6/scenarios/) - Multi-scenario testing
- [Grafana k6 HTTP Requests](https://grafana.com/docs/k6/latest/using-k6/http-requests/) - POST with JSON
- [Stripe Webhook Signatures](https://stripe.com/docs/webhooks/signatures) - HMAC-SHA256 generation
- [Supabase Realtime Benchmarks](https://supabase.com/docs/guides/realtime/benchmarks) - Connection limits

### Secondary (MEDIUM confidence)
- [k6 WebSocket Documentation](https://grafana.com/docs/k6/latest/using-k6/protocols/websockets/) - WebSocket testing patterns
- [k6 SharedArray](https://grafana.com/docs/k6/latest/javascript-api/k6-data/sharedarray/) - Test data management
- [k6 HTTP Authentication](https://grafana.com/docs/k6/latest/examples/http-authentication/) - Bearer token usage
- [Supabase Edge Functions Auth](https://supabase.com/docs/guides/functions/auth) - JWT verification patterns

### Tertiary (LOW confidence)
- [GitHub Gist: k6 Webhook Load Testing](https://gist.github.com/sjelfull/1a7e0dc0150ad4d8add402a811accd8d) - Community example
- WebSearch results for "k6 Supabase load testing" - General patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - k6 is well-documented, official Grafana tool
- Architecture: HIGH - Patterns verified against official k6 documentation
- Pitfalls: MEDIUM - Based on documentation warnings and community reports
- WebSocket: MEDIUM - k6/ws is stable but Supabase Realtime specifics vary by tier

**Research date:** 2026-01-31
**Valid until:** 2026-03-01 (k6 stable, Supabase may update limits)
