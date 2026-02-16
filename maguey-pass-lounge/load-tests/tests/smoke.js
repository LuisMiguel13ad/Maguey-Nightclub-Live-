/**
 * Smoke Test
 * 
 * Quick verification that the system works under minimal load.
 * All requests should succeed - this is a baseline check.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { getConfig, getSupabaseUrl, getSupabaseHeaders } from '../config/environments.js';
import {
  checkEventResponse,
  checkSingleEventResponse,
  checkAvailabilityResponse,
} from '../helpers/assertions.js';

const config = getConfig();
const supabaseUrl = getSupabaseUrl(config);
const headers = getSupabaseHeaders(config);

export const options = {
  vus: 2,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% under 500ms
    http_req_failed: ['rate<0.01'],     // <1% errors
    'http_req_duration{name:events}': ['p(95)<300'],
    'http_req_duration{name:event_detail}': ['p(95)<300'],
    'http_req_duration{name:availability}': ['p(95)<300'],
  },
};

export default function () {
  // Test 1: Get events list
  const eventsResponse = http.get(
    `${supabaseUrl}/events?status=eq.published&is_active=eq.true&order=event_date.asc&limit=10`,
    { headers, tags: { name: 'events' } }
  );
  
  checkEventResponse(eventsResponse);
  
  if (eventsResponse.status !== 200) {
    return;
  }
  
  let events = [];
  try {
    events = JSON.parse(eventsResponse.body);
  } catch (e) {
    return;
  }
  
  if (events.length === 0) {
    console.warn('No events found - ensure test data exists');
    return;
  }
  
  // Test 2: Get single event detail
  const event = events[0];
  const eventDetailResponse = http.get(
    `${supabaseUrl}/events?id=eq.${event.id}&select=*`,
    { headers, tags: { name: 'event_detail' } }
  );
  
  checkSingleEventResponse(eventDetailResponse);
  
  // Test 3: Get ticket types for event
  const ticketTypesResponse = http.get(
    `${supabaseUrl}/ticket_types?event_id=eq.${event.id}&is_active=eq.true&order=display_order.asc`,
    { headers, tags: { name: 'ticket_types' } }
  );
  
  check(ticketTypesResponse, {
    'ticket types status is 200': (r) => r.status === 200,
    'ticket types have data': (r) => {
      try {
        const data = JSON.parse(r.body);
        return Array.isArray(data) && data.length > 0;
      } catch {
        return false;
      }
    },
  });
  
  let ticketTypes = [];
  try {
    ticketTypes = JSON.parse(ticketTypesResponse.body);
  } catch (e) {
    return;
  }
  
  if (ticketTypes.length === 0) {
    return;
  }
  
  // Test 4: Check availability (using RPC or direct query)
  // For smoke test, we'll check ticket type availability
  const ticketType = ticketTypes[0];
  const availabilityResponse = http.get(
    `${supabaseUrl}/ticket_types?id=eq.${ticketType.id}&select=id,name,total_inventory,tickets_sold`,
    { headers, tags: { name: 'availability' } }
  );
  
  checkAvailabilityResponse(availabilityResponse);
  
  // Small delay between requests
  sleep(1);
}

export function handleSummary(data) {
  return {
    'stdout': JSON.stringify(data, null, 2),
  };
}
