/**
 * Health Check API
 * 
 * Provides health check utilities for monitoring system status.
 * Can be used with:
 * - Supabase Edge Functions
 * - Express/Node.js backends
 * - Vercel/Netlify serverless functions
 * - Client-side health checks
 * 
 * @example
 * // In a Supabase Edge Function:
 * import { healthCheck, formatHealthResponse } from './health';
 * 
 * serve(async (req) => {
 *   const health = await healthCheck();
 *   return new Response(JSON.stringify(formatHealthResponse(health)), {
 *     status: health.status === 'healthy' ? 200 : 503,
 *     headers: { 'Content-Type': 'application/json' },
 *   });
 * });
 */

import { supabase } from '../lib/supabase';
import { metrics, getDashboardMetrics } from '../lib/monitoring';
import { alertManager } from '../lib/alerts';
import { createLogger } from '../lib/logger';

// ============================================
// TYPES
// ============================================

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  latencyMs?: number;
  message?: string;
  lastChecked: Date;
}

export interface HealthCheckResult {
  status: HealthStatus;
  version: string;
  timestamp: Date;
  uptime: number; // seconds
  components: ComponentHealth[];
  metrics?: {
    ordersCreated: number;
    ordersFailed: number;
    ticketsSold: number;
    avgOrderDuration: number;
    errorRate: number;
  };
  alerts?: {
    active: number;
    critical: number;
  };
}

export interface HealthCheckOptions {
  includeMetrics?: boolean;
  includeAlerts?: boolean;
  timeout?: number; // ms
}

// ============================================
// CONSTANTS
// ============================================

const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';
const startTime = Date.now();
const logger = createLogger({ module: 'health' });

// ============================================
// COMPONENT HEALTH CHECKS
// ============================================

/**
 * Check Supabase database connectivity
 */
async function checkDatabase(timeout: number): Promise<ComponentHealth> {
  const start = performance.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    // Simple query to check connectivity
    const { error } = await supabase
      .from('events')
      .select('id')
      .limit(1)
      .single();
    
    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - start);
    
    // PGRST116 means no rows found, which is fine for a health check
    if (error && error.code !== 'PGRST116') {
      return {
        name: 'database',
        status: 'unhealthy',
        latencyMs,
        message: error.message,
        lastChecked: new Date(),
      };
    }
    
    // Consider degraded if latency is too high
    const status: HealthStatus = latencyMs > 2000 ? 'degraded' : 'healthy';
    
    return {
      name: 'database',
      status,
      latencyMs,
      message: status === 'degraded' ? 'High latency detected' : undefined,
      lastChecked: new Date(),
    };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - start);
    
    return {
      name: 'database',
      status: 'unhealthy',
      latencyMs,
      message: error instanceof Error ? error.message : 'Unknown error',
      lastChecked: new Date(),
    };
  }
}

/**
 * Check Supabase Auth service
 */
async function checkAuth(timeout: number): Promise<ComponentHealth> {
  const start = performance.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    // Get session to check auth is working
    const { error } = await supabase.auth.getSession();
    
    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - start);
    
    if (error) {
      return {
        name: 'auth',
        status: 'degraded',
        latencyMs,
        message: error.message,
        lastChecked: new Date(),
      };
    }
    
    const status: HealthStatus = latencyMs > 2000 ? 'degraded' : 'healthy';
    
    return {
      name: 'auth',
      status,
      latencyMs,
      message: status === 'degraded' ? 'High latency detected' : undefined,
      lastChecked: new Date(),
    };
  } catch (error) {
    const latencyMs = Math.round(performance.now() - start);
    
    return {
      name: 'auth',
      status: 'unhealthy',
      latencyMs,
      message: error instanceof Error ? error.message : 'Unknown error',
      lastChecked: new Date(),
    };
  }
}

/**
 * Check Stripe connectivity (if configured)
 */
async function checkStripe(timeout: number): Promise<ComponentHealth> {
  const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  
  if (!stripeKey) {
    return {
      name: 'stripe',
      status: 'degraded',
      message: 'Stripe not configured',
      lastChecked: new Date(),
    };
  }
  
  // Stripe.js health is implicit - if the key is set, we assume it's working
  // In a backend context, you could ping the Stripe API
  return {
    name: 'stripe',
    status: 'healthy',
    message: 'Stripe configured',
    lastChecked: new Date(),
  };
}

