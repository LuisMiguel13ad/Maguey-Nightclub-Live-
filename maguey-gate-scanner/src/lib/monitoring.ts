/**
 * Metrics and Monitoring System
 *
 * Simple in-memory metrics collection for the ticketing system.
 * Can be replaced with Prometheus, DataDog, or other providers later.
 *
 * @example
 * import { metrics, trackOrderCreation, trackTicketScan } from './monitoring';
 *
 * // Increment a counter
 * metrics.increment('orders.created');
 *
 * // Track timing
 * metrics.timing('order.creation.duration', 150);
 *
 * // Set a gauge
 * metrics.gauge('active_users', 42);
 */

import { createLogger } from './logger';

// ============================================
// TYPES
// ============================================

export interface MetricTags {
  [key: string]: string;
}

export interface MetricEntry {
  name: string;
  value: number;
  timestamp: number;
  tags?: MetricTags;
}

export interface HistogramData {
  count: number;
  sum: number;
  min: number;
  max: number;
  buckets: Record<number, number>; // bucket threshold -> count
}

export interface CounterData {
  value: number;
  tags: Map<string, number>; // serialized tags -> value
}

export interface GaugeData {
  value: number;
  tags: Map<string, number>;
}

// Histogram bucket boundaries (in ms for timing)
const DEFAULT_BUCKETS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

// ============================================
// METRICS REGISTRY
// ============================================

class MetricsRegistry {
  private counters: Map<string, CounterData> = new Map();
  private gauges: Map<string, GaugeData> = new Map();
  private histograms: Map<string, HistogramData> = new Map();
  private recentMetrics: MetricEntry[] = [];
  private maxRecentMetrics = 1000;
  private logger = createLogger({ module: 'metrics' });

  // ============================================
  // COUNTERS
  // ============================================

  /**
   * Increment a counter by the given value (default 1)
   */
  increment(name: string, value: number = 1, tags?: MetricTags): void {
    const tagKey = this.serializeTags(tags);

    if (!this.counters.has(name)) {
      this.counters.set(name, { value: 0, tags: new Map() });
    }

    const counter = this.counters.get(name)!;
    counter.value += value;

    // Track by tags too
    const currentTagValue = counter.tags.get(tagKey) || 0;
    counter.tags.set(tagKey, currentTagValue + value);

    this.addRecentMetric(name, value, tags);
    this.logger.debug(`Counter incremented: ${name}`, { value, tags });
  }

  /**
   * Get a counter's current value
   */
  getCounter(name: string, tags?: MetricTags): number {
    const counter = this.counters.get(name);
    if (!counter) return 0;

    if (tags) {
      const tagKey = this.serializeTags(tags);
      return counter.tags.get(tagKey) || 0;
    }

    return counter.value;
  }

  // ============================================
  // GAUGES
  // ============================================

  /**
   * Set a gauge to a specific value
   */
  gauge(name: string, value: number, tags?: MetricTags): void {
    const tagKey = this.serializeTags(tags);

    if (!this.gauges.has(name)) {
      this.gauges.set(name, { value: 0, tags: new Map() });
    }

    const gauge = this.gauges.get(name)!;
    gauge.value = value;
    gauge.tags.set(tagKey, value);

    this.addRecentMetric(name, value, tags);
    this.logger.debug(`Gauge set: ${name}`, { value, tags });
  }

  /**
   * Get a gauge's current value
   */
  getGauge(name: string, tags?: MetricTags): number {
    const gauge = this.gauges.get(name);
    if (!gauge) return 0;

    if (tags) {
      const tagKey = this.serializeTags(tags);
      return gauge.tags.get(tagKey) || 0;
    }

    return gauge.value;
  }

  // ============================================
  // HISTOGRAMS (TIMING)
  // ============================================

