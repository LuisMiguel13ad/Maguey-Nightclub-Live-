/**
 * Rate Limit Middleware
 * 
 * Middleware for API routes to enforce rate limiting.
 * Can be used with Supabase Edge Functions, API routes, or custom endpoints.
 * 
 * @example
 * ```typescript
 * // In an API route
 * export async function handler(req: Request) {
 *   const result = await rateLimitMiddleware(req, orderLimiter);
 *   if (!result.allowed) {
 *     return new Response(
 *       JSON.stringify({ error: 'Rate limit exceeded' }),
 *       { status: 429, headers: result.headers }
 *     );
 *   }
 *   // Continue with request processing
 * }
 * ```
 */

import { RateLimiter, RateLimitResult, getClientIdentifier, extractIP } from '@/lib/rate-limiter';
import { createLogger } from '@/lib/logger';

const logger = createLogger({ module: 'rate-limit-middleware' });

// ============================================
// TYPES
// ============================================

/**
 * Options for rate limit middleware
 */
export interface RateLimitMiddlewareOptions {
  /** Rate limiter instance to use */
  limiter: RateLimiter;
  /** Function to extract user ID from request (optional) */
  getUserId?: (req: Request) => Promise<string | undefined> | string | undefined;
  /** Function to extract IP from request (optional, auto-detected if not provided) */
  getIP?: (req: Request) => string | undefined;
  /** Custom key generator (overrides default key generation) */
  keyGenerator?: (req: Request, userId?: string, ip?: string) => string;
  /** Whether to skip rate limiting (for development) */
  skip?: boolean;
  /** Custom error message */
  errorMessage?: string;
  /** Whether to include rate limit headers in response */
  includeHeaders?: boolean;
}

/**
 * Rate limit middleware result
 */
export interface RateLimitMiddlewareResult {
  /** Whether request is allowed */
  allowed: boolean;
  /** Rate limit result */
  result: RateLimitResult;
  /** HTTP headers to include in response */
  headers: Record<string, string>;
  /** Error response (if rate limited) */
  errorResponse?: Response;
}

// ============================================
// MIDDLEWARE FUNCTION
// ============================================

/**
 * Rate limit middleware for API requests
 * 
 * @param req - The incoming request
 * @param options - Middleware options
 * @returns Rate limit check result with headers
 */
