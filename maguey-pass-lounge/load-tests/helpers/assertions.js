/**
 * Common Assertions
 * 
 * Reusable assertion functions for load tests
 */

import { check } from 'k6';

/**
 * Check order creation response
 */
export function checkOrderResponse(response) {
  return check(response, {
    'order response status is 200': (r) => r.status === 200,
    'order response has body': (r) => r.body && r.body.length > 0,
    'order response time < 3s': (r) => r.timings.duration < 3000,
  });
}

/**
 * Check event listing response
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

/**
 * Check single event response
 */
export function checkSingleEventResponse(response) {
  return check(response, {
    'single event status is 200': (r) => r.status === 200,
    'single event has data': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data && data.id && data.name;
      } catch {
        return false;
      }
    },
    'single event response time < 500ms': (r) => r.timings.duration < 500,
  });
}

/**
 * Check availability response
 */
export function checkAvailabilityResponse(response) {
  return check(response, {
    'availability response status is 200': (r) => r.status === 200,
    'availability response has data': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data && (Array.isArray(data) || typeof data === 'object');
      } catch {
        return false;
      }
    },
    'availability response time < 500ms': (r) => r.timings.duration < 500,
  });
}

/**
 * Check ticket type response
 */
export function checkTicketTypeResponse(response) {
  return check(response, {
    'ticket type status is 200': (r) => r.status === 200,
    'ticket type has data': (r) => {
      try {
        const data = JSON.parse(r.body);
        return Array.isArray(data) && data.length > 0;
      } catch {
        return false;
      }
    },
    'ticket type response time < 500ms': (r) => r.timings.duration < 500,
  });
}

/**
 * Check error response (for expected failures)
 */
export function checkErrorResponse(response, expectedStatus = 400) {
  return check(response, {
    'error response status': (r) => r.status === expectedStatus,
    'error response has message': (r) => {
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
 * Check inventory exhaustion response
 */
export function checkInventoryExhaustedResponse(response) {
  return check(response, {
    'inventory exhausted status': (r) => r.status === 400 || r.status === 409,
    'inventory exhausted message': (r) => {
      try {
        const data = JSON.parse(r.body);
        const body = JSON.stringify(data).toLowerCase();
        return body.includes('inventory') || body.includes('sold out') || body.includes('unavailable');
      } catch {
        return false;
      }
    },
  });
}

/**
 * Validate order structure
 */
export function validateOrderStructure(order) {
  return (
    order &&
    typeof order.id === 'string' &&
    typeof order.event_id === 'string' &&
    typeof order.total === 'number' &&
    order.total > 0 &&
    typeof order.status === 'string'
  );
}

/**
 * Validate ticket structure
 */
export function validateTicketStructure(ticket) {
  return (
    ticket &&
    typeof ticket.id === 'string' &&
    typeof ticket.order_id === 'string' &&
    typeof ticket.qr_token === 'string' &&
    ticket.qr_token.length > 0
  );
}
