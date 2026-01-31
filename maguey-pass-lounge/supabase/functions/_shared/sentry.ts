/**
 * Sentry Integration for Supabase Edge Functions
 *
 * Provides error monitoring with proper flush handling for edge runtime.
 * Must call initSentry() at module level before serve().
 *
 * Usage:
 *   import { initSentry, captureError, setRequestContext } from "../_shared/sentry.ts";
 *   initSentry();
 *   serve(async (req) => {
 *     const requestId = crypto.randomUUID();
 *     setRequestContext(req, requestId);
 *     try { ... } catch (error) {
 *       await captureError(error, { context: "additional info" });
 *       return new Response("Error", { status: 500 });
 *     }
 *   });
 */

import * as Sentry from "https://deno.land/x/sentry/index.mjs";

let initialized = false;

/**
 * Initialize Sentry for edge functions
 * Call at module level, before serve()
 */
export function initSentry(): void {
  if (initialized) return;

  const dsn = Deno.env.get("SENTRY_DSN");
  if (!dsn) {
    console.log("[Sentry] No DSN configured, skipping initialization");
    return;
  }

  Sentry.init({
    dsn,
    // CRITICAL: Disable default integrations to prevent scope contamination
    // across concurrent requests in edge runtime
    defaultIntegrations: false,
    tracesSampleRate: 0.1,
    environment: Deno.env.get("ENVIRONMENT") || "production",
  });

  initialized = true;
  console.log("[Sentry] Initialized");
}

/**
 * Set request context for error correlation
 * Call at the start of each request handler
 */
export function setRequestContext(req: Request, requestId: string): void {
  const dsn = Deno.env.get("SENTRY_DSN");
  if (!dsn) return;

  Sentry.setTag("region", Deno.env.get("SB_REGION") || "unknown");
  Sentry.setTag("execution_id", Deno.env.get("SB_EXECUTION_ID") || "unknown");
  Sentry.setTag("request_id", requestId);
  Sentry.setTag("url", new URL(req.url).pathname);
}

/**
 * Set user context for error attribution
 */
export function setUserContext(userId?: string, email?: string): void {
  const dsn = Deno.env.get("SENTRY_DSN");
  if (!dsn) return;

  if (userId || email) {
    Sentry.setUser({ id: userId, email });
  }
}

/**
 * Capture an error to Sentry with context
 * IMPORTANT: Always await this function before returning response
 * to ensure Sentry has time to flush the error
 */
export async function captureError(
  error: Error,
  context?: Record<string, unknown>
): Promise<void> {
  const dsn = Deno.env.get("SENTRY_DSN");
  if (!dsn) {
    console.error("[Sentry] Error not captured (no DSN):", error.message);
    return;
  }

  Sentry.captureException(error, { extra: context });

  // IMPORTANT: Flush before response ends to ensure error is sent
  // Edge functions terminate immediately after response
  await Sentry.flush(2000);
}

/**
 * Capture a message to Sentry
 */
export async function captureMessage(
  message: string,
  level: "info" | "warning" | "error" = "info",
  context?: Record<string, unknown>
): Promise<void> {
  const dsn = Deno.env.get("SENTRY_DSN");
  if (!dsn) return;

  Sentry.captureMessage(message, {
    level,
    extra: context,
  });

  await Sentry.flush(2000);
}

// Export Sentry for direct access if needed
export { Sentry };
