/**
 * Spike Test
 * 
 * Simulates sudden traffic surge (e.g., ticket sale announcement going viral).
 * Tests system resilience to sudden load increases.
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
const spikeOrderSuccessRate = new Rate('spike_orders_successful');
const spikeOrderFailureRate = new Rate('spike_orders_failed');

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Normal traffic (10 users)
    { duration: '10s', target: 500 },  // SPIKE! (sudden jump to 500)
    { duration: '1m', target: 500 },   // Stay at spike level
    { duration: '30s', target: 10 },   // Back to normal
    { duration: '1m', target: 10 },    // Recovery period
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'], // Allow higher latency during spike
    http_req_failed: ['rate<0.15'],    // Allow up to 15% errors during spike
    'http_req_duration{name:createOrder}': ['p(95)<8000'],
    'spike_orders_successful': ['rate>0.70'], // At least 70% success during spike
  },
};

export default function () {
  // Quick event listing (most users will do this)
  const eventsResponse = http.get(
    `${supabaseUrl}/events?status=eq.published&is_active=eq.true&order=event_date.asc&limit=10`,
    { headers, tags: { name: 'events' } }
  );
  
  checkEventResponse(eventsResponse);
  
  let events = [];
  try {
    events = JSON.parse(eventsResponse.body);
  } catch (e) {
    return;
  }
  
  if (events.length === 0) {
    return;
  }
  
  // During spike, users rush to buy - less browsing time
  const browseTime = __ENV.SPIKE_MODE === 'true' ? 0.1 : Math.random() * 2 + 1;
  sleep(browseTime);
  
  const event = events[Math.floor(Math.random() * events.length)];
  
  // Get ticket types quickly
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
  
  // During spike, users try to buy immediately
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
    p_metadata: { ...orderData.metadata, spikeTest: true },
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
      timeout: '15s',
    }
  );
  
  const orderSuccess = check(orderResponse, {
    'order created during spike': (r) => r.status === 200 || r.status === 201,
    'order not timed out': (r) => r.timings.duration < 15000,
  });
  
  if (orderSuccess) {
    spikeOrderSuccessRate.add(1);
  } else {
    spikeOrderFailureRate.add(1);
  }
  
  // Minimal delay during spike
  sleep(0.1);
}

export function handleSummary(data) {
  return {
    'stdout': JSON.stringify(data, null, 2),
  };
}