  /**
   * Record a timing/duration value
   */
  timing(name: string, durationMs: number, tags?: MetricTags): void {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, {
        count: 0,
        sum: 0,
        min: Infinity,
        max: -Infinity,
        buckets: DEFAULT_BUCKETS.reduce((acc, b) => ({ ...acc, [b]: 0 }), {}),
      });
    }

    const histogram = this.histograms.get(name)!;
    histogram.count++;
    histogram.sum += durationMs;
    histogram.min = Math.min(histogram.min, durationMs);
    histogram.max = Math.max(histogram.max, durationMs);

    // Update buckets
    for (const bucket of DEFAULT_BUCKETS) {
      if (durationMs <= bucket) {
        histogram.buckets[bucket]++;
      }
    }

    this.addRecentMetric(name, durationMs, tags);
    this.logger.debug(`Timing recorded: ${name}`, { durationMs, tags });
  }

  /**
   * Get histogram statistics
   */
  getHistogram(name: string): HistogramData | null {
    return this.histograms.get(name) || null;
  }

  /**
   * Get average duration for a histogram
   */
  getAverageTiming(name: string): number {
    const histogram = this.histograms.get(name);
    if (!histogram || histogram.count === 0) return 0;
    return histogram.sum / histogram.count;
  }

  /**
   * Get percentile value (approximate using buckets)
   */
  getPercentile(name: string, percentile: number): number {
    const histogram = this.histograms.get(name);
    if (!histogram || histogram.count === 0) return 0;

    const targetCount = histogram.count * (percentile / 100);
    let cumulative = 0;

    const sortedBuckets = Object.entries(histogram.buckets)
      .map(([k, v]) => [parseInt(k), v] as [number, number])
      .sort((a, b) => a[0] - b[0]);

    for (const [bucket, count] of sortedBuckets) {
      cumulative += count;
      if (cumulative >= targetCount) {
        return bucket;
      }
    }

    return histogram.max;
  }

  // ============================================
  // AGGREGATION
  // ============================================

  /**
   * Get all metrics as a flat record
   */
  getAll(): Record<string, number> {
    const result: Record<string, number> = {};

    // Add counters
    for (const [name, data] of this.counters) {
      result[`counter.${name}`] = data.value;
    }

    // Add gauges
    for (const [name, data] of this.gauges) {
      result[`gauge.${name}`] = data.value;
    }

    // Add histogram aggregates
    for (const [name, data] of this.histograms) {
      result[`histogram.${name}.count`] = data.count;
      result[`histogram.${name}.sum`] = data.sum;
      result[`histogram.${name}.avg`] = data.count > 0 ? data.sum / data.count : 0;
      result[`histogram.${name}.min`] = data.min === Infinity ? 0 : data.min;
      result[`histogram.${name}.max`] = data.max === -Infinity ? 0 : data.max;
      result[`histogram.${name}.p50`] = this.getPercentile(name, 50);
      result[`histogram.${name}.p95`] = this.getPercentile(name, 95);
      result[`histogram.${name}.p99`] = this.getPercentile(name, 99);
    }

    return result;
  }

  /**
   * Get recent metrics for debugging
   */
  getRecentMetrics(limit: number = 100): MetricEntry[] {
    return this.recentMetrics.slice(-limit);
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.recentMetrics = [];
    this.logger.info('Metrics reset');
  }

  /**
   * Export metrics in Prometheus format
   */
  toPrometheusFormat(): string {
    const lines: string[] = [];

    // Counters
    for (const [name, data] of this.counters) {
      const metricName = this.toPrometheusName(name);
      lines.push(`# TYPE ${metricName} counter`);
      lines.push(`${metricName} ${data.value}`);
    }

    // Gauges
    for (const [name, data] of this.gauges) {
      const metricName = this.toPrometheusName(name);
      lines.push(`# TYPE ${metricName} gauge`);
      lines.push(`${metricName} ${data.value}`);
    }

    // Histograms
    for (const [name, data] of this.histograms) {
      const metricName = this.toPrometheusName(name);
      lines.push(`# TYPE ${metricName} histogram`);

      // Buckets
      for (const [bucket, count] of Object.entries(data.buckets)) {
        lines.push(`${metricName}_bucket{le="${bucket}"} ${count}`);
      }
      lines.push(`${metricName}_bucket{le="+Inf"} ${data.count}`);
      lines.push(`${metricName}_sum ${data.sum}`);
      lines.push(`${metricName}_count ${data.count}`);
    }

    return lines.join('\n');
  }

  // ============================================
  // UTILITIES
  // ============================================

  private serializeTags(tags?: MetricTags): string {
    if (!tags || Object.keys(tags).length === 0) return '';
    return Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(',');
  }

  private addRecentMetric(name: string, value: number, tags?: MetricTags): void {
    this.recentMetrics.push({
      name,
      value,
      timestamp: Date.now(),
      tags,
    });

    // Trim to max size
    if (this.recentMetrics.length > this.maxRecentMetrics) {
      this.recentMetrics = this.recentMetrics.slice(-this.maxRecentMetrics);
    }
  }

  private toPrometheusName(name: string): string {
    return name.replace(/[.-]/g, '_').toLowerCase();
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

export const metrics = new MetricsRegistry();

// ============================================
// BUSINESS METRIC HELPERS
// ============================================

/**
 * Track order creation with timing and success/failure
 */
export function trackOrderCreation(
  orderId: string,
  duration: number,
  success: boolean,
  metadata?: {
    eventId?: string;
    ticketCount?: number;
    total?: number;
  }
): void {
  const tags: MetricTags = {
    success: success.toString(),
    ...(metadata?.eventId && { event_id: metadata.eventId }),
  };

  // Track timing
  metrics.timing('order.creation.duration', duration, tags);

  // Track counters
  if (success) {
    metrics.increment('orders.created', 1, tags);

    if (metadata?.ticketCount) {
      metrics.increment('tickets.sold', metadata.ticketCount, tags);
    }

    if (metadata?.total) {
      metrics.increment('revenue.cents', Math.round(metadata.total * 100), tags);
    }
  } else {
    metrics.increment('orders.failed', 1, tags);
  }
}

/**
 * Track ticket scanning
 */
export function trackTicketScan(
  ticketId: string,
  duration: number,
  result: 'valid' | 'invalid' | 'already_scanned' | 'error',
  metadata?: {
    eventId?: string;
    scannerId?: string;
  }
): void {
  const tags: MetricTags = {
    result,
    ...(metadata?.eventId && { event_id: metadata.eventId }),
    ...(metadata?.scannerId && { scanner_id: metadata.scannerId }),
  };

  metrics.timing('ticket.scan.duration', duration, tags);
  metrics.increment(`ticket.scans.${result}`, 1, tags);
  metrics.increment('ticket.scans.total', 1, tags);
}

/**
 * Track database query timing
 */
export function trackDbQuery(
  operation: string,
  duration: number,
  success: boolean,
  table?: string
): void {
  const tags: MetricTags = {
    operation,
    success: success.toString(),
    ...(table && { table }),
  };

  metrics.timing('db.query.duration', duration, tags);

  if (!success) {
    metrics.increment('db.query.errors', 1, tags);
  }
}

/**
 * Track API request timing
 */
export function trackApiRequest(
  path: string,
  method: string,
  duration: number,
  statusCode: number
): void {
  const tags: MetricTags = {
    path,
    method,
    status: statusCode.toString(),
    status_class: `${Math.floor(statusCode / 100)}xx`,
  };

  metrics.timing('api.request.duration', duration, tags);
  metrics.increment('api.requests.total', 1, tags);

  if (statusCode >= 400) {
    metrics.increment('api.requests.errors', 1, tags);
  }
}

/**
 * Track payment processing
 */
export function trackPayment(
  orderId: string,
  duration: number,
  success: boolean,
  metadata?: {
    provider?: string;
    amount?: number;
    currency?: string;
  }
): void {
  const tags: MetricTags = {
    success: success.toString(),
    ...(metadata?.provider && { provider: metadata.provider }),
    ...(metadata?.currency && { currency: metadata.currency }),
  };

  metrics.timing('payment.processing.duration', duration, tags);

  if (success) {
    metrics.increment('payments.successful', 1, tags);
    if (metadata?.amount) {
      metrics.increment('payments.amount', Math.round(metadata.amount * 100), tags);
    }
  } else {
    metrics.increment('payments.failed', 1, tags);
  }
}

/**
 * Track email sending
 */
export function trackEmailSent(
  type: 'ticket' | 'confirmation' | 'reminder' | 'marketing',
  success: boolean,
  duration: number
): void {
  const tags: MetricTags = {
    type,
    success: success.toString(),
  };

  metrics.timing('email.send.duration', duration, tags);
  metrics.increment(`emails.${success ? 'sent' : 'failed'}`, 1, tags);
}

/**
 * Set active users gauge
 */
export function setActiveUsers(count: number): void {
  metrics.gauge('active_users', count);
}

/**
 * Set error rate gauge
 */
export function setErrorRate(rate: number): void {
  metrics.gauge('error_rate', rate);
}

/**
 * Set queue depth gauge
 */
export function setQueueDepth(queueName: string, depth: number): void {
  metrics.gauge('queue.depth', depth, { queue: queueName });
}

// ============================================
// TIMING UTILITY
// ============================================

/**
 * Start a timer and return a function to stop it
 * @returns A function that returns the elapsed time in ms
 */
export function startTimer(): () => number {
  const start = performance.now();
  return () => Math.round(performance.now() - start);
}

/**
 * Wrap an async function with automatic timing
 */
export function withTiming<T>(
  metricName: string,
  fn: () => Promise<T>,
  tags?: MetricTags
): Promise<T> {
  const stop = startTimer();
  return fn().finally(() => {
    metrics.timing(metricName, stop(), tags);
  });
}

/**
 * Create a timed wrapper for any async function
 */
export function createTimedFunction<TArgs extends unknown[], TResult>(
  metricName: string,
  fn: (...args: TArgs) => Promise<TResult>,
  tagExtractor?: (...args: TArgs) => MetricTags
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const tags = tagExtractor ? tagExtractor(...args) : undefined;
    const stop = startTimer();
    try {
      const result = await fn(...args);
      metrics.timing(metricName, stop(), { ...tags, success: 'true' });
      return result;
    } catch (error) {
      metrics.timing(metricName, stop(), { ...tags, success: 'false' });
      throw error;
    }
  };
}

