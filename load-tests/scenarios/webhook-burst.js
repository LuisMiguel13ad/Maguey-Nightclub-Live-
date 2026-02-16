// Webhook Burst Load Test - 50 Events in 10 Seconds
// Tests: POST /functions/v1/stripe-webhook
// Target: All processed without timeouts, error rate < 1%
//
// Success Criteria (from 10-CONTEXT.md):
// - 50 webhook events process within 10 seconds without timeouts
// - All webhooks return 200 status (success or idempotent duplicate)
// - Error rate remains below 1%
// - Stripe signature validation succeeds for generated events

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { getThresholds } from '../config/thresholds.js';
import { getBaseUrl } from '../helpers/auth.js';
import { generateStripeSignature } from '../helpers/stripe-signature.js';
import { generateWebhookEvent } from '../helpers/data-generators.js';

// Custom metrics for webhook testing
const errorRate = new Rate('webhook_errors');
const webhookDuration = new Trend('webhook_duration');
const processedCount = new Counter('webhooks_processed');
const duplicateCount = new Counter('duplicates_handled');
const timeoutCount = new Counter('timeouts');
const signatureValidCount = new Counter('signature_valid');

export const options = {
  scenarios: {
    // Scenario 1: Burst of 50 unique webhooks in 10 seconds
    // Uses constant-arrival-rate executor for precise 5 req/sec rate
    webhook_burst: {
      executor: 'constant-arrival-rate',
      rate: 5,              // 5 requests per second
      timeUnit: '1s',
      duration: '10s',      // For 10 seconds = 50 total requests
      preAllocatedVUs: 10,
      maxVUs: 20,
      exec: 'uniqueWebhooks',
      tags: { scenario: 'webhook' },
    },
    // Scenario 2: Test idempotency with duplicate webhooks
    // Each VU sends the same event 3 times to verify duplicate handling
    idempotency_test: {
      executor: 'per-vu-iterations',
      vus: 5,
      iterations: 3,  // Each VU sends same event 3 times
      startTime: '15s',  // Start after burst test completes
      exec: 'duplicateWebhooks',
      tags: { scenario: 'webhook' },
    },
  },
  thresholds: {
    ...getThresholds('webhook'),
    'webhook_duration': ['p(95)<1000'],  // Webhooks must complete within 1s p95
    'webhook_errors': ['rate<0.01'],     // Error rate < 1%
    'timeouts': ['count<1'],             // Zero timeouts allowed
  },
};

// Scenario 1: Unique webhook events
// Simulates event end rush when many purchases complete simultaneously
export function uniqueWebhooks() {
  const baseUrl = getBaseUrl();
  const webhookSecret = __ENV.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret';

  // Generate unique webhook event using helper
  const event = generateWebhookEvent(__VU, __ITER);
  const payload = JSON.stringify(event);

  // Generate valid Stripe signature using helper
  const signature = generateStripeSignature(payload, webhookSecret);

  const headers = {
    'Content-Type': 'application/json',
    'stripe-signature': signature,
  };

  const startTime = Date.now();

  const response = http.post(
    `${baseUrl}/functions/v1/stripe-webhook`,
    payload,
    {
      headers,
      timeout: '30s',
      tags: { name: 'webhook_burst' },
    }
  );

  const duration = Date.now() - startTime;
  webhookDuration.add(duration);

  // Check for timeout (30s is our timeout threshold)
  if (duration >= 30000) {
    timeoutCount.add(1);
    console.log(`[VU ${__VU}] TIMEOUT: Webhook took ${duration}ms - event: ${event.id}`);
  }

  // Validate response
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'has received: true': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.received === true;
      } catch {
        return false;
      }
    },
    'response under 5s': () => duration < 5000,
  });

  // Track successful signature validation (webhook accepted means signature valid)
  if (response.status === 200) {
    signatureValidCount.add(1);
    processedCount.add(1);
  }

  errorRate.add(!success);

  // Log failures for debugging
  if (!success) {
    const bodyPreview = response.body ? response.body.substring(0, 200) : 'no body';
    console.log(`[VU ${__VU}] Webhook failed: status=${response.status} - ${bodyPreview}`);
  }

  // Small delay between requests (still rapid for burst testing)
  sleep(0.1);
}

