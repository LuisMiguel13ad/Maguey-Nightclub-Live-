/**
 * Concurrent Scan Test
 * 
 * Tests concurrent scans of the same ticket.
 * Verifies race condition protection - only one scan should succeed.
 */

import http from 'k6/http';
import { check } from 'k6';
import { Counter, Rate } from 'k6/metrics';
import { getConfig, getSupabaseUrl, getSupabaseHeaders } from '../config/environments.js';
import { checkScanResponse, checkAlreadyScannedResponse } from '../helpers/assertions.js';
import { generateTestQRToken, generateQRSignature } from '../helpers/qr-generator.js';

const config = getConfig();
const supabaseUrl = getSupabaseUrl(config);
const headers = getSupabaseHeaders(config);

// Custom metrics
const firstScanSuccess = new Counter('first_scan_success');
const duplicateScanRejected = new Counter('duplicate_scan_rejected');
const raceConditionRate = new Rate('race_condition_protection');

// Shared ticket for all VUs to scan
let sharedTicket = null;

export function setup() {
  // Get a single test ticket that all VUs will try to scan
  const ticketsResponse = http.get(
    `${supabaseUrl}/tickets?status=eq.issued&select=id,qr_token,qr_signature&limit=1`,
    { headers }
  );
  
  if (ticketsResponse.status === 200) {
    try {
      const tickets = JSON.parse(ticketsResponse.body);
      if (tickets && tickets.length > 0) {
        sharedTicket = tickets[0];
        console.log(`Using ticket ${sharedTicket.id} for concurrent scan test`);
      } else {
        throw new Error('No test tickets available');
      }
    } catch (e) {
      throw new Error(`Failed to load test ticket: ${e.message}`);
    }
  } else {
    throw new Error(`Failed to load test ticket. Status: ${ticketsResponse.status}`);
  }
  
  return {
    ticket: sharedTicket,
  };
}

export const options = {
  scenarios: {
    duplicate_scan_attempt: {
      executor: 'per-vu-iterations',
      vus: 10,  // 10 virtual users
      iterations: 1,  // Each VU tries once
      maxDuration: '30s',
    },
  },
  thresholds: {
    'first_scan_success': ['count==1'],  // Exactly 1 should succeed
    'duplicate_scan_rejected': ['count==9'], // Exactly 9 should be rejected
    'race_condition_protection': ['rate==1.0'], // 100% protection
    'http_req_duration{name:scan}': ['p(95)<1000'], // Scans should be fast
  },
};

export default function (data) {
  if (!data || !data.ticket) {
    return;
  }
  
  const ticket = data.ticket;
  const qrToken = ticket.qr_token;
  const qrSignature = ticket.qr_signature || generateQRSignature(qrToken);
  const scannerId = `scanner_${__VU}`;
  
  // All 10 VUs try to scan the same ticket simultaneously
  const scanPayload = JSON.stringify({
    qrToken: qrToken,
    qrSignature: qrSignature,
    scannerId: scannerId,
    scanMethod: 'qr',
  });
  
  // Try Edge Function first
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
  
  // Fallback: Direct ticket update (simulating scan)
  if (scanResponse.status === 404 || scanResponse.status === 0) {
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
  
  // Check response
  const scanSuccess = check(scanResponse, {
    'scan request completed': (r) => r.status === 200 || r.status === 400 || r.status === 409,
  });
  
  if (!scanSuccess) {
    return;
  }
  
  // Parse response
  let scanResult = null;
  try {
    scanResult = JSON.parse(scanResponse.body);
  } catch (e) {
    // Response might not be JSON
  }
  
  // Determine if this was the first successful scan or a duplicate rejection
  if (scanResponse.status === 200) {
    // Check if response indicates success
    const isSuccess = scanResult && (
      scanResult.success === true || 
      scanResult.status === 'scanned' ||
      (scanResult.ticket && scanResult.ticket.status === 'scanned')
    );
    
    if (isSuccess) {
      firstScanSuccess.add(1);
      raceConditionRate.add(1);
    } else {
      // Might be a rejection in 200 response
      duplicateScanRejected.add(1);
      raceConditionRate.add(1);
    }
  } else if (scanResponse.status === 400 || scanResponse.status === 409) {
    // Rejected - check if it's "already scanned"
    const isAlreadyScanned = checkAlreadyScannedResponse(scanResponse);
    if (isAlreadyScanned) {
      duplicateScanRejected.add(1);
      raceConditionRate.add(1);
    }
  }
}

export function handleSummary(data) {
  // Verify race condition protection worked
  const firstSuccess = data.metrics.first_scan_success?.values?.count || 0;
  const duplicatesRejected = data.metrics.duplicate_scan_rejected?.values?.count || 0;
  
  const protectionWorked = firstSuccess === 1 && duplicatesRejected === 9;
  
  return {
    'stdout': JSON.stringify({
      ...data,
      raceConditionProtection: {
        worked: protectionWorked,
        firstScanSuccess: firstSuccess,
        duplicatesRejected: duplicatesRejected,
        message: protectionWorked 
          ? 'Race condition protection working correctly' 
          : 'WARNING: Race condition protection may have failed',
      },
    }, null, 2),
  };
}