/**
 * Check email service - emails are now sent server-side via email_queue
 */
function checkEmail(): ComponentHealth {
  const fromAddress = import.meta.env.VITE_EMAIL_FROM_ADDRESS;

  return {
    name: 'email',
    status: fromAddress ? 'healthy' : 'degraded',
    message: fromAddress
      ? 'Email service configured (server-side via email_queue)'
      : 'Email from address not configured',
    lastChecked: new Date(),
  };
}

/**
 * Check internal metrics system
 */
function checkMetrics(): ComponentHealth {
  try {
    const allMetrics = metrics.getAll();
    
    return {
      name: 'metrics',
      status: 'healthy',
      message: `${Object.keys(allMetrics).length} metrics tracked`,
      lastChecked: new Date(),
    };
  } catch (error) {
    return {
      name: 'metrics',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown error',
      lastChecked: new Date(),
    };
  }
}

// ============================================
// MAIN HEALTH CHECK
// ============================================

/**
 * Perform a comprehensive health check
 */
export async function healthCheck(
  options: HealthCheckOptions = {}
): Promise<HealthCheckResult> {
  const {
    includeMetrics = true,
    includeAlerts = true,
    timeout = 5000,
  } = options;

  logger.debug('Starting health check');
  
  // Run all checks in parallel
  const [database, auth, stripe] = await Promise.all([
    checkDatabase(timeout),
    checkAuth(timeout),
    checkStripe(timeout),
  ]);
  
  // Synchronous checks
  const email = checkEmail();
  const metricsHealth = checkMetrics();
  
  const components = [database, auth, stripe, email, metricsHealth];
  
  // Determine overall status
  const hasUnhealthy = components.some(c => c.status === 'unhealthy');
  const hasDegraded = components.some(c => c.status === 'degraded');
  
  let overallStatus: HealthStatus = 'healthy';
  if (hasUnhealthy) {
    overallStatus = 'unhealthy';
  } else if (hasDegraded) {
    overallStatus = 'degraded';
  }
  
  const result: HealthCheckResult = {
    status: overallStatus,
    version: APP_VERSION,
    timestamp: new Date(),
    uptime: Math.round((Date.now() - startTime) / 1000),
    components,
  };
  
  // Include metrics if requested
  if (includeMetrics) {
    const dashboardMetrics = getDashboardMetrics();
    result.metrics = {
      ordersCreated: dashboardMetrics.ordersCreated,
      ordersFailed: dashboardMetrics.ordersFailed,
      ticketsSold: dashboardMetrics.ticketsSold,
      avgOrderDuration: Math.round(dashboardMetrics.avgOrderDuration),
      errorRate: Math.round(dashboardMetrics.errorRate * 100) / 100,
    };
  }
  
  // Include alerts if requested
  if (includeAlerts) {
    const activeAlerts = alertManager.getActiveAlerts();
    result.alerts = {
      active: activeAlerts.length,
      critical: activeAlerts.filter(a => 
        a.severity === 'critical' || a.severity === 'emergency'
      ).length,
    };
  }
  
  logger.debug('Health check completed', { status: overallStatus });
  
  return result;
}

/**
 * Simple liveness check - just confirms the app is running
 */
export function livenessCheck(): { status: 'ok'; timestamp: Date } {
  return {
    status: 'ok',
    timestamp: new Date(),
  };
}

/**
 * Readiness check - confirms the app can handle requests
 */
