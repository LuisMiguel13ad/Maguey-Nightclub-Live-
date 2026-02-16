/**
 * Rate Limiter Shared Module
 * Uses Upstash Redis for distributed rate limiting across edge function instances
 *
 * Tiered limits:
 * - auth: 20 requests per minute per IP
 * - payment: 20 requests per minute per IP
 * - read: 200 requests per minute per IP
 * - webhook: exempt (no rate limiting)
 */

import { Ratelimit } from "https://cdn.skypack.dev/@upstash/ratelimit@latest";
import { Redis } from "https://esm.sh/@upstash/redis@latest";

export type EndpointType = 'auth' | 'payment' | 'read' | 'webhook';

// Lazy-initialized Redis client factory
function createRedis(): Redis {
  return new Redis({
    url: Deno.env.get("UPSTASH_REDIS_REST_URL")!,
    token: Deno.env.get("UPSTASH_REDIS_REST_TOKEN")!,
  });
}

// Cache limiters to avoid recreating on each request
let authLimiter: Ratelimit | null = null;
let paymentLimiter: Ratelimit | null = null;
let readLimiter: Ratelimit | null = null;

function getLimiter(type: EndpointType): Ratelimit | null {
  // Webhooks are exempt from rate limiting
  if (type === 'webhook') return null;

  const redis = createRedis();

  switch (type) {
    case 'auth':
      if (!authLimiter) {
        authLimiter = new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(20, "60 s"),
          prefix: "maguey:auth",
        });
      }
      return authLimiter;
    case 'payment':
      if (!paymentLimiter) {
        paymentLimiter = new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(20, "60 s"),
          prefix: "maguey:payment",
        });
      }
      return paymentLimiter;
    case 'read':
      if (!readLimiter) {
        readLimiter = new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(200, "60 s"),
          prefix: "maguey:read",
        });
      }
      return readLimiter;
    default:
      return null;
  }
}

/**
 * Check rate limit for a request
 *
 * @param req - The incoming request
 * @param endpointType - Type of endpoint (auth, payment, read, webhook)
 * @returns Object with allowed boolean and optional response if blocked
 *
 * @example
 * ```typescript
 * const { allowed, response } = await checkRateLimit(req, 'payment');
 * if (!allowed) {
 *   return response!;
 * }
 * // Continue with request processing...
 * ```
 */
export async function checkRateLimit(
  req: Request,
  endpointType: EndpointType
): Promise<{ allowed: boolean; response?: Response }> {
  // Webhooks are exempt from rate limiting
  if (endpointType === 'webhook') {
    return { allowed: true };
  }

  // Skip rate limiting if Upstash is not configured (fail-open pattern)
  const upstashUrl = Deno.env.get("UPSTASH_REDIS_REST_URL");
  if (!upstashUrl) {
    console.log("[rate-limiter] Upstash not configured, skipping rate limit");
    return { allowed: true };
  }

  const limiter = getLimiter(endpointType);
  if (!limiter) {
    return { allowed: true };
  }

  // Get client IP from headers (Supabase sets x-forwarded-for)
  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "unknown";

  try {
    const { success, remaining, reset } = await limiter.limit(clientIP);

    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000);
      console.log(`[rate-limiter] Rate limit exceeded for ${clientIP} on ${endpointType} endpoint`);

      return {
        allowed: false,
        response: new Response(
          JSON.stringify({
            error: "Rate limit exceeded",
            retryAfter,
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": retryAfter.toString(),
              "X-RateLimit-Remaining": remaining.toString(),
              "X-RateLimit-Reset": reset.toString(),
            },
          }
        ),
      };
    }

    return { allowed: true };
  } catch (error) {
    // Fail open - don't block requests if rate limiting fails
    console.error("[rate-limiter] Error checking rate limit:", error);
    return { allowed: true };
  }
}
