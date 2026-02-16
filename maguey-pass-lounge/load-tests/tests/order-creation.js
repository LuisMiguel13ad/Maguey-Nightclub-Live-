/**
 * Order Creation Load Test
 * 
 * Focuses specifically on the checkout flow under load.
 * Tests inventory race conditions and order creation performance.
 */

import http from 'k6/http';
import { check, group } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';
import { getConfig, getSupabaseUrl, getSupabaseHeaders } from '../config/environments.js';
import { checkOrderResponse, checkInventoryExhaustedResponse } from '../helpers/assertions.js';
import { generateTestOrderData } from '../helpers/auth.js';

const config = getConfig();
const supabaseUrl = getSupabaseUrl(config);
const headers = getSupabaseHeaders(config);

// Custom metrics
const orderSuccessCounter = new Counter('orders_created');
const orderFailedCounter = new Counter('orders_failed');
const orderDuration = new Trend('order_creation_duration');
const inventoryErrors = new Counter('inventory_errors');
const raceConditionDetected = new Counter('race_conditions');
const orderSuccessRate = new Rate('order_success_rate');

export const options = {
  scenarios: {
    concurrent_checkout: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 200,
      stages: [
        { duration: '1m', target: 10 },  // 10 orders/second
        { duration: '2m', target: 20 },  // 20 orders/second (peak)
        { duration: '1m', target: 5 },   // Cool down to 5 orders/second
      ],
    },
  },
  thresholds: {
    orders_created: ['count>100'],  // Should create at least 100 orders
    'order_creation_duration': ['p(95)<5000', 'p(99)<8000'],
    'http_req_failed{name:checkout}': ['rate<0.02'], // <2% checkout failures
    'inventory_errors': ['count<50'], // Should handle inventory gracefully
    'order_success_rate': ['rate>0.90'], // >90% success rate
  },
};

// Cache event and ticket type data
let testEventId = null;
let testTicketTypeId = null;

export function setup() {
  // Setup: Get a test event and ticket type
  const eventsResponse = http.get(
    `${supabaseUrl}/events?status=eq.published&is_active=eq.true&order=event_date.asc&limit=1`,
    { headers }
  );
  
  let event = null;
  try {
    const events = JSON.parse(eventsResponse.body);
    if (events && events.length > 0) {
      event = events[0];
      testEventId = event.id;
    }
  } catch (e) {
    console.error('Failed to get test event:', e);
  }
  
  if (!testEventId) {
    throw new Error('No test event available. Please create a test event first.');
  }
  
  // Get ticket types for the event
  const ticketTypesResponse = http.get(
    `${supabaseUrl}/ticket_types?event_id=eq.${testEventId}&is_active=eq.true&limit=1`,
    { headers }
  );
  
  try {
    const ticketTypes = JSON.parse(ticketTypesResponse.body);
    if (ticketTypes && ticketTypes.length > 0) {
      testTicketTypeId = ticketTypes[0].id;
    }
  } catch (e) {
    console.error('Failed to get test ticket type:', e);
  }
  
  if (!testTicketTypeId) {
    throw new Error('No test ticket type available.');
  }
  
  return {
    eventId: testEventId,
    ticketTypeId: testTicketTypeId,
  };
}