export async function readinessCheck(): Promise<{
  ready: boolean;
  reason?: string;
}> {
  try {
    // Check database connectivity as the main readiness indicator
    const dbHealth = await checkDatabase(3000);
    
    if (dbHealth.status === 'unhealthy') {
      return {
        ready: false,
        reason: `Database unhealthy: ${dbHealth.message}`,
      };
    }
    
    return { ready: true };
  } catch (error) {
    return {
      ready: false,
      reason: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// RESPONSE FORMATTERS
// ============================================

/**
 * Format health check result for API response
 */
export function formatHealthResponse(health: HealthCheckResult): {
  status: HealthStatus;
  version: string;
  timestamp: string;
  uptime: number;
  components: Array<{
    name: string;
    status: HealthStatus;
    latencyMs?: number;
    message?: string;
  }>;
  metrics?: HealthCheckResult['metrics'];
  alerts?: HealthCheckResult['alerts'];
} {
  return {
    status: health.status,
    version: health.version,
    timestamp: health.timestamp.toISOString(),
    uptime: health.uptime,
    components: health.components.map(c => ({
      name: c.name,
      status: c.status,
      latencyMs: c.latencyMs,
      message: c.message,
    })),
    metrics: health.metrics,
    alerts: health.alerts,
  };
}

/**
 * Get HTTP status code for health status
 */
export function getHealthStatusCode(status: HealthStatus): number {
  switch (status) {
    case 'healthy':
      return 200;
    case 'degraded':
      return 200; // Still operational, just not optimal
    case 'unhealthy':
      return 503;
    default:
      return 500;
  }
}

// ============================================
// CLIENT-SIDE HEALTH MONITORING
// ============================================

/**
 * Client-side health monitor that periodically checks system health
 */
export class HealthMonitor {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastHealth: HealthCheckResult | null = null;
  private listeners: Set<(health: HealthCheckResult) => void> = new Set();
  private logger = createLogger({ module: 'health-monitor' });

  /**
   * Start monitoring health at the specified interval
   */
  start(intervalMs: number = 30000): void {
    if (this.intervalId) {
      this.stop();
    }

    // Run immediately
    this.check();

    // Then run at interval
    this.intervalId = setInterval(() => {
      this.check();
    }, intervalMs);

    this.logger.info(`Health monitoring started (interval: ${intervalMs}ms)`);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logger.info('Health monitoring stopped');
    }
  }

  /**
   * Run a health check
   */
  async check(): Promise<HealthCheckResult> {
    try {
      const health = await healthCheck();
      this.lastHealth = health;
      this.notifyListeners(health);
      return health;
    } catch (error) {
      this.logger.error('Health check failed', error);
      throw error;
    }
  }

  /**
   * Get the last health check result
   */
  getLastHealth(): HealthCheckResult | null {
    return this.lastHealth;
  }

  /**
   * Subscribe to health updates
   */
  subscribe(listener: (health: HealthCheckResult) => void): () => void {
    this.listeners.add(listener);
    
    // Immediately call with last health if available
    if (this.lastHealth) {
      listener(this.lastHealth);
    }

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(health: HealthCheckResult): void {
    for (const listener of this.listeners) {
      try {
        listener(health);
      } catch (error) {
        this.logger.error('Health listener error', error);
      }
    }
  }
}

// Singleton instance
export const healthMonitor = new HealthMonitor();

// ============================================
// EDGE FUNCTION HANDLER EXAMPLE
// ============================================

/**
 * Example handler for Supabase Edge Function or similar serverless platform
 * 
 * Usage in supabase/functions/health/index.ts:
 * 
 * import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
 * import { createHealthHandler } from './health';
 * 
 * serve(createHealthHandler());
 */
export function createHealthHandler() {
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Only allow GET requests
    if (req.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      // Liveness check
      if (path.endsWith('/live') || path.endsWith('/liveness')) {
        const result = livenessCheck();
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Readiness check
      if (path.endsWith('/ready') || path.endsWith('/readiness')) {
        const result = await readinessCheck();
        return new Response(JSON.stringify(result), {
          status: result.ready ? 200 : 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Full health check (default)
      const includeMetrics = url.searchParams.get('metrics') !== 'false';
      const includeAlerts = url.searchParams.get('alerts') !== 'false';
      
      const health = await healthCheck({ includeMetrics, includeAlerts });
      const response = formatHealthResponse(health);
      
      return new Response(JSON.stringify(response, null, 2), {
        status: getHealthStatusCode(health.status),
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    } catch (error) {
      logger.error('Health endpoint error', error);
      
      return new Response(
        JSON.stringify({
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  };
}

// ============================================
// PROMETHEUS METRICS ENDPOINT
// ============================================

/**
 * Create a Prometheus metrics endpoint handler
 */
export function createMetricsHandler() {
  return async (_req: Request): Promise<Response> => {
    try {
      const prometheusOutput = metrics.toPrometheusFormat();
      
      return new Response(prometheusOutput, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        },
      });
    } catch (error) {
      logger.error('Metrics endpoint error', error);
      
      return new Response('# Error generating metrics', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
  };
}
