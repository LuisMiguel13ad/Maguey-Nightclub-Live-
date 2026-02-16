/**
 * Security Headers
 * 
 * Provides security headers to protect against common web vulnerabilities
 * including XSS, clickjacking, MIME type sniffing, and more.
 * 
 * @example
 * ```typescript
 * // Use pre-configured headers
 * const headers = securityHeaders;
 * 
 * // Or customize
 * const customHeaders = getSecurityHeaders({
 *   contentSecurityPolicy: "default-src 'self'",
 *   xFrameOptions: 'SAMEORIGIN',
 * });
 * ```
 */

// ============================================
// TYPES
// ============================================

/**
 * Security headers configuration
 */
export interface SecurityHeadersConfig {
  /** Content Security Policy */
  contentSecurityPolicy?: string;
  /** X-Frame-Options header value */
  xFrameOptions?: 'DENY' | 'SAMEORIGIN';
  /** X-Content-Type-Options header value */
  xContentTypeOptions?: 'nosniff';
  /** Referrer-Policy header value */
  referrerPolicy?: string;
  /** Permissions-Policy header value */
  permissionsPolicy?: string;
  /** Strict-Transport-Security header value */
  strictTransportSecurity?: string;
  /** X-XSS-Protection header value (legacy, but still useful) */
  xXSSProtection?: '1; mode=block' | '0';
  /** Cross-Origin-Embedder-Policy header value */
  crossOriginEmbedderPolicy?: 'require-corp' | 'credentialless';
  /** Cross-Origin-Opener-Policy header value */
  crossOriginOpenerPolicy?: 'same-origin' | 'same-origin-allow-popups' | 'unsafe-none';
  /** Cross-Origin-Resource-Policy header value */
  crossOriginResourcePolicy?: 'same-origin' | 'same-site' | 'cross-origin';
}

/**
 * Default security headers configuration
 */
const DEFAULT_SECURITY_HEADERS: Required<SecurityHeadersConfig> = {
  contentSecurityPolicy: "default-src 'self'",
  xFrameOptions: 'DENY',
  xContentTypeOptions: 'nosniff',
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: 'geolocation=(), microphone=(), camera=()',
  strictTransportSecurity: 'max-age=31536000; includeSubDomains; preload',
  xXSSProtection: '1; mode=block',
  crossOriginEmbedderPolicy: 'require-corp',
  crossOriginOpenerPolicy: 'same-origin',
  crossOriginResourcePolicy: 'same-origin',
};

// ============================================
// SECURITY HEADERS GENERATOR
// ============================================

/**
 * Get security headers based on configuration
 * 
 * @param config - Security headers configuration (optional, uses defaults)
 * @returns Record of header names to header values
 * 
 * @example
 * ```typescript
 * const headers = getSecurityHeaders({
 *   contentSecurityPolicy: "default-src 'self'",
 *   xFrameOptions: 'DENY',
 * });
 * ```
 */
export function getSecurityHeaders(
  config: SecurityHeadersConfig = {}
): Record<string, string> {
  const headers: Record<string, string> = {};

  // Content Security Policy
  if (config.contentSecurityPolicy !== undefined) {
    headers['Content-Security-Policy'] = config.contentSecurityPolicy;
  } else {
    headers['Content-Security-Policy'] = DEFAULT_SECURITY_HEADERS.contentSecurityPolicy;
  }

  // X-Frame-Options
  if (config.xFrameOptions !== undefined) {
    headers['X-Frame-Options'] = config.xFrameOptions;
  } else {
    headers['X-Frame-Options'] = DEFAULT_SECURITY_HEADERS.xFrameOptions;
  }

  // X-Content-Type-Options
  if (config.xContentTypeOptions !== undefined) {
    headers['X-Content-Type-Options'] = config.xContentTypeOptions;
  } else {
    headers['X-Content-Type-Options'] = DEFAULT_SECURITY_HEADERS.xContentTypeOptions;
  }

  // Referrer-Policy
  if (config.referrerPolicy !== undefined) {
    headers['Referrer-Policy'] = config.referrerPolicy;
  } else {
    headers['Referrer-Policy'] = DEFAULT_SECURITY_HEADERS.referrerPolicy;
  }

  // Permissions-Policy
  if (config.permissionsPolicy !== undefined) {
    headers['Permissions-Policy'] = config.permissionsPolicy;
  } else {
    headers['Permissions-Policy'] = DEFAULT_SECURITY_HEADERS.permissionsPolicy;
  }

  // Strict-Transport-Security (HSTS)
  if (config.strictTransportSecurity !== undefined) {
    headers['Strict-Transport-Security'] = config.strictTransportSecurity;
  } else {
    headers['Strict-Transport-Security'] = DEFAULT_SECURITY_HEADERS.strictTransportSecurity;
  }

  // X-XSS-Protection (legacy, but still useful for older browsers)
  if (config.xXSSProtection !== undefined) {
    headers['X-XSS-Protection'] = config.xXSSProtection;
  } else {
    headers['X-XSS-Protection'] = DEFAULT_SECURITY_HEADERS.xXSSProtection;
  }

  // Cross-Origin-Embedder-Policy
  if (config.crossOriginEmbedderPolicy !== undefined) {
    headers['Cross-Origin-Embedder-Policy'] = config.crossOriginEmbedderPolicy;
  } else {
    headers['Cross-Origin-Embedder-Policy'] = DEFAULT_SECURITY_HEADERS.crossOriginEmbedderPolicy;
  }

  // Cross-Origin-Opener-Policy
  if (config.crossOriginOpenerPolicy !== undefined) {
    headers['Cross-Origin-Opener-Policy'] = config.crossOriginOpenerPolicy;
  } else {
    headers['Cross-Origin-Opener-Policy'] = DEFAULT_SECURITY_HEADERS.crossOriginOpenerPolicy;
  }

  // Cross-Origin-Resource-Policy
  if (config.crossOriginResourcePolicy !== undefined) {
    headers['Cross-Origin-Resource-Policy'] = config.crossOriginResourcePolicy;
  } else {
    headers['Cross-Origin-Resource-Policy'] = DEFAULT_SECURITY_HEADERS.crossOriginResourcePolicy;
  }

  return headers;
}

