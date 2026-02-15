import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

interface ServiceCheck {
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  message?: string;
}

interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    [service: string]: ServiceCheck;
  };
}

/**
 * Check database connectivity by querying the events table
 */
async function checkDatabase(supabase: ReturnType<typeof createClient>): Promise<ServiceCheck> {
  const start = Date.now();
  try {
    const { error } = await supabase.from('events').select('id').limit(1);
    if (error) throw error;
    return { status: 'healthy', responseTime: Date.now() - start };
  } catch (e) {
    return { status: 'unhealthy', message: (e as Error).message };
  }
}

/**
 * Check Stripe API reachability using the public healthcheck endpoint
 */
async function checkStripe(): Promise<ServiceCheck> {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch('https://api.stripe.com/healthcheck', {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response.ok
      ? { status: 'healthy', responseTime: Date.now() - start }
      : { status: 'unhealthy', message: `Status: ${response.status}` };
  } catch (e) {
    clearTimeout(timeout);
    const message = (e as Error).name === 'AbortError'
      ? 'Timeout after 5s'
      : (e as Error).message;
    return { status: 'unhealthy', message };
  }
}

/**
 * Check Resend API availability by listing domains
 */
async function checkResend(): Promise<ServiceCheck> {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    return { status: 'unhealthy', message: 'RESEND_API_KEY not configured' };
  }

  try {
    const response = await fetch('https://api.resend.com/domains', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response.ok
      ? { status: 'healthy', responseTime: Date.now() - start }
      : { status: 'unhealthy', message: `Status: ${response.status}` };
  } catch (e) {
    clearTimeout(timeout);
    const message = (e as Error).name === 'AbortError'
      ? 'Timeout after 5s'
      : (e as Error).message;
    return { status: 'unhealthy', message };
  }
}

serve(async (req) => {
  const corsResponse = handleCorsPreFlight(req);
  if (corsResponse) return corsResponse;

  // Initialize Supabase client with service role for DB access
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Run all checks in parallel for performance
  const [database, stripe, resend] = await Promise.all([
    checkDatabase(supabase),
    checkStripe(),
    checkResend(),
  ]);

  // Edge functions self-check (if we got here, we're running)
  const checks: HealthCheckResponse['checks'] = {
    database,
    stripe,
    resend,
    edge_functions: { status: 'healthy' },
  };

  // Determine overall status
  const checkValues = Object.values(checks);
  const allHealthy = checkValues.every(c => c.status === 'healthy');
  const anyUnhealthy = checkValues.some(c => c.status === 'unhealthy');

  const overallStatus: HealthCheckResponse['status'] = allHealthy
    ? 'healthy'
    : anyUnhealthy
      ? 'unhealthy'
      : 'degraded';

  const response: HealthCheckResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
  };

  // Return 200 for healthy, 503 for degraded/unhealthy
  const httpStatus = allHealthy ? 200 : 503;

  return new Response(JSON.stringify(response, null, 2), {
    status: httpStatus,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
});
