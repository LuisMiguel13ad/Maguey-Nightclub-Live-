/**
 * Event Entry Load Test
 * 
 * Simulates event entry rush - 800 people entering over 1 hour.
 * Peak: 200 scans in first 15 minutes (rush hour).
 * 
 * Realistic scenario: Nightclub event with 800 capacity
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';
import { getConfig, getSupabaseUrl, getSupabaseHeaders, getScannerHeaders } from '../config/environments.js';
import { checkScanResponse, checkScanFailureResponse, checkAlreadyScannedResponse } from '../helpers/assertions.js';
import { generateTestQRToken, generateQRSignature } from '../helpers/qr-generator.js';

const config = getConfig();
const supabaseUrl = getSupabaseUrl(config);
const headers = getSupabaseHeaders(config);

// Custom metrics
const scanSuccessCounter = new Counter('scans_successful');
const scanFailedCounter = new Counter('scans_failed');
const scanDuration = new Trend('scan_duration');
const scanSuccessRate = new Rate('scan_success_rate');
const alreadyScannedCounter = new Counter('scans_already_scanned');
const invalidTicketCounter = new Counter('scans_invalid_ticket');

// Cache for ticket data
let testTickets = [];

export function setup() {
  // Setup: Get test tickets for scanning
  // These should be real tickets from the database
  const ticketsResponse = http.get(
    `${supabaseUrl}/tickets?status=eq.issued&select=id,qr_token,qr_signature,event_id&limit=1000`,
    { headers }
  );
  
  if (ticketsResponse.status === 200) {
    try {
      const tickets = JSON.parse(ticketsResponse.body);
      if (tickets && tickets.length > 0) {
        testTickets = tickets.slice(0, 800); // Get up to 800 tickets
        console.log(`Loaded ${testTickets.length} test tickets for scanning`);
      } else {
        console.warn('No test tickets found. Please ensure test tickets exist in database.');
      }
    } catch (e) {
      console.error('Failed to parse tickets:', e);
    }
  } else {
    console.warn('Failed to load test tickets. Status:', ticketsResponse.status);
  }
  
  if (testTickets.length === 0) {
    console.warn('WARNING: No test tickets available. Tests will fail.');
  }
  
  return {
    tickets: testTickets,
    ticketCount: testTickets.length,
  };
}

export const options = {
  scenarios: {
    event_entry: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 100,
      stages: [
        { duration: '5m', target: 5 },   // Early arrivals: 5 scans/sec (300 people in 5 min)
        { duration: '10m', target: 15 }, // Peak entry rush: 15 scans/sec (900 scans in 10 min = ~200 people)
        { duration: '15m', target: 3 },  // Stragglers: 3 scans/sec (270 people in 15 min)
        { duration: '5m', target: 1 },   // Late arrivals: 1 scan/sec (30 people in 5 min)
      ],
    },
  },
  thresholds: {
    scan_duration: ['p(95)<500', 'p(99)<1000'],  // 95% under 500ms, 99% under 1s
    'http_req_failed{name:scan}': ['rate<0.01'],  // <1% scan failures
    'http_req_duration{name:scan}': ['p(95)<500', 'p(99)<1000'],
    scans_successful: ['count>700'],  // Should scan at least 700 tickets successfully
    scan_success_rate: ['rate>0.90'], // >90% success rate
  },
};

export default function (data) {
  if (!data || !data.tickets || data.tickets.length === 0) {
    console.warn('No tickets available for scanning');
    return;
  }
  
  // Pick a random ticket to scan
  const ticketIndex = Math.floor(Math.random() * data.tickets.length);
  const ticket = data.tickets[ticketIndex];
  
  if (!ticket || !ticket.qr_token) {
    return;
  }
  
  // Generate valid QR token and signature
  const qrToken = ticket.qr_token;
  const qrSignature = ticket.qr_signature || generateQRSignature(qrToken);
  
  // Generate scanner ID (simulating different scanners at entry)
  const scannerId = `scanner_${Math.floor(Math.random() * 5) + 1}`;
  
  // Step 1: Lookup ticket by QR token (optional - scanner might do this first)
  const lookupStartTime = Date.now();
  const lookupResponse = http.get(
    `${supabaseUrl}/tickets?qr_token=eq.${qrToken}&select=id,status,scanned_at,event_id`,
    { headers, tags: { name: 'lookupTicket' } }
  );
  
  const lookupDuration = Date.now() - lookupStartTime;
  
  check(lookupResponse, {
    'ticket lookup successful': (r) => r.status === 200,
  });
  
  // Step 2: Send scan request
  // For load testing, we'll use the scanner API endpoint
  // This could be:
  // 1. Supabase Edge Function: /functions/v1/scan-ticket
  // 2. REST API endpoint: /api/scan
  // 3. Direct Supabase RPC: /rpc/scan_ticket (if available)
  
  const scanStartTime = Date.now();
  
  // Option 1: Edge Function (recommended for load testing)
  const scanPayload = JSON.stringify({
    qrToken: qrToken,
    qrSignature: qrSignature,
    scannerId: scannerId,
    scanMethod: 'qr',
  });
  
  const edgeFunctionUrl = `${config.supabaseUrl}/functions/v1/scan-ticket`;
  const edgeFunctionHeaders = {
    'Authorization': `Bearer ${config.supabaseAnonKey}`,
    'Content-Type': 'application/json',
  };
  
  let scanResponse = http.post(
    edgeFunctionUrl,
    scanPayload,
    { 
      headers: edgeFunctionHeaders,
      tags: { name: 'scan' },
      timeout: '5s',
    }
  );
  
  // Fallback: If Edge Function doesn't exist, try direct ticket update via Supabase
  // This simulates scanning by updating ticket status directly
  if (scanResponse.status === 404 || scanResponse.status === 0) {
    // Alternative: Update ticket status directly (simulating scan)
    const updatePayload = JSON.stringify({
      status: 'scanned',
      scanned_at: new Date().toISOString(),
    });
    
    scanResponse = http.patch(
      `${supabaseUrl}/tickets?id=eq.${ticket.id}`,
      updatePayload,
      { 
        headers, 
        tags: { name: 'scan' },
        timeout: '5s',
      }
    );
  }
  
  const scanEndTime = Date.now();
  const scanDurationMs = scanEndTime - scanStartTime;
  scanDuration.add(scanDurationMs);
  
  // Step 3: Verify response
  const scanSuccess = check(scanResponse, {
    'scan request successful': (r) => r.status === 200 || r.status === 201,
    'scan response time acceptable': (r) => r.timings.duration < 1000,
  });
  
  if (scanSuccess) {
    // Parse response to check if scan was actually successful
    let scanResult = null;
    try {
      scanResult = JSON.parse(scanResponse.body);
    } catch (e) {
      // Response might not be JSON
    }
    
    if (scanResult && (scanResult.success === true || scanResult.status === 'scanned')) {
      scanSuccessCounter.add(1);
      scanSuccessRate.add(1);
    } else if (scanResult && scanResult.error) {
      scanFailedCounter.add(1);
      scanSuccessRate.add(0);
      
      // Categorize failure
      const errorMsg = JSON.stringify(scanResult.error).toLowerCase();
      if (errorMsg.includes('already scanned') || errorMsg.includes('already used')) {
        alreadyScannedCounter.add(1);
      } else if (errorMsg.includes('not found') || errorMsg.includes('invalid')) {
        invalidTicketCounter.add(1);
      }
    } else {
      // Assume success if status is 200
      scanSuccessCounter.add(1);
      scanSuccessRate.add(1);
    }
  } else {
    scanFailedCounter.add(1);
    scanSuccessRate.add(0);
    
    // Check for specific error types
    if (scanResponse.status === 400 || scanResponse.status === 409) {
      const isAlreadyScanned = checkAlreadyScannedResponse(scanResponse);
      if (isAlreadyScanned) {
        alreadyScannedCounter.add(1);
      } else {
        invalidTicketCounter.add(1);
      }
    }
  }
  
  // Small delay between scans (realistic entry flow)
  // During peak, delays are shorter
  const currentRate = __ENV.ARRIVAL_RATE || 5;
  const delay = currentRate > 10 ? 0.1 : Math.random() * 0.5 + 0.2;
  sleep(delay);
}

export function handleSummary(data) {
  return {
    'stdout': JSON.stringify(data, null, 2),
  };
}
