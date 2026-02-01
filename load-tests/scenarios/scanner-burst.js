// Scanner Burst Load Test - 10 Simultaneous Scans
// Tests: POST /rest/v1/rpc/scan_ticket_atomic
// Target: p95 < 200ms, near-zero errors
//
// Validates success criteria #2: "Scanner handles 10 simultaneous scans at gate without lag"

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { getThresholds } from '../config/thresholds.js';
import { getServiceHeaders, getBaseUrl } from '../helpers/auth.js';

// Custom metrics for scanner-specific tracking
const errorRate = new Rate('scan_errors');
const scanDuration = new Trend('scan_duration');
const successfulScans = new Counter('successful_scans');
const alreadyScannedCount = new Counter('already_scanned');
const raceConditionsCaught = new Counter('race_conditions_caught');
const ticketNotFoundCount = new Counter('ticket_not_found');

// Test ticket data loaded from file or generated as fallback
const testTickets = new SharedArray('tickets', function() {
  try {
    return JSON.parse(open('../data/test-tickets.json')).tickets;
  } catch (e) {
    // Generate placeholder UUIDs if file doesn't exist or is invalid
    console.log('Using generated test ticket IDs (file not found or invalid)');
    return Array.from({ length: 100 }, (_, i) => ({
      id: `00000000-0000-0000-0001-${String(i + 1).padStart(12, '0')}`,
      event_id: __ENV.TEST_EVENT_ID || 'test-event-id',
      type: i < 10 ? 'ga' : 'vip',
    }));
  }
});

// k6 options: scenarios and thresholds
export const options = {
  scenarios: {
    // Scenario 1: 10 VUs scanning different tickets simultaneously for 1 minute
    scanner_burst: {
      executor: 'constant-vus',
      vus: 10,
      duration: '1m',
      exec: 'uniqueTicketScans',
      tags: { scenario: 'scanner' },
    },
    // Scenario 2: 10 VUs racing to scan the SAME ticket simultaneously
    race_condition: {
      executor: 'per-vu-iterations',
      vus: 10,
      iterations: 1,
      startTime: '1m10s',  // Start 10 seconds after burst test ends
      exec: 'raceConditionTest',
      tags: { scenario: 'scanner' },
    },
  },
  thresholds: {
    ...getThresholds('scanner'),
    // Scanner-specific thresholds (stricter than global)
    'scan_duration': ['p(95)<200'],        // p95 under 200ms
    'scan_errors': ['rate<0.001'],         // Less than 0.1% error rate
    'successful_scans': ['count>0'],       // At least some scans succeed
  },
};

/**
 * Scenario 1: Unique Ticket Scans
 * Each VU scans a different ticket to test concurrent handling of distinct tickets.
 * Simulates busy gate entrance with multiple scanners processing different attendees.
 */
export function uniqueTicketScans() {
  const baseUrl = getBaseUrl();
  const headers = getServiceHeaders();

  // Each VU gets a different ticket based on VU ID and iteration count
  // This ensures we cycle through tickets without collision
  const ticketIndex = ((__VU - 1) + __ITER * 10) % testTickets.length;
  const ticket = testTickets[ticketIndex];

  const payload = JSON.stringify({
    p_ticket_id: ticket.id,
    p_scanned_by: __ENV.TEST_SCANNER_ID || '00000000-0000-0000-0000-000000000001',
    p_device_id: `loadtest_scanner_vu${__VU}`,
    p_scan_method: 'qr',
  });

  const startTime = Date.now();

  const response = http.post(
    `${baseUrl}/rest/v1/rpc/scan_ticket_atomic`,
    payload,
    {
      headers,
      timeout: '10s',
      tags: { name: 'scan_ticket_atomic' },
    }
  );

  const duration = Date.now() - startTime;
  scanDuration.add(duration);

  // Check response validity
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'has response body': (r) => r.body && r.body.length > 0,
    'response under 200ms': () => duration < 200,
  });

  // Parse response to categorize scan outcomes
  if (response.status === 200) {
    try {
      const result = JSON.parse(response.body);
      if (Array.isArray(result) && result.length > 0) {
        const scanResult = result[0];

        if (scanResult.success === true) {
          successfulScans.add(1);
        } else if (scanResult.already_scanned === true) {
          alreadyScannedCount.add(1);
        } else if (scanResult.error_message && scanResult.error_message.includes('not found')) {
          ticketNotFoundCount.add(1);
        }
      }
    } catch (parseError) {
      // Response wasn't valid JSON - counted as error
    }
  }

  errorRate.add(!success);

  // Log failures for debugging
  if (!success) {
    console.log(
      `[VU ${__VU}][ITER ${__ITER}] Scan failed: ` +
      `status=${response.status}, ` +
      `body=${response.body ? response.body.substring(0, 150) : 'empty'}`
    );
  }

  // Short delay between scans - simulates rapid gate entry pace
  sleep(0.1);
}

/**
 * Scenario 2: Race Condition Test
 * All 10 VUs attempt to scan the SAME ticket simultaneously.
 * Only ONE should succeed; the rest should be rejected with race condition handling.
 * This validates the scan_ticket_atomic function's FOR UPDATE NOWAIT locking.
 */
