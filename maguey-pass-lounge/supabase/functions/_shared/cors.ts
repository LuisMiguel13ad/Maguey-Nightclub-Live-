/**
 * Shared CORS configuration for Edge Functions
 *
 * In production, set the ALLOWED_ORIGINS env var (comma-separated) to
 * restrict cross-origin requests to known domains.
 *
 * Example: ALLOWED_ORIGINS=https://tickets.maguey.club,https://www.magueynightclub.com
 *
 * When ALLOWED_ORIGINS is not set, all origins are allowed (dev mode).
 */

export function getAllowedOrigin(requestOrigin: string | null): string {
  const allowedOriginsEnv = Deno.env.get("ALLOWED_ORIGINS");

  // If no allowed origins configured, allow all (dev mode)
  if (!allowedOriginsEnv) {
    return "*";
  }

  // Parse allowed origins (comma-separated)
  const allowedOrigins = allowedOriginsEnv.split(",").map((o) => o.trim());

  // Check if request origin is in allowed list
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  // Return first allowed origin as default
  return allowedOrigins[0] || "*";
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
