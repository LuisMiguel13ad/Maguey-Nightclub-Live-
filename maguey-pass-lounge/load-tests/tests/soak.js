/**
 * Soak Test
 * 
 * Verifies system stability over extended period.
 * Checks for memory leaks, connection pool exhaustion, resource leaks.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { getConfig, getSupabaseUrl, getSupabaseHeaders } from '../config/environments.js';
import { checkEventResponse, checkOrderResponse } from '../helpers/assertions.js';
import { generateTestOrderData } from '../helpers/auth.js';

const config = getConfig();
const supabaseUrl = getSupabaseUrl(config);
const headers = getSupabaseHeaders(config);

// Custom metrics for soak test
const memoryUsage = new Trend('memory_usage');
const connectionErrors = new Counter('connection_errors');
const orderSuccessCounter = new Counter('soak_orders_created');

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up
    { duration: '30m', target: 50 }, // Extended duration (30 minutes)
    { duration: '2m', target: 0 },   // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // Should remain stable
    http_req_failed: ['rate<0.02'],    // Low error rate maintained
    'connection_errors': ['count<10'],  // Connection pool should handle load
    'soak_orders_created': ['count>50'], // Should create orders throughout
  },
};

export default function () {
  // Mix of operations to simulate real usage
  
  // 80% of requests: Browse events
  if (Math.random() < 0.8) {
    const eventsResponse = http.get(
      `${supabaseUrl}/events?status=eq.published&is_active=eq.true&order=event_date.asc&limit=20`,
      { headers, tags: { name: 'events' } }
    );
    
    checkEventResponse(eventsResponse);
    
    if (eventsResponse.status === 0) {
      connectionErrors.add(1);
    }
  }
  
  // 15% of requests: Check availability
  else if (Math.random() < 0.15) {
    // Get a random event first
    const eventsResponse = http.get(
      `${supabaseUrl}/events?status=eq.published&is_active=eq.true&limit=5`,
      { headers, tags: { name: 'events' } }
    );
    
    let events = [];
    try {
      events = JSON.parse(eventsResponse.body);
    } catch (e) {
      return;
    }
    
    if (events.length > 0) {
      const event = events[Math.floor(Math.random() * events.length)];
      
      const ticketTypesResponse = http.get(
        `${supabaseUrl}/ticket_types?event_id=eq.${event.id}&is_active=eq.true&limit=3`,
        { headers, tags: { name: 'availability' } }
      );
      
      check(ticketTypesResponse, {
        'availability check successful': (r) => r.status === 200,
      });
    }
  }
  
  // 5% of requests: Create orders (lower rate for extended test)
  else {
    const eventsResponse = http.get(
      `${supabaseUrl}/events?status=eq.published&is_active=eq.true&limit=5`,
      { headers, tags: { name: 'events' } }
    );
    
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
    
    const ticketTypesResponse = http.get(
      `${supabaseUrl}/ticket_types?event_id=eq.${event.id}&is_active=eq.true&limit=3`,
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
      p_metadata: { ...orderData.metadata, soakTest: true },
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
      { headers, tags: { name: 'createOrder' } }
    );
    
    const orderSuccess = checkOrderResponse(orderResponse);
    
    if (orderSuccess) {
      orderSuccessCounter.add(1);
    }
  }
  
  // Regular intervals between requests
  sleep(Math.random() * 3 + 2);
}

export function handleSummary(data) {
  return {
    'stdout': JSON.stringify(data, null, 2),
  };
}