export async function rateLimitMiddleware(
  req: Request,
  options: RateLimitMiddlewareOptions
): Promise<RateLimitMiddlewareResult> {
  const {
    limiter,
    getUserId,
    getIP,
    keyGenerator,
    skip = false,
    errorMessage = 'Too many requests, please try again later',
    includeHeaders = true,
  } = options;

  // Skip rate limiting if configured
  if (skip || limiter['config'].skip) {
    return {
      allowed: true,
      result: {
        allowed: true,
        remaining: limiter['config'].maxRequests,
        resetAt: Date.now() + limiter['config'].windowMs,
        total: 0,
      },
      headers: {},
    };
  }

  // Extract user ID and IP
  const userId = getUserId ? await getUserId(req) : undefined;
  const ip = getIP ? getIP(req) : extractIP(req.headers);
  
  // Generate rate limit key
  const key = keyGenerator
    ? keyGenerator(req, userId, ip)
    : getClientIdentifier(ip, userId, 'anonymous');

  // Check and increment rate limit
  const result = await limiter.increment(key, {
    ip,
    userId,
    endpoint: new URL(req.url).pathname,
  });

  // Build response headers
  const headers: Record<string, string> = {};
  
  if (includeHeaders) {
    headers['X-RateLimit-Limit'] = limiter['config'].maxRequests.toString();
    headers['X-RateLimit-Remaining'] = result.remaining.toString();
    headers['X-RateLimit-Reset'] = new Date(result.resetAt).toISOString();
    
    if (result.retryAfter !== undefined) {
      headers['Retry-After'] = result.retryAfter.toString();
    }
  }

  // If rate limited, create error response
  if (!result.allowed) {
    logger.warn('Rate limit exceeded', {
      key,
      ip,
      userId,
      endpoint: new URL(req.url).pathname,
      retryAfter: result.retryAfter,
    });

    const errorResponse = new Response(
      JSON.stringify({
        error: errorMessage,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: result.retryAfter,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      }
    );

    return {
      allowed: false,
      result,
      headers,
      errorResponse,
    };
  }

  return {
    allowed: true,
    result,
    headers,
  };
}

// ============================================
// HELPER FUNCTIONS FOR SPECIFIC USE CASES
// ============================================

/**
 * Rate limit middleware for order creation
 * Limits by user ID if authenticated, otherwise by IP
 */
export async function rateLimitOrderCreation(
  req: Request,
  userId?: string
): Promise<RateLimitMiddlewareResult> {
  const { orderLimiter } = await import('@/lib/rate-limiter');
  
  return rateLimitMiddleware(req, {
    limiter: orderLimiter,
    getUserId: () => Promise.resolve(userId),
    keyGenerator: (req, userId, ip) => {
      // Use user ID if available, otherwise use IP
      return userId ? `user:${userId}` : `ip:${ip || 'unknown'}`;
    },
  });
}

/**
 * Rate limit middleware for webhook endpoints
 * Limits by IP address
 */
export async function rateLimitWebhook(
  req: Request
): Promise<RateLimitMiddlewareResult> {
  const { webhookLimiter } = await import('@/lib/rate-limiter');
  
  return rateLimitMiddleware(req, {
    limiter: webhookLimiter,
    keyGenerator: (req, userId, ip) => {
      // Always use IP for webhooks
      return `ip:${ip || 'unknown'}`;
    },
  });
}

/**
 * Rate limit middleware for authentication endpoints
 * Limits by IP address (to prevent brute force)
 */
export async function rateLimitAuth(
  req: Request
): Promise<RateLimitMiddlewareResult> {
  const { authLimiter } = await import('@/lib/rate-limiter');
  
  return rateLimitMiddleware(req, {
    limiter: authLimiter,
    keyGenerator: (req, userId, ip) => {
      // Use IP for auth rate limiting
      return `ip:${ip || 'unknown'}`;
    },
  });
}

/**
 * Rate limit middleware for general API endpoints
 * Limits by user ID if authenticated, otherwise by IP
 */
export async function rateLimitAPI(
  req: Request,
  userId?: string
): Promise<RateLimitMiddlewareResult> {
  const { apiLimiter } = await import('@/lib/rate-limiter');
  
  return rateLimitMiddleware(req, {
    limiter: apiLimiter,
    getUserId: () => Promise.resolve(userId),
  });
}

// ============================================
// SUPABASE EDGE FUNCTION WRAPPER
// ============================================

/**
 * Wrap a Supabase Edge Function with rate limiting
 * 
 * @example
 * ```typescript
 * import { serve } from 'https://deno.land/std/http/server.ts';
 * 
 * serve(async (req) => {
 *   const rateLimitResult = await rateLimitWebhook(req);
 *   if (!rateLimitResult.allowed) {
 *     return rateLimitResult.errorResponse!;
 *   }
 *   
 *   // Your handler code here
 *   return new Response(JSON.stringify({ success: true }));
 * });
 * ```
 */
export async function withRateLimit<T>(
  req: Request,
  handler: (req: Request) => Promise<T>,
  options: RateLimitMiddlewareOptions
): Promise<T | Response> {
  const rateLimitResult = await rateLimitMiddleware(req, options);
  
  if (!rateLimitResult.allowed) {
    return rateLimitResult.errorResponse!;
  }
  
  // Add rate limit headers to response
  const result = await handler(req);
  
  // If result is a Response, add headers
  if (result instanceof Response) {
    const newHeaders = new Headers(result.headers);
    Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
      newHeaders.set(key, value);
    });
    return new Response(result.body, {
      status: result.status,
      statusText: result.statusText,
      headers: newHeaders,
    });
  }
  
  return result;
}

// ============================================
// EXPORTS
// ============================================

export const rateLimitMiddlewareExports = {
  rateLimitMiddleware,
  rateLimitOrderCreation,
  rateLimitWebhook,
  rateLimitAuth,
  rateLimitAPI,
  withRateLimit,
};

export default rateLimitMiddleware;
