import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const duplicateRate = new Rate('duplicates_detected');
const webhookDuration = new Trend('webhook_duration');
const processedCount = new Counter('webhooks_processed');

// Test configuration
export const options = {
  scenarios: {
    // Test 50 concurrent webhook events
    concurrent_webhooks: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 50 },  // Ramp up to 50
        { duration: '1m', target: 50 },   // Stay at 50
        { duration: '20s', target: 0 },   // Ramp down
      ],
    },
    // Test duplicate webhook handling
    duplicate_webhooks: {
      executor: 'per-vu-iterations',
      vus: 10,
      iterations: 5,  // Each VU sends the same event 5 times
      startTime: '2m', // Start after main test
      exec: 'duplicateWebhooks',
    },
  },
  thresholds: {
    'webhook_duration': ['p(95)<3000'], // 95% under 3s
    'errors': ['rate<0.01'],            // Less than 1% errors
    'http_req_failed': ['rate<0.01'],
  },
};

// Environment configuration
const BASE_URL = __ENV.SUPABASE_URL || 'http://localhost:54321';
const SERVICE_KEY = __ENV.SUPABASE_SERVICE_ROLE_KEY || 'your-service-key';

// Create mock Stripe webhook event
function createWebhookEvent(eventId, paymentIntentId) {
  return {
    id: eventId,
    type: 'checkout.session.completed',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: `cs_test_${paymentIntentId}`,
        payment_intent: paymentIntentId,
        payment_status: 'paid',
        amount_total: 2500,
        currency: 'usd',
        customer_details: {
          email: `load_test_${eventId}@test.com`,
          name: 'Load Test User',
        },
        metadata: {
          eventId: __ENV.TEST_EVENT_ID || 'test-event-id',
          source: 'load_test',
        },
      },
    },
  };
}

// Main scenario: unique webhook events
export default function() {
  const uniqueId = `evt_loadtest_${Date.now()}_${__VU}_${__ITER}`;
  const paymentIntentId = `pi_loadtest_${Date.now()}_${__VU}_${__ITER}`;

  const payload = JSON.stringify(createWebhookEvent(uniqueId, paymentIntentId));

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SERVICE_KEY}`,
    // Note: In production, would need valid Stripe signature
    // For load testing, may need to temporarily disable signature verification
    // or use a test endpoint
  };

  const startTime = new Date();

  const response = http.post(
    `${BASE_URL}/functions/v1/stripe-webhook`,
    payload,
    { headers, timeout: '30s' }
  );

  const duration = new Date() - startTime;
  webhookDuration.add(duration);

  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response has received: true': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.received === true;
      } catch {
        return false;
      }
    },
    'response time < 5s': () => duration < 5000,
  });

  if (success) {
    processedCount.add(1);
  }
  errorRate.add(!success);

  if (!success) {
    console.log(`Webhook failed: ${response.status} - ${response.body}`);
  }

  sleep(Math.random() * 0.5);
}

// Duplicate webhook scenario
export function duplicateWebhooks() {
  // All VUs in this scenario use the same event ID
  const sharedEventId = `evt_duplicate_test_${Math.floor(Date.now() / 10000)}`;
  const sharedPaymentIntentId = `pi_duplicate_test_${Math.floor(Date.now() / 10000)}`;

  const payload = JSON.stringify(createWebhookEvent(sharedEventId, sharedPaymentIntentId));

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SERVICE_KEY}`,
  };

  const response = http.post(
    `${BASE_URL}/functions/v1/stripe-webhook`,
    payload,
    { headers, timeout: '30s' }
  );

  const success = check(response, {
    'status is 200 (even for duplicates)': (r) => r.status === 200,
  });

  // First request creates, subsequent are duplicates
  // All should return 200
  if (response.status === 200) {
    try {
      const body = JSON.parse(response.body);
      // If response indicates it was a duplicate (optional detection)
      if (body.duplicate || body.cached) {
        duplicateRate.add(1);
      }
    } catch {
      // ignore parse errors
    }
  }

  errorRate.add(!success);
  sleep(0.1); // Small delay between duplicate attempts
}

export function handleSummary(data) {
  const metrics = data.metrics;

  const summary = `
=== Webhook Load Test Results ===

Concurrent VUs: 50
Test Duration: ~2.5 minutes

Unique Webhooks:
  - Processed: ${metrics.webhooks_processed?.values?.count || 0}
  - Errors: ${(metrics.errors?.values?.rate * 100 || 0).toFixed(2)}%

Response Times:
  - Avg: ${Math.round(metrics.webhook_duration?.values?.avg || 0)}ms
  - P95: ${Math.round(metrics.webhook_duration?.values?.['p(95)'] || 0)}ms
  - Max: ${Math.round(metrics.webhook_duration?.values?.max || 0)}ms

Duplicate Handling:
  - Duplicates sent: ${metrics.duplicates_detected?.values?.count || 'N/A'}
  - All returned 200: ${metrics.http_req_failed?.values?.rate === 0 ? 'YES' : 'NO'}

Thresholds: ${Object.entries(data.thresholds || {}).map(([name, result]) =>
    `\n  - ${name}: ${result.ok ? 'PASS' : 'FAIL'}`
  ).join('')}
`;

  return {
    'stdout': summary,
    'webhook-load-results.json': JSON.stringify(data, null, 2),
  };
}
