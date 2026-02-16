/**
 * Load Test
 * 
 * Simulates expected traffic during ticket sales.
 * Realistic user flow: browse → select → check availability → checkout
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate } from 'k6/metrics';
import { getConfig, getSupabaseUrl, getSupabaseHeaders } from '../config/environments.js';
import {
  checkEventResponse,
  checkSingleEventResponse,
  checkAvailabilityResponse,
  checkOrderResponse,
} from '../helpers/assertions.js';
import { generateTestOrderData } from '../helpers/auth.js';

const config = getConfig();
const supabaseUrl = getSupabaseUrl(config);
const headers = getSupabaseHeaders(config);

// Custom metrics
const orderSuccessRate = new Rate('orders_successful');
const orderFailureRate = new Rate('orders_failed');

export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '3m', target: 100 },  // Stay at 100 users (steady state)
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.05'],  // <5% errors
    'http_req_duration{name:events}': ['p(95)<500'],
    'http_req_duration{name:event_detail}': ['p(95)<500'],
    'http_req_duration{name:availability}': ['p(95)<500'],
    'http_req_duration{name:createOrder}': ['p(95)<3000', 'p(99)<5000'],
    'orders_successful': ['rate>0.90'],  // >90% success rate
    'orders_failed': ['rate<0.10'],
  },
};

// Cache event and ticket type data
let cachedEvents = null;
let cachedTicketTypes = {};

export default function () {
  group('user_journey', function () {
    // Step 1: View events list (browse)
    const eventsResponse = http.get(
      `${supabaseUrl}/events?status=eq.published&is_active=eq.true&order=event_date.asc&limit=20`,
      { headers, tags: { name: 'events' } }
    );
    
    const eventsValid = checkEventResponse(eventsResponse);
    
    if (!eventsValid) {
      return;
    }
    
    let events = [];
    try {
      events = JSON.parse(eventsResponse.body);
    } catch (e) {
      return;
    }
    
    if (events.length === 0) {
      console.warn('No events available');
      return;
    }
    
    // Cache events for reuse
    cachedEvents = events;
    
    // Random delay (user browsing)
    sleep(Math.random() * 2 + 1);
    
    // Step 2: Select an event (pick random event)
    const event = events[Math.floor(Math.random() * events.length)];
    
    const eventDetailResponse = http.get(
      `${supabaseUrl}/events?id=eq.${event.id}&select=*`,
      { headers, tags: { name: 'event_detail' } }
    );
    
    checkSingleEventResponse(eventDetailResponse);
    
    sleep(Math.random() * 1 + 0.5);
    
    // Step 3: Get ticket types
    let ticketTypes = cachedTicketTypes[event.id];
    
    if (!ticketTypes) {
      const ticketTypesResponse = http.get(
        `${supabaseUrl}/ticket_types?event_id=eq.${event.id}&is_active=eq.true&order=display_order.asc`,
        { headers, tags: { name: 'ticket_types' } }
      );
      
      check(ticketTypesResponse, {
        'ticket types status is 200': (r) => r.status === 200,
      });
      
      try {
        ticketTypes = JSON.parse(ticketTypesResponse.body);
        cachedTicketTypes[event.id] = ticketTypes;
      } catch (e) {
        return;
      }
    }
    
    if (!ticketTypes || ticketTypes.length === 0) {
      return;
    }
    
    sleep(Math.random() * 1 + 0.5);
    
    // Step 4: Check availability
    const ticketType = ticketTypes[Math.floor(Math.random() * ticketTypes.length)];
    
    const availabilityResponse = http.get(
      `${supabaseUrl}/ticket_types?id=eq.${ticketType.id}&select=id,name,total_inventory,tickets_sold`,
      { headers, tags: { name: 'availability' } }
    );
    
    const availabilityValid = checkAvailabilityResponse(availabilityResponse);
    
    if (!availabilityValid) {
      return;
    }
    
    let availability = null;
    try {
      const data = JSON.parse(availabilityResponse.body);
      availability = Array.isArray(data) ? data[0] : data;
    } catch (e) {
      return;
    }
    
    // Check if tickets are available
    const available = availability.total_inventory === null 
      ? true 
      : (availability.total_inventory - availability.tickets_sold) > 0;
    
    if (!available) {
      // Event is sold out - this is expected in load tests
      return;
    }
    
    sleep(Math.random() * 2 + 1); // User deciding
    
    // Step 5: Create order (checkout)
    // Note: This requires calling the order creation API endpoint
    // For Supabase, this might be an RPC function or Edge Function
    const orderData = generateTestOrderData(event.id, ticketType.id, 1);
    
    // Calculate totals
    const quantity = orderData.lineItems[0].quantity;
    const unitPrice = ticketType.price || 50;
    const unitFee = ticketType.fee || 5;
    const subtotal = unitPrice * quantity;
    const fees = unitFee * quantity;
    const total = subtotal + fees;
    
    // Update order data with actual prices
    orderData.lineItems[0].unitPrice = unitPrice;
    orderData.lineItems[0].unitFee = unitFee;
    
    // Call order creation (this would be your actual API endpoint)
    // For now, we'll simulate by calling Supabase RPC if available
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
      p_line_items: orderData.lineItems.map(item => ({
        ticket_type_id: item.ticketTypeId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        unit_fee: item.unitFee,
        display_name: item.displayName,
      })),
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
      orderSuccessRate.add(1);
      
      // Verify order was created
      try {
        const orderData = JSON.parse(orderResponse.body);
        check(orderData, {
          'order has ID': (d) => d && d.order_id,
          'order has tickets': (d) => d && d.tickets_data && d.tickets_data.length > 0,
        });
      } catch (e) {
        // Response might be in different format
      }
    } else {
      orderFailureRate.add(1);
    }
  });
  
  // Random delay between iterations
  sleep(Math.random() * 3 + 2);
}

export function handleSummary(data) {
  return {
    'stdout': JSON.stringify(data, null, 2),
  };
}
