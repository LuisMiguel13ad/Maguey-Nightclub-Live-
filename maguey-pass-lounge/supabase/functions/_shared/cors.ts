/**
 * Shared CORS configuration for Edge Functions
 *
 * Override with ALLOWED_ORIGINS env var (comma-separated) if needed.
 * When ALLOWED_ORIGINS is not set, production domains are used as default.
 * For local dev, set ALLOWED_ORIGINS=* to allow all origins.
 */

const PRODUCTION_ORIGINS = [
  "https://tickets.magueynightclub.com",
  "https://staff.magueynightclub.com",
  "https://magueynightclub.com",
  "https://www.magueynightclub.com",
];

export function getAllowedOrigin(requestOrigin: string | null): string {
  const allowedOriginsEnv = Deno.env.get("ALLOWED_ORIGINS");

  // If env var is explicitly set, use it (set ALLOWED_ORIGINS=* for dev)
  if (allowedOriginsEnv) {
    if (allowedOriginsEnv.trim() === "*") {
      return "*";
    }
    const allowedOrigins = allowedOriginsEnv.split(",").map((o) => o.trim());
    if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
      return requestOrigin;
    }
    return allowedOrigins[0] || PRODUCTION_ORIGINS[0];
  }

  // Default: production origins (secure by default)
  if (requestOrigin && PRODUCTION_ORIGINS.includes(requestOrigin)) {
    return requestOrigin;
  }
  return PRODUCTION_ORIGINS[0];
}

/**
 * Get CORS headers for a request, using dynamic origin checking.
 * @param req The incoming request (used for origin matching)
 * @param extraAllowedHeaders Optional additional headers to allow (comma-separated string)
 */
export function getCorsHeaders(req: Request, extraAllowedHeaders?: string) {
  const baseHeaders = "authorization, x-client-info, apikey, content-type";
  const allowHeaders = extraAllowedHeaders
    ? `${baseHeaders}, ${extraAllowedHeaders}`
    : baseHeaders;

  return {
    "Access-Control-Allow-Origin": getAllowedOrigin(req.headers.get("origin")),
    "Access-Control-Allow-Headers": allowHeaders,
  };
}

/**
 * Handle CORS preflight (OPTIONS) request.
 * Returns a Response if this is a preflight, or null if it should be handled normally.
 * @param req The incoming request
 * @param extraAllowedHeaders Optional additional headers to allow
 */
export function handleCorsPreFlight(req: Request, extraAllowedHeaders?: string): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req, extraAllowedHeaders) });
  }
  return null;
}
