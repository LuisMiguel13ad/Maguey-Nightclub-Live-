import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const checkoutDuration = new Trend('checkout_duration');

// Test configuration
export const options = {
  scenarios: {
    // Ramp up to 50 concurrent users over 30 seconds
    concurrent_checkouts: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },  // Ramp up to 50 users
        { duration: '1m', target: 50 },   // Stay at 50 users for 1 minute
        { duration: '30s', target: 0 },   // Ramp down
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    // 95% of requests should complete under 5 seconds
    'checkout_duration': ['p(95)<5000'],
    // Error rate should be less than 1%
    'errors': ['rate<0.01'],
    // HTTP request failures should be less than 1%
    'http_req_failed': ['rate<0.01'],
  },
};

// Environment configuration
const BASE_URL = __ENV.SUPABASE_URL || 'http://localhost:54321';
const ANON_KEY = __ENV.SUPABASE_ANON_KEY || 'your-anon-key';
const TEST_EVENT_ID = __ENV.TEST_EVENT_ID || 'test-event-id';

export default function() {
  const uniqueId = `${Date.now()}_${__VU}_${__ITER}`;

  const payload = JSON.stringify({
    eventId: TEST_EVENT_ID,
    tickets: [
      {
        ticketTypeId: 'general-admission',
        quantity: 1,
        price: 2500, // $25.00
      }
    ],
    customerEmail: `test_${uniqueId}@loadtest.com`,
    customerName: `Load Test User ${uniqueId}`,
    total: 2500,
  });

  const headers = {
    'Content-Type': 'application/json',
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${ANON_KEY}`,
  };

  const startTime = new Date();

  const response = http.post(
    `${BASE_URL}/functions/v1/create-checkout-session`,
    payload,
    { headers, timeout: '30s' }
  );

  const duration = new Date() - startTime;
  checkoutDuration.add(duration);

  // Check response
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'has session URL': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.url && body.url.includes('stripe.com');
      } catch {
        return false;
      }
    },
    'response time < 5s': () => duration < 5000,
  });

  errorRate.add(!success);

  if (!success) {
    console.log(`Failed request: ${response.status} - ${response.body}`);
  }

  // Small sleep between requests to simulate realistic behavior
  sleep(Math.random() * 2);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'load-test-results.json': JSON.stringify(data, null, 2),
  };
}

function textSummary(data) {
  // Simple text summary
  const metrics = data.metrics;
  return `
=== Payment Load Test Results ===

Virtual Users: ${data.options.scenarios.concurrent_checkouts.stages[1].target}
Duration: ${data.options.scenarios.concurrent_checkouts.stages.reduce((acc, s) => {
    const match = s.duration.match(/(\d+)/);
    return acc + (match ? parseInt(match[1]) : 0);
  }, 0)}s

Requests:
  - Total: ${metrics.http_reqs?.values?.count || 0}
  - Failed: ${metrics.http_req_failed?.values?.passes || 0}

Response Times:
  - Avg: ${Math.round(metrics.http_req_duration?.values?.avg || 0)}ms
  - P95: ${Math.round(metrics.http_req_duration?.values?.['p(95)'] || 0)}ms
  - Max: ${Math.round(metrics.http_req_duration?.values?.max || 0)}ms

Errors: ${(metrics.errors?.values?.rate * 100 || 0).toFixed(2)}%

Thresholds: ${Object.entries(data.thresholds || {}).map(([name, result]) =>
    `\n  - ${name}: ${result.ok ? 'PASS' : 'FAIL'}`
  ).join('')}
`;
}
