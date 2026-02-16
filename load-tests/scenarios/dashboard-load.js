// Dashboard Load Test - 20 Concurrent Viewers
// Tests: Multiple REST API endpoints in parallel
// Target: Initial load < 3s, error rate < 1%

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { getThresholds } from '../config/thresholds.js';
import { getServiceHeaders, getBaseUrl } from '../helpers/auth.js';

// Custom metrics
const errorRate = new Rate('dashboard_errors');
const initialLoadDuration = new Trend('initial_load_duration');
const refreshDuration = new Trend('refresh_duration');
const apiCallCount = new Counter('api_calls');

export const options = {
  scenarios: {
    dashboard_viewers: {
      executor: 'constant-vus',
      vus: 20,
      duration: '3m',
    },
  },
  thresholds: {
    ...getThresholds('dashboard'),
    'initial_load_duration': ['p(95)<3000'],  // Dashboard < 3s
    'refresh_duration': ['p(95)<1000'],        // Refresh < 1s
    'dashboard_errors': ['rate<0.01'],
  },
};

export default function() {
  const baseUrl = getBaseUrl();
  const headers = getServiceHeaders();
  const eventId = __ENV.TEST_EVENT_ID || 'test-event-id';

  // Group 1: Initial dashboard load (parallel requests)
  group('initial_load', function() {
    const startTime = Date.now();

    // Simulate dashboard initial load with parallel API calls
    const responses = http.batch([
      // Events list
      {
        method: 'GET',
        url: `${baseUrl}/rest/v1/events?select=*&order=date.desc&limit=10`,
        params: { headers },
      },
      // Ticket counts for event
      {
        method: 'GET',
        url: `${baseUrl}/rest/v1/tickets?select=id,event_id,status&event_id=eq.${eventId}`,
        params: { headers },
      },
      // Orders with revenue
      {
        method: 'GET',
        url: `${baseUrl}/rest/v1/orders?select=id,total_amount,status,created_at&event_id=eq.${eventId}&status=eq.paid&limit=100`,
        params: { headers },
      },
      // VIP reservations
      {
        method: 'GET',
        url: `${baseUrl}/rest/v1/vip_reservations?select=id,status,total_price&event_id=eq.${eventId}`,
        params: { headers },
      },
    ]);

    const duration = Date.now() - startTime;
    initialLoadDuration.add(duration);
    apiCallCount.add(responses.length);

    // Validate all responses
    let allSuccess = true;
    responses.forEach((response, index) => {
      const endpoints = ['events', 'tickets', 'orders', 'vip_reservations'];
      const success = check(response, {
        [`${endpoints[index]} status 200`]: (r) => r.status === 200,
        [`${endpoints[index]} has body`]: (r) => r.body && r.body.length > 0,
      });
      if (!success) allSuccess = false;
    });

    check(null, {
      'initial load under 3s': () => duration < 3000,
      'initial load under 5s': () => duration < 5000,
    });

    errorRate.add(!allSuccess);

    if (!allSuccess) {
      console.log(`[VU ${__VU}] Initial load failed (${duration}ms)`);
      responses.forEach((r, i) => {
        if (r.status !== 200) {
          console.log(`  - Request ${i}: ${r.status}`);
        }
      });
    }
  });

  // Simulate user viewing dashboard for 5 seconds
  sleep(5);

  // Group 2: Dashboard refresh (lighter request)
  group('refresh', function() {
    const startTime = Date.now();

    // Refresh typically fetches updated counts
    const responses = http.batch([
      {
        method: 'GET',
        url: `${baseUrl}/rest/v1/tickets?select=count&event_id=eq.${eventId}`,
        params: { headers },
      },
      {
        method: 'GET',
        url: `${baseUrl}/rest/v1/scan_logs?select=count&event_id=eq.${eventId}`,
        params: { headers },
      },
    ]);

    const duration = Date.now() - startTime;
    refreshDuration.add(duration);
    apiCallCount.add(responses.length);

    const success = check(responses[0], {
      'refresh status 200': (r) => r.status === 200,
    });

    check(null, {
      'refresh under 1s': () => duration < 1000,
    });

    errorRate.add(!success);
  });

  // Wait before next iteration (simulating user viewing)
  sleep(Math.random() * 3 + 2);
}

// Summary report
export function handleSummary(data) {
  const metrics = data.metrics;
  const thresholdResults = Object.entries(data.thresholds || {})
    .map(([name, result]) => `  ${result.ok ? 'PASS' : 'FAIL'} ${name}`)
    .join('\n');

  const summary = `
================================================================================
                     DASHBOARD LOAD TEST RESULTS
================================================================================

Configuration:
  Concurrent Viewers: 20 VUs
  Duration:          3 minutes
  Endpoints:         events, tickets, orders, vip_reservations, scan_logs

Load Performance:
  Total API Calls:   ${metrics.api_calls?.values?.count || 0}
  Error Rate:        ${((metrics.dashboard_errors?.values?.rate || 0) * 100).toFixed(2)}%

Initial Load Times:
  Average:           ${Math.round(metrics.initial_load_duration?.values?.avg || 0)}ms
  P95:               ${Math.round(metrics.initial_load_duration?.values?.['p(95)'] || 0)}ms
  P99:               ${Math.round(metrics.initial_load_duration?.values?.['p(99)'] || 0)}ms
  Max:               ${Math.round(metrics.initial_load_duration?.values?.max || 0)}ms

Refresh Times:
  Average:           ${Math.round(metrics.refresh_duration?.values?.avg || 0)}ms
  P95:               ${Math.round(metrics.refresh_duration?.values?.['p(95)'] || 0)}ms
  Max:               ${Math.round(metrics.refresh_duration?.values?.max || 0)}ms

Thresholds:
${thresholdResults}

================================================================================
`;

  return {
    'stdout': summary,
    'load-tests/results/dashboard-load-results.json': JSON.stringify(data, null, 2),
  };
}