// ============================================
// COMPUTED METRICS
// ============================================

/**
 * Calculate error rate from recent metrics
 */
export function calculateErrorRate(): number {
  const successCount = metrics.getCounter('orders.created');
  const failureCount = metrics.getCounter('orders.failed');
  const total = successCount + failureCount;

  if (total === 0) return 0;
  return (failureCount / total) * 100;
}

/**
 * Calculate scan success rate
 */
export function calculateScanSuccessRate(): number {
  const valid = metrics.getCounter('ticket.scans.valid');
  const invalid = metrics.getCounter('ticket.scans.invalid');
  const alreadyScanned = metrics.getCounter('ticket.scans.already_scanned');
  const errors = metrics.getCounter('ticket.scans.error');

  const total = valid + invalid + alreadyScanned + errors;
  if (total === 0) return 100;

  return (valid / total) * 100;
}

/**
 * Get dashboard metrics summary
 */
export function getDashboardMetrics(): {
  ordersCreated: number;
  ordersFailed: number;
  ticketsSold: number;
  revenueInCents: number;
  avgOrderDuration: number;
  errorRate: number;
  scanSuccessRate: number;
  ticketScansTotal: number;
} {
  return {
    ordersCreated: metrics.getCounter('orders.created'),
    ordersFailed: metrics.getCounter('orders.failed'),
    ticketsSold: metrics.getCounter('tickets.sold'),
    revenueInCents: metrics.getCounter('revenue.cents'),
    avgOrderDuration: metrics.getAverageTiming('order.creation.duration'),
    errorRate: calculateErrorRate(),
    scanSuccessRate: calculateScanSuccessRate(),
    ticketScansTotal: metrics.getCounter('ticket.scans.total'),
  };
}