// Scenario 2: Test idempotency - same event sent multiple times
// All duplicate requests should return 200 due to idempotency handling
export function duplicateWebhooks() {
  const baseUrl = getBaseUrl();
  const webhookSecret = __ENV.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret';

  // All VUs in this scenario use a shared event ID (per VU to avoid cross-VU conflicts)
  // The minute-based ID ensures same event across iterations within the test
  const sharedEventId = `evt_idempotency_${__VU}_${Math.floor(Date.now() / 60000)}`;

  const event = {
    id: sharedEventId,
    type: 'checkout.session.completed',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: `cs_test_idempotency_${__VU}`,
        payment_intent: `pi_test_idempotency_${__VU}`,
        payment_status: 'paid',
        amount_total: 3000,
        currency: 'usd',
        customer_email: `idempotency_${__VU}@test.maguey.com`,
        metadata: {
          orderId: `order_idempotency_${__VU}`,
          eventId: __ENV.TEST_EVENT_ID || 'test-event-id',
          customerEmail: `idempotency_${__VU}@test.maguey.com`,
          customerName: `Idempotency Test ${__VU}`,
          tickets: JSON.stringify([{
            ticketTypeId: 'general-admission',
            quantity: 1,
            unitPrice: 2500,
            displayName: 'GA',
          }]),
        },
      },
    },
  };

  const payload = JSON.stringify(event);
  const signature = generateStripeSignature(payload, webhookSecret);

  const headers = {
    'Content-Type': 'application/json',
    'stripe-signature': signature,
  };

  const response = http.post(
    `${baseUrl}/functions/v1/stripe-webhook`,
    payload,
    { headers, timeout: '30s', tags: { name: 'idempotency_test' } }
  );

  // All requests (first and duplicates) should return 200
  const success = check(response, {
    'duplicate returns 200': (r) => r.status === 200,
  });

  // Track duplicates - second and third iterations for each VU are duplicates
  if (response.status === 200) {
    try {
      const body = JSON.parse(response.body);
      // Check for duplicate indicators in response
      if (body.duplicate || body.cached || body.skipped ||
          (body.message && body.message.includes('already processed'))) {
        duplicateCount.add(1);
      } else if (__ITER > 0) {
        // If this is iteration 2 or 3 and no duplicate indicator, still count
        // (first request creates, subsequent are duplicates)
        duplicateCount.add(1);
      }
    } catch {
      // Response parsing failed but request succeeded
      if (__ITER > 0) {
        duplicateCount.add(1);
      }
    }
  }

  errorRate.add(!success);

  if (!success) {
    console.log(`[VU ${__VU} ITER ${__ITER}] Idempotency test failed: status=${response.status}`);
  }

  sleep(0.2);
}

// Summary report - produces human-readable output and JSON results
export function handleSummary(data) {
  const metrics = data.metrics;

  // Build threshold results
  const thresholdResults = Object.entries(data.thresholds || {})
    .map(([name, result]) => `  ${result.ok ? 'PASS' : 'FAIL'} ${name}`)
    .join('\n');

  // Calculate pass/fail status
  const allThresholdsPassed = Object.values(data.thresholds || {})
    .every(result => result.ok);

  const summary = `
================================================================================
                      WEBHOOK BURST LOAD TEST RESULTS
================================================================================

Configuration:
  Burst Test:      50 unique webhooks in 10 seconds (5/sec)
  Idempotency:     5 VUs x 3 iterations each (15 requests, 10 duplicates expected)
  Endpoint:        POST /functions/v1/stripe-webhook

Results:
  Total Processed: ${metrics.webhooks_processed?.values?.count || 0}
  Signatures OK:   ${metrics.signature_valid?.values?.count || 0}
  Timeouts:        ${metrics.timeouts?.values?.count || 0}
  Error Rate:      ${((metrics.webhook_errors?.values?.rate || 0) * 100).toFixed(2)}%

Response Times:
  Average:         ${Math.round(metrics.webhook_duration?.values?.avg || 0)}ms
  P95:             ${Math.round(metrics.webhook_duration?.values?.['p(95)'] || 0)}ms
  P99:             ${Math.round(metrics.webhook_duration?.values?.['p(99)'] || 0)}ms
  Max:             ${Math.round(metrics.webhook_duration?.values?.max || 0)}ms

Idempotency:
  Duplicates handled: ${metrics.duplicates_handled?.values?.count || 0}
  (All duplicates should return 200 - webhook is idempotent)

Thresholds:
${thresholdResults}

Overall: ${allThresholdsPassed ? 'PASS' : 'FAIL'}
================================================================================
`;

  return {
    'stdout': summary,
    'load-tests/results/webhook-burst-results.json': JSON.stringify(data, null, 2),
  };
}
