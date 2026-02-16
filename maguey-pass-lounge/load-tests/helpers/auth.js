/**
 * Authentication Helpers
 * 
 * Helper functions for authenticated requests in load tests
 */

import http from 'k6/http';
import { check } from 'k6';

/**
 * Create a test user for load testing
 * Returns user data with email and password
 */
export function createTestUser(vuId, iteration) {
  const timestamp = Date.now();
  const email = `loadtest_${vuId}_${iteration}_${timestamp}@maguey-test.com`;
  const password = `TestPassword123!${vuId}`;
  const name = `Load Test User ${vuId}-${iteration}`;
  
  return {
    email,
    password,
    name,
    userId: null, // Will be set after signup
  };
}

/**
 * Sign up a test user
 * Returns auth token if successful
 */
export function signupUser(config, user) {
  const url = `${config.supabaseUrl}/auth/v1/signup`;
  const payload = JSON.stringify({
    email: user.email,
    password: user.password,
    data: {
      name: user.name,
    },
  });
  
  const headers = {
    'apikey': config.supabaseAnonKey,
    'Content-Type': 'application/json',
  };
  
  const response = http.post(url, payload, { headers });
  
  const success = check(response, {
    'signup successful': (r) => r.status === 200 || r.status === 201,
  });
  
  if (success && response.body) {
    try {
      const data = JSON.parse(response.body);
      return data.access_token || null;
    } catch (e) {
      return null;
    }
  }
  
  return null;
}

/**
 * Get authentication headers with token
 */
export function getAuthHeaders(config, token) {
  return {
    'apikey': config.supabaseAnonKey,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
}

/**
 * Generate test order data
 */
export function generateTestOrderData(eventId, ticketTypeId, quantity = 1) {
  const timestamp = Date.now();
  
  return {
    eventId,
    purchaserEmail: `test_${timestamp}@maguey-test.com`,
    purchaserName: `Test User ${timestamp}`,
    lineItems: [
      {
        ticketTypeId,
        quantity,
        unitPrice: 50, // Will be overridden by actual ticket type price
        unitFee: 5,
        displayName: 'General Admission',
      },
    ],
    metadata: {
      loadTest: true,
      timestamp,
      vuId: __VU,
      iteration: __ITER,
    },
  };
}

/**
 * Create anonymous session (for unauthenticated requests)
 */
export function createAnonymousSession(config) {
  // For Supabase, anonymous requests use anon key
  return {
    token: config.supabaseAnonKey,
    headers: getAuthHeaders(config, config.supabaseAnonKey),
  };
}
