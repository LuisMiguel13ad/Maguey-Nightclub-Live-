/**
 * Common Assertions
 * 
 * Reusable assertion functions for load tests
 */

import { check } from 'k6';

/**
 * Check scan response
 */
export function checkScanResponse(response) {
  return check(response, {
    'scan response status is 200': (r) => r.status === 200,
    'scan response has body': (r) => r.body && r.body.length > 0,
    'scan response time < 500ms': (r) => r.timings.duration < 500,
    'scan response indicates success': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data && (data.success === true || data.status === 'scanned');
      } catch {
        return false;
      }
    },
  });
}

/**
 * Check scan failure response (already scanned, invalid, etc.)
 */
export function checkScanFailureResponse(response) {
  return check(response, {
    'scan failure status': (r) => r.status === 400 || r.status === 409,
    'scan failure has error message': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data && (data.error || data.message);
      } catch {
        return false;
      }
    },
  });
}

/**
 * Check already scanned response
 */
export function checkAlreadyScannedResponse(response) {
  return check(response, {
    'already scanned status': (r) => r.status === 400 || r.status === 409,
    'already scanned message': (r) => {
      try {
        const data = JSON.parse(r.body);
        const body = JSON.stringify(data).toLowerCase();
        return body.includes('already scanned') || body.includes('already used');
      } catch {
        return false;
      }
    },
  });
}

/**
 * Check invalid ticket response
 */
export function checkInvalidTicketResponse(response) {
  return check(response, {
    'invalid ticket status': (r) => r.status === 400 || r.status === 404,
    'invalid ticket message': (r) => {
      try {
        const data = JSON.parse(r.body);
        const body = JSON.stringify(data).toLowerCase();
        return body.includes('not found') || body.includes('invalid') || body.includes('expired');
      } catch {
        return false;
      }
    },
  });
}

/**
 * Check ticket lookup response
 */
export function checkTicketLookupResponse(response) {
  return check(response, {
    'ticket lookup status is 200': (r) => r.status === 200,
    'ticket lookup has data': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data && (data.id || (Array.isArray(data) && data.length > 0));
      } catch {
        return false;
      }
    },
    'ticket lookup response time < 300ms': (r) => r.timings.duration < 300,
  });
}

/**
 * Check webhook response
 */
export function checkWebhookResponse(response) {
  return check(response, {
    'webhook response status is 200': (r) => r.status === 200,
    'webhook response time < 1000ms': (r) => r.timings.duration < 1000,
  });
}

/**
 * Check WebSocket connection
 */
export function checkWebSocketConnection(ws) {
  return check(ws, {
    'websocket connected': (w) => w && w.readyState === 1,
  });
}

/**
 * Check scan log response
 */
export function checkScanLogResponse(response) {
  return check(response, {
    'scan log status is 200': (r) => r.status === 200,
    'scan log has data': (r) => {
      try {
        const data = JSON.parse(r.body);
        return Array.isArray(data) || (data && typeof data === 'object');
      } catch {
        return false;
      }
    },
  });
}

/**
 * Validate scan result structure
 */
export function validateScanResult(scanResult) {
  return (
    scanResult &&
    typeof scanResult.success === 'boolean' &&
    (scanResult.ticket || scanResult.error) &&
    scanResult.durationMs !== undefined
  );
}

/**
 * Check event response
 */
export function checkEventResponse(response) {
  return check(response, {
    'event response status is 200': (r) => r.status === 200,
    'event response has data': (r) => {
      try {
        const data = JSON.parse(r.body);
        return Array.isArray(data) && data.length > 0;
      } catch {
        return false;
      }
    },
    'event response time < 500ms': (r) => r.timings.duration < 500,
  });
}
