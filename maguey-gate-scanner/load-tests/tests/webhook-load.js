/**
 * Webhook Load Test
 * 
 * Tests webhook endpoint under load.
 * Simulates batch ticket creation webhooks from pass-lounge.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';
import { getConfig } from '../config/environments.js';
import { checkWebhookResponse } from '../helpers/assertions.js';
import { createSignedWebhookRequest } from '../helpers/webhook-signing.js';

const config = getConfig();

// Custom metrics
const webhookSuccessCounter = new Counter('webhooks_successful');
const webhookFailedCounter = new Counter('webhooks_failed');
const webhookDuration = new Trend('webhook_duration');
const webhookSuccessRate = new Rate('webhook_success_rate');

export const options = {
  stages: [
    { duration: '1m', target: 20 },  // Ramp up to 20 webhooks/sec
    { duration: '3m', target: 50 },  // Peak: 50 webhooks/sec
    { duration: '1m', target: 0 },   // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // 95% under 2 seconds
    http_req_failed: ['rate<0.02'],     // <2% errors
    'http_req_duration{name:webhook}': ['p(95)<2000', 'p(99)<3000'],
    'webhook_success_rate': ['rate>0.95'], // >95% success rate
    webhooks_successful: ['count>500'], // Should process at least 500 webhooks
  },
};

export default function () {
  // Generate webhook payload (simulating ticket creation from pass-lounge)
  const timestamp = Date.now();
  const webhookPayload = {
    event: 'ticket.created',
    data: {
      ticket_id: `test_ticket_${timestamp}_${__VU}_${__ITER}`,
      order_id: `test_order_${timestamp}_${__VU}`,
      event_id: `test_event_${timestamp}`,
      qr_token: `qr_${timestamp}_${Math.random().toString(36).substring(7)}`,
      qr_signature: `sig_${timestamp}`,
      attendee_name: `Test Attendee ${__VU}-${__ITER}`,
      attendee_email: `test_${timestamp}@maguey-test.com`,
      status: 'issued',
      created_at: new Date().toISOString(),
    },
    timestamp: timestamp,
  };
  
  // Create signed webhook request
  const webhookSecret = __ENV.VITE_WEBHOOK_SECRET || 'test-webhook-secret';
  const { headers, body } = createSignedWebhookRequest(webhookPayload, webhookSecret);
  
  // Send webhook to scanner endpoint
  // This would be your actual webhook endpoint (Edge Function or API route)
  const webhookStartTime = Date.now();
  
  // Option 1: Supabase Edge Function
  const webhookUrl = `${config.supabaseUrl}/functions/v1/ticket-webhook`;
  const webhookHeaders = {
    ...headers,
    'Authorization': `Bearer ${config.supabaseAnonKey}`,
  };
  
  // Option 2: Direct API endpoint (if available)
  // const webhookUrl = `${config.scannerApiUrl}/webhook`;
  // const webhookHeaders = headers;
  
  const webhookResponse = http.post(
    webhookUrl,
    body,
    { 
      headers: webhookHeaders,
      tags: { name: 'webhook' },
      timeout: '10s',
    }
  );
  
  const webhookEndTime = Date.now();
  const webhookDurationMs = webhookEndTime - webhookStartTime;
  webhookDuration.add(webhookDurationMs);
  
  // Verify response
  const webhookSuccess = check(webhookResponse, {
    'webhook processed successfully': (r) => r.status === 200 || r.status === 201,
    'webhook response time acceptable': (r) => r.timings.duration < 3000,
  });
  
  if (webhookSuccess) {
    webhookSuccessCounter.add(1);
    webhookSuccessRate.add(1);
  } else {
    webhookFailedCounter.add(1);
    webhookSuccessRate.add(0);
    
    // Log failure reason
    if (webhookResponse.status === 401 || webhookResponse.status === 403) {
      // Authentication/signature failure
    } else if (webhookResponse.status === 429) {
      // Rate limited
    } else if (webhookResponse.status >= 500) {
      // Server error
    }
  }
  
  // Small delay between webhooks
  sleep(Math.random() * 0.5 + 0.1);
}

export function handleSummary(data) {
  return {
    'stdout': JSON.stringify(data, null, 2),
  };
}
