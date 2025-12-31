/**
 * Example Supabase Edge Function with Security Headers
 * 
 * This demonstrates how to use security headers in Supabase Edge Functions.
 * 
 * Note: In actual Edge Functions, you'll need to import from a relative path
 * or copy the security-headers utility to the functions directory.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// ============================================
// OPTION 1: Inline Security Headers
// ============================================

const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.stripe.com; frame-src 'self' https://js.stripe.com https://hooks.stripe.com; connect-src 'self' https://api.stripe.com https://*.stripe.com; img-src 'self' data: https: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=(self "https://js.stripe.com"), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-XSS-Protection': '1; mode=block',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

// ============================================
// HELPER FUNCTION
// ============================================

function createSecureResponse(
  body: string | object,
  status: number = 200,
  additionalHeaders: Record<string, string> = {}
): Response {
  const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
  const contentType = typeof body === 'string' 
    ? additionalHeaders['Content-Type'] || 'text/plain'
    : 'application/json';

  return new Response(bodyString, {
    status,
    headers: {
      'Content-Type': contentType,
      ...securityHeaders,
      ...additionalHeaders,
    },
  });
}

// ============================================
// EXAMPLE HANDLER
// ============================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return createSecureResponse('', 200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
  }

  try {
    // Your handler logic here
    const data = {
      message: 'Hello from secure Edge Function',
      timestamp: new Date().toISOString(),
    };

    return createSecureResponse(data, 200, {
      'Access-Control-Allow-Origin': '*',
    });
  } catch (error) {
    return createSecureResponse(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      500
    );
  }
});

// ============================================
// USAGE NOTES
// ============================================

/**
 * To use the security-headers utility in Edge Functions:
 * 
 * 1. Copy security-headers.ts to supabase/functions/_shared/security-headers.ts
 * 2. Import it: import { securityHeaders } from '../_shared/security-headers.ts'
 * 3. Use it: return new Response(body, { headers: { ...securityHeaders, ...otherHeaders } })
 * 
 * OR use the inline approach shown above.
 */