export function raceConditionTest() {
  const baseUrl = getBaseUrl();
  const headers = getServiceHeaders();

  // All VUs target the same ticket ID - deliberately creating a race condition
  const sharedTicketId = __ENV.RACE_TEST_TICKET_ID || '00000000-0000-0000-0001-000000000099';

  const payload = JSON.stringify({
    p_ticket_id: sharedTicketId,
    p_scanned_by: __ENV.TEST_SCANNER_ID || '00000000-0000-0000-0000-000000000001',
    p_device_id: `loadtest_race_vu${__VU}`,
    p_scan_method: 'qr',
  });

  console.log(`[VU ${__VU}] Starting race condition test for ticket ${sharedTicketId}`);

  const startTime = Date.now();

  const response = http.post(
    `${baseUrl}/rest/v1/rpc/scan_ticket_atomic`,
    payload,
    {
      headers,
      timeout: '10s',
      tags: { name: 'scan_ticket_atomic_race' },
    }
  );

  const duration = Date.now() - startTime;

  // Check basic response validity
  const success = check(response, {
    'race test returns 200': (r) => r.status === 200,
    'response is valid JSON': (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch {
        return false;
      }
    },
  });

  // Analyze race condition outcome
  if (response.status === 200) {
    try {
      const result = JSON.parse(response.body);
      if (Array.isArray(result) && result.length > 0) {
        const scanResult = result[0];

        if (scanResult.success === true) {
          // This VU won the race - only ONE should get this
          console.log(
            `[VU ${__VU}] WON the race - successful scan in ${duration}ms`
          );
          successfulScans.add(1);
        } else if (scanResult.already_scanned === true) {
          // Lost to a scan that completed before this request arrived
          raceConditionsCaught.add(1);
          console.log(
            `[VU ${__VU}] Lost race (already_scanned) - ${duration}ms`
          );
        } else if (scanResult.error_message) {
          // Lost due to concurrent processing detection
          const msg = scanResult.error_message;
          if (msg.includes('Concurrent') || msg.includes('another scanner') || msg.includes('being processed')) {
            raceConditionsCaught.add(1);
            console.log(
              `[VU ${__VU}] Lost race (concurrent detected) - "${msg}" (${duration}ms)`
            );
          } else if (msg.includes('not found')) {
            ticketNotFoundCount.add(1);
            console.log(
              `[VU ${__VU}] Ticket not found - "${msg}" (${duration}ms)`
            );
          } else {
            console.log(
              `[VU ${__VU}] Unknown error - "${msg}" (${duration}ms)`
            );
          }
        }
      }
    } catch (parseError) {
      console.log(
        `[VU ${__VU}] Parse error: ${parseError.message}`
      );
    }
  } else {
    console.log(
      `[VU ${__VU}] Race test HTTP error: status=${response.status}`
    );
  }
}

/**
 * Generate summary report at end of test run.
 * Outputs human-readable summary to stdout and JSON data to file.
 */
export function handleSummary(data) {
  const metrics = data.metrics;

  // Extract threshold pass/fail status
  const thresholdResults = Object.entries(data.thresholds || {})
    .map(([name, result]) => `  ${result.ok ? 'PASS' : 'FAIL'} ${name}`)
    .join('\n');

  // Calculate metrics with fallbacks
  const totalRequests = metrics.http_reqs?.values?.count || 0;
  const successCount = metrics.successful_scans?.values?.count || 0;
  const alreadyScanned = metrics.already_scanned?.values?.count || 0;
  const notFound = metrics.ticket_not_found?.values?.count || 0;
  const raceCaught = metrics.race_conditions_caught?.values?.count || 0;
  const errorRateVal = (metrics.scan_errors?.values?.rate || 0) * 100;

  const avgDuration = Math.round(metrics.scan_duration?.values?.avg || 0);
  const p95Duration = Math.round(metrics.scan_duration?.values?.['p(95)'] || 0);
  const p99Duration = Math.round(metrics.scan_duration?.values?.['p(99)'] || 0);
  const maxDuration = Math.round(metrics.scan_duration?.values?.max || 0);
  const minDuration = Math.round(metrics.scan_duration?.values?.min || 0);

  const summary = `
================================================================================
                      SCANNER BURST LOAD TEST RESULTS
================================================================================

Configuration:
  Scenario 1:     10 VUs scanning unique tickets for 1 minute
  Scenario 2:     10 VUs racing to scan same ticket simultaneously
  Endpoint:       POST /rest/v1/rpc/scan_ticket_atomic
  Target:         p95 < 200ms, error rate < 0.1%

--------------------------------------------------------------------------------
Scan Results:
--------------------------------------------------------------------------------
  Total Requests:    ${totalRequests}
  Successful Scans:  ${successCount}
  Already Scanned:   ${alreadyScanned}
  Ticket Not Found:  ${notFound}
  Error Rate:        ${errorRateVal.toFixed(3)}%

--------------------------------------------------------------------------------
Response Times:
--------------------------------------------------------------------------------
  Min:      ${minDuration}ms
  Average:  ${avgDuration}ms
  P95:      ${p95Duration}ms   ${p95Duration < 200 ? '(PASS)' : '(FAIL - target < 200ms)'}
  P99:      ${p99Duration}ms
  Max:      ${maxDuration}ms

--------------------------------------------------------------------------------
Race Condition Handling:
--------------------------------------------------------------------------------
  Race attempts caught:  ${raceCaught}
  Expected behavior:     9 out of 10 VUs should be blocked (1 winner)
  ${raceCaught >= 8 ? 'PASS - Race conditions properly handled' : 'CHECK - Fewer race conditions than expected'}

--------------------------------------------------------------------------------
Threshold Results:
--------------------------------------------------------------------------------
${thresholdResults || '  (no thresholds defined)'}

================================================================================
`;

  return {
    'stdout': summary,
    'load-tests/results/scanner-burst-results.json': JSON.stringify(data, null, 2),
  };
}