// ============================================
// PRE-CONFIGURED HEADERS FOR PASS-LOUNGE
// ============================================

/**
 * Pre-configured security headers for maguey-pass-lounge
 * 
 * Includes Stripe integration support:
 * - Allows Stripe.js scripts and frames
 * - Allows images from any HTTPS source (for event images, etc.)
 * - Allows inline styles (for Tailwind CSS)
 * 
 * @example
 * ```typescript
 * // In Vite config
 * server: {
 *   headers: securityHeaders,
 * }
 * 
 * // In Edge Function
 * return new Response(body, {
 *   headers: { ...securityHeaders, 'Content-Type': 'application/json' },
 * });
 * ```
 */
export const securityHeaders = getSecurityHeaders({
  contentSecurityPolicy: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.stripe.com https://cdnjs.cloudflare.com",
    "frame-src 'self' https://js.stripe.com https://*.stripe.com https://hooks.stripe.com",
    "connect-src 'self' https://api.stripe.com https://*.stripe.com https://*.supabase.co https://djbzjasdrwvbsoifxqzd.supabase.co wss://*.supabase.co",
    "img-src 'self' data: https: blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join('; '),
  xFrameOptions: 'DENY',
  xContentTypeOptions: 'nosniff',
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: [
    'geolocation=()',
    'microphone=()',
    'camera=()',
    'payment=(self "https://js.stripe.com")',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=()',
  ].join(', '),
  strictTransportSecurity: 'max-age=31536000; includeSubDomains; preload',
  xXSSProtection: '1; mode=block',
  crossOriginEmbedderPolicy: 'credentialless',
  crossOriginOpenerPolicy: 'same-origin-allow-popups',
  crossOriginResourcePolicy: 'cross-origin',
});

// ============================================
// EDGE FUNCTION UTILITIES
// ============================================

/**
 * Apply security headers to a Supabase Edge Function response
 * 
 * @param response - The response object or response body
 * @param additionalHeaders - Additional headers to include
 * @returns Response with security headers applied
 * 
 * @example
 * ```typescript
 * // In Supabase Edge Function
 * import { applySecurityHeaders } from '@/lib/security-headers';
 * 
 * serve(async (req) => {
 *   const body = JSON.stringify({ success: true });
 *   return applySecurityHeaders(
 *     new Response(body, {
 *       headers: { 'Content-Type': 'application/json' },
 *     })
 *   );
 * });
 * ```
 */
export function applySecurityHeaders(
  response: Response | string,
  additionalHeaders: Record<string, string> = {}
): Response {
  // If response is a string, create a new Response
  if (typeof response === 'string') {
    return new Response(response, {
      headers: {
        ...securityHeaders,
        ...additionalHeaders,
      },
    });
  }

  // If response is a Response object, merge headers
  const newHeaders = new Headers(response.headers);
  
  // Apply security headers (override existing if present)
  Object.entries(securityHeaders).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });
  
  // Apply additional headers
  Object.entries(additionalHeaders).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

/**
 * Create a response with security headers
 * 
 * @param body - Response body
 * @param init - Response initialization options
 * @returns Response with security headers
 * 
 * @example
 * ```typescript
 * return createSecureResponse(
 *   JSON.stringify({ data: 'value' }),
 *   { status: 200, headers: { 'Content-Type': 'application/json' } }
 * );
 * ```
 */
export function createSecureResponse(
  body: BodyInit | null,
  init: ResponseInit = {}
): Response {
  const headers = new Headers(init.headers);
  
  // Apply security headers
  Object.entries(securityHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });

  return new Response(body, {
    ...init,
    headers,
  });
}

// ============================================
// CSP BUILDER (HELPER)
// ============================================

/**
 * Build Content Security Policy string from directives
 * 
 * @param directives - CSP directives
 * @returns CSP string
 * 
 * @example
 * ```typescript
 * const csp = buildCSP({
 *   defaultSrc: ["'self'"],
 *   scriptSrc: ["'self'", "https://js.stripe.com"],
 *   styleSrc: ["'self'", "'unsafe-inline'"],
 * });
 * ```
 */
export function buildCSP(directives: Record<string, string[]>): string {
  return Object.entries(directives)
    .map(([directive, sources]) => {
      const directiveName = directive.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `${directiveName} ${sources.join(' ')}`;
    })
    .join('; ');
}

// ============================================
// EXPORTS
// ============================================

export const securityHeadersUtils = {
  getSecurityHeaders,
  securityHeaders,
  applySecurityHeaders,
  createSecureResponse,
  buildCSP,
};

export default securityHeaders;
