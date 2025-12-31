/**
 * Stress Test
 * 
 * Gradually increases load to find system breaking point.
 * Identifies maximum capacity and failure modes.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import { getConfig, getSupabaseUrl, getSupabaseHeaders } from '../config/environments.js';
import { checkEventResponse, checkOrderResponse } from '../helpers/assertions.js';
import { generateTestOrderData } from '../helpers/auth.js';

const config = getConfig();
const supabaseUrl = getSupabaseUrl(config);
const headers = getSupabaseHeaders(config);

// Custom metrics
const orderSuccessRate = new Rate('orders_successful');
const orderFailureRate = new Rate('orders_failed');
const timeoutRate = new Rate('timeouts');

export const options = {
  stages: [
    { duration: '2m', target: 100 },  // Start at 100 users
    { duration: '2m', target: 200 }, // Increase to 200
    { duration: '2m', target: 300 }, // Increase to 300
    { duration: '2m', target: 400 }, // Increase to 400
    { duration: '2m', target: 500 }, // Peak at 500 users
    { duration: '2m', target: 0 },   // Cool down
  ],
  thresholds: {
    // More lenient thresholds for stress test
    http_req_failed: ['rate<0.10'],  // Allow up to 10% errors under stress
    http_req_duration: ['p(95)<5000'], // 95% under 5 seconds
    'http_req_duration{name:createOrder}': ['p(95)<10000'], // Orders can take longer
    'timeouts': ['rate<0.05'], // Less than 5% timeouts
  },
};

export default function () {
  // Get events list
  const eventsResponse = http.get(
    `${supabaseUrl}/events?status=eq.published&is_active=eq.true&order=event_date.asc&limit=10`,
    { headers, tags: { name: 'events' } }
  );
  
  const eventsValid = checkEventResponse(eventsResponse);
  
  if (!eventsValid) {
    timeoutRate.add(1);
    return;
  }
  
  let events = [];
  try {
    events = JSON.parse(eventsResponse.body);
  } catch (e) {
    return;
  }
  
  if (events.length === 0) {
    return;
  }
  
  const event = events[Math.floor(Math.random() * events.length)];
  
  // Get ticket types
  const ticketTypesResponse = http.get(
    `${supabaseUrl}/ticket_types?event_id=eq.${event.id}&is_active=eq.true&limit=5`,
    { headers, tags: { name: 'ticket_types' } }
  );
  
  let ticketTypes = [];
  try {
    ticketTypes = JSON.parse(ticketTypesResponse.body);
  } catch (e) {
    return;
  }
  
  if (ticketTypes.length === 0) {
    return;
  }
  
  const ticketType = ticketTypes[0];
  
  // Attempt to create order (this will stress the system)
  const orderData = generateTestOrderData(event.id, ticketType.id, 1);
  const unitPrice = ticketType.price || 50;
  const unitFee = ticketType.fee || 5;
  const subtotal = unitPrice;
  const fees = unitFee;
  const total = subtotal + fees;
  
  const orderPayload = JSON.stringify({
    p_event_id: event.id,
    p_purchaser_email: orderData.purchaserEmail,
    p_purchaser_name: orderData.purchaserName,
    p_user_id: null,
    p_subtotal: subtotal,
    p_fees_total: fees,
    p_total: total,
    p_status: 'pending',
    p_metadata: orderData.metadata,
    p_promo_code_id: null,
    p_line_items: [{
      ticket_type_id: ticketType.id,
      quantity: 1,
      unit_price: unitPrice,
      unit_fee: unitFee,
      display_name: ticketType.name || 'General Admission',
    }],
    p_attendee_name: orderData.purchaserName,
    p_attendee_email: orderData.purchaserEmail,
  });
  
  const orderResponse = http.post(
    `${supabaseUrl}/rpc/create_order_with_tickets_atomic`,
    orderPayload,
    { 
      headers, 
      tags: { name: 'createOrder' },
      timeout: '30s', // Longer timeout for stress test
    }
  );
  
  const orderSuccess = check(orderResponse, {
    'order created': (r) => r.status === 200 || r.status === 201,
    'order response time acceptable': (r) => r.timings.duration < 10000,
  });
  
  if (orderSuccess) {
    orderSuccessRate.add(1);
  } else {
    orderFailureRate.add(1);
    
    // Log failure reasons
    if (orderResponse.status === 429) {
      // Rate limited
    } else if (orderResponse.status === 400) {
      // Bad request (possibly inventory exhausted)
    } else if (orderResponse.status >= 500) {
      // Server error
    }
  }
  
  // Shorter sleep under stress - more aggressive
  sleep(Math.random() * 1 + 0.5);
}

export function handleSummary(data) {
  return {
    'stdout': JSON.stringify(data, null, 2),
  };
}
