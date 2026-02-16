// Ticket Purchase Load Test - 100 Concurrent VUs
// Tests: POST /functions/v1/create-checkout-session
// Target: p95 < 500ms, error rate < 1%
//
// Usage:
//   k6 run load-tests/scenarios/ticket-purchase.js
//
// Required environment variables:
//   SUPABASE_URL - Supabase project URL
//   SUPABASE_ANON_KEY - Supabase anonymous key
//   TEST_EVENT_ID - Event ID to purchase tickets for

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { getThresholds } from '../config/thresholds.js';
import { getHeaders, getBaseUrl } from '../helpers/auth.js';
import { generateTicketPayload } from '../helpers/data-generators.js';

// Custom metrics for ticket purchase tracking
const purchaseErrors = new Rate('purchase_errors');
const checkoutDuration = new Trend('checkout_duration');

// Test configuration - 100 concurrent VUs
export const options = {
  scenarios: {
    purchase: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 },  // Ramp up to 100 VUs over 30s
        { duration: '2m', target: 100 },   // Hold at 100 VUs for 2 minutes
        { duration: '30s', target: 0 },    // Ramp down over 30s
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    ...getThresholds('purchase'),
    'checkout_duration': ['p(95)<500'],   // Custom metric: p95 < 500ms
    'purchase_errors': ['rate<0.01'],     // Custom metric: error rate < 1%
  },
};

// Main test function - executed by each VU
export default function() {
  const baseUrl = getBaseUrl();
  const headers = getHeaders();
  const payload = generateTicketPayload(__VU, __ITER);

  const startTime = Date.now();

  const response = http.post(
    `${baseUrl}/functions/v1/create-checkout-session`,
    JSON.stringify(payload),
    { headers, timeout: '30s' }
  );

  const duration = Date.now() - startTime;
  checkoutDuration.add(duration);

  // Validate response
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'has checkout URL': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.url && body.url.includes('checkout.stripe.com');
      } catch {
        return false;
      }
    },
    'response under 500ms': () => duration < 500,
    'response under 1s': () => duration < 1000,
  });

  purchaseErrors.add(!success);

  // Log failures for debugging
  if (!success && response.status !== 200) {
    const bodyPreview = response.body ? response.body.substring(0, 200) : 'no body';
    console.log(`[VU ${__VU}] Failed: ${response.status} - ${bodyPreview}`);
  }

  // Realistic delay between purchases (0.5-2.5 seconds)
  sleep(Math.random() * 2 + 0.5);
}

// Summary report generation
export function handleSummary(data) {
  const metrics = data.metrics;

  // Format threshold results
  const thresholdResults = Object.entries(data.thresholds || {})
    .map(([name, result]) => `  ${result.ok ? 'PASS' : 'FAIL'} ${name}`)
    .join('\n');

  // Calculate success stats
  const totalRequests = metrics.http_reqs?.values?.count || 0;
  const failedCount = metrics.http_req_failed?.values?.passes || 0;
  const errorRate = ((metrics.purchase_errors?.values?.rate || 0) * 100).toFixed(2);

  // Response time stats
  const avgDuration = Math.round(metrics.checkout_duration?.values?.avg || 0);
  const p95Duration = Math.round(metrics.checkout_duration?.values?.['p(95)'] || 0);
  const p99Duration = Math.round(metrics.checkout_duration?.values?.['p(99)'] || 0);
  const maxDuration = Math.round(metrics.checkout_duration?.values?.max || 0);

  const summary = `
================================================================================
                    TICKET PURCHASE LOAD TEST RESULTS
================================================================================

Configuration:
  Target VUs:     100 concurrent users
  Duration:       ~3 minutes (30s ramp + 2m hold + 30s ramp down)
  Endpoint:       POST /functions/v1/create-checkout-session

Results:
  Total Requests: ${totalRequests}
  Failed:         ${failedCount}
  Error Rate:     ${errorRate}%

Response Times:
  Average:        ${avgDuration}ms
  P95:            ${p95Duration}ms
  P99:            ${p99Duration}ms
  Max:            ${maxDuration}ms

Thresholds:
${thresholdResults}

================================================================================
`;

  return {
    'stdout': summary,
    'load-tests/results/ticket-purchase-results.json': JSON.stringify(data, null, 2),
  };
}