export default function (data) {
  if (!data || !data.eventId || !data.ticketTypeId) {
    return;
  }
  
  group('checkout_flow', function () {
    // Step 1: Get event with availability (quick check)
    const eventResponse = http.get(
      `${supabaseUrl}/events?id=eq.${data.eventId}&select=id,name,event_date,status`,
      { headers, tags: { name: 'getEvent' } }
    );
    
    check(eventResponse, {
      'event retrieved': (r) => r.status === 200,
    });
    
    // Step 2: Check ticket type availability
    const ticketTypeResponse = http.get(
      `${supabaseUrl}/ticket_types?id=eq.${data.ticketTypeId}&select=id,name,price,fee,total_inventory,tickets_sold`,
      { headers, tags: { name: 'checkAvailability' } }
    );
    
    const availabilityCheck = check(ticketTypeResponse, {
      'ticket type retrieved': (r) => r.status === 200,
      'availability data present': (r) => {
        try {
          const data = JSON.parse(r.body);
          return Array.isArray(data) && data.length > 0;
        } catch {
          return false;
        }
      },
    });
    
    if (!availabilityCheck) {
      return;
    }
    
    let ticketType = null;
    try {
      const ticketTypes = JSON.parse(ticketTypeResponse.body);
      ticketType = Array.isArray(ticketTypes) ? ticketTypes[0] : ticketTypes;
    } catch (e) {
      return;
    }
    
    if (!ticketType) {
      return;
    }
    
    // Check if tickets are available
    const available = ticketType.total_inventory === null 
      ? true 
      : (ticketType.total_inventory - ticketType.tickets_sold) > 0;
    
    if (!available) {
      // Expected - inventory exhausted
      inventoryErrors.add(1);
      return;
    }
    
    // Step 3: Create order (the critical path)
    const orderStartTime = Date.now();
    
    const orderData = generateTestOrderData(data.eventId, data.ticketTypeId, 1);
    const unitPrice = ticketType.price || 50;
    const unitFee = ticketType.fee || 5;
    const subtotal = unitPrice;
    const fees = unitFee;
    const total = subtotal + fees;
    
    const orderPayload = JSON.stringify({
      p_event_id: data.eventId,
      p_purchaser_email: orderData.purchaserEmail,
      p_purchaser_name: orderData.purchaserName,
      p_user_id: null,
      p_subtotal: subtotal,
      p_fees_total: fees,
      p_total: total,
      p_status: 'pending',
      p_metadata: { 
        ...orderData.metadata, 
        loadTest: true,
        timestamp: Date.now(),
      },
      p_promo_code_id: null,
      p_line_items: [{
        ticket_type_id: data.ticketTypeId,
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
        tags: { name: 'checkout' },
        timeout: '10s',
      }
    );
    
    const orderEndTime = Date.now();
    const orderDurationMs = orderEndTime - orderStartTime;
    orderDuration.add(orderDurationMs);
    
    const orderSuccess = check(orderResponse, {
      'order created successfully': (r) => r.status === 200 || r.status === 201,
      'order response has data': (r) => {
        try {
          const data = JSON.parse(r.body);
          return data && (data.order_id || data.order_data);
        } catch {
          return false;
        }
      },
      'order creation time acceptable': (r) => r.timings.duration < 5000,
    });
    
    if (orderSuccess) {
      orderSuccessCounter.add(1);
      orderSuccessRate.add(1);
      
      // Verify order structure
      try {
        const orderData = JSON.parse(orderResponse.body);
        check(orderData, {
          'order has valid structure': (d) => {
            return d && (
              (d.order_id && d.tickets_data) ||
              (d.order_data && d.order_data.id)
            );
          },
          'order has tickets': (d) => {
            return d && (
              (d.tickets_data && d.tickets_data.length > 0) ||
              (d.ticket_email_payloads && d.ticket_email_payloads.length > 0)
            );
          },
        });
      } catch (e) {
        // Response format might differ
      }
    } else {
      orderFailedCounter.add(1);
      orderSuccessRate.add(0);
      
      // Analyze failure reason
      if (orderResponse.status === 400) {
        const isInventoryError = checkInventoryExhaustedResponse(orderResponse);
        if (isInventoryError) {
          inventoryErrors.add(1);
          // This could indicate a race condition if many concurrent requests
          // fail with inventory errors
        }
      } else if (orderResponse.status === 429) {
        // Rate limited
      } else if (orderResponse.status >= 500) {
        // Server error
      }
    }
    
    // Step 4: Verify inventory updated (optional - can be expensive)
    // Skip in high-load scenarios to reduce database queries
    if (Math.random() < 0.1) { // Only check 10% of the time
      const verifyResponse = http.get(
        `${supabaseUrl}/ticket_types?id=eq.${data.ticketTypeId}&select=tickets_sold`,
        { headers, tags: { name: 'verifyInventory' } }
      );
      
      check(verifyResponse, {
        'inventory verification successful': (r) => r.status === 200,
      });
    }
  });
}

export function handleSummary(data) {
  return {
    'stdout': JSON.stringify(data, null, 2),
  };
}
