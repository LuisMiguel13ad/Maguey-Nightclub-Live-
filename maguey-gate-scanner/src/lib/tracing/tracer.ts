/**
 * Tracer implementation for distributed tracing
 */

import { TraceContext, createRootContext, createChildContext, shouldSample, isSampled, generateTraceId, parseTraceparent, formatTraceparent } from './trace-context';
import { Span, SpanBuilder, SpanKind, SpanAttributes } from './span';
import { SpanExporter } from './exporters/console-exporter';

export interface TracerConfig {
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  sampleRate?: number;  // 0.0 to 1.0
  exporters?: SpanExporter[];
}

export interface SpanExporter {
  export(spans: Span[]): Promise<void>;
}

/**
 * Tracer class for creating and managing spans
 */
export class Tracer {
  private config: Required<Omit<TracerConfig, 'serviceVersion' | 'environment' | 'exporters'>> & {
    serviceVersion: string;
    environment: string;
    exporters: SpanExporter[];
  };
  private activeSpans: Map<string, SpanBuilder>;
  private completedSpans: Span[];
  private currentContext: TraceContext | null;
  private flushInterval: number | null;

  constructor(config: TracerConfig) {
    this.config = {
      serviceName: config.serviceName,
      serviceVersion: config.serviceVersion || '1.0.0',
      environment: config.environment || 'development',
      sampleRate: config.sampleRate ?? 1.0,
      exporters: config.exporters || [],
    };
    this.activeSpans = new Map();
    this.completedSpans = [];
    this.currentContext = null;
    this.flushInterval = null;

    // Auto-flush completed spans periodically (every 5 seconds)
    if (typeof window === 'undefined') {
      // Only in Node.js environment
      this.flushInterval = setInterval(() => {
        this.flush().catch(err => {
          console.error('[Tracer] Error flushing spans:', err);
        });
      }, 5000) as unknown as number;
    }
  }

  /**
   * Start a new span or continue from parent context
   */
  startSpan(
    name: string,
    options?: {
      kind?: SpanKind;
      parentContext?: TraceContext;
      attributes?: SpanAttributes;
    }
  ): SpanBuilder {
    let context: TraceContext;

    if (options?.parentContext) {
      // Create child context from parent
      context = createChildContext(options.parentContext);
    } else if (this.currentContext) {
      // Use current context as parent
      context = createChildContext(this.currentContext);
    } else {
      // Create new root context
      const traceId = generateTraceId();
      context = createRootContext(shouldSample(traceId, this.config.sampleRate));
    }

    // Check if we should sample this trace
    if (!isSampled(context) && !shouldSample(context.traceId, this.config.sampleRate)) {
      // Create a non-sampled context
      context = { ...context, traceFlags: 0x00 };
    }

    // Update current context
    this.currentContext = context;

    const builder = new SpanBuilder(name, context, options?.kind || 'internal');

    // Set default attributes
    builder.setAttributes({
      'service.name': this.config.serviceName,
      'service.version': this.config.serviceVersion,
      'service.environment': this.config.environment,
      ...options?.attributes,
    });

    // Store active span
    this.activeSpans.set(context.spanId, builder);

    return builder;
  }

  /**
   * Get current active trace context
   */
  getCurrentContext(): TraceContext | null {
    return this.currentContext;
  }

  /**
   * Run a function within a span context
   */
  async withSpan<T>(
    name: string,
    fn: (span: SpanBuilder) => Promise<T>,
    options?: { kind?: SpanKind; attributes?: SpanAttributes }
  ): Promise<T> {
    const span = this.startSpan(name, options);
    
    try {
      const result = await fn(span);
      span.setOk();
      return result;
    } catch (error) {
      span.setError(error instanceof Error ? error : String(error));
      throw error;
    } finally {
      const completedSpan = span.end();
      this.activeSpans.delete(completedSpan.spanId);
      this.completedSpans.push(completedSpan);
      
      // Auto-flush if we have many spans
      if (this.completedSpans.length >= 100) {
        await this.flush();
      }
    }
  }

  /**
   * Extract trace context from HTTP headers
   */
  extractContext(headers: Headers | Record<string, string>): TraceContext | null {
    let traceparent: string | null = null;

    if (headers instanceof Headers) {
      traceparent = headers.get('traceparent');
    } else {
      // Check both case-sensitive and lowercase
      traceparent = headers['traceparent'] || headers['Traceparent'] || headers['TRACEPARENT'] || null;
    }

    if (!traceparent) {
      return null;
    }

    // Use imported function directly
    return parseTraceparent(traceparent);
  }

  /**
   * Inject trace context into HTTP headers
   */
  injectContext(headers: Headers | Record<string, string>, context?: TraceContext): void {
    const ctx = context || this.currentContext;
    if (!ctx) {
      return;
    }

    const traceparent = formatTraceparent(ctx);
    if (headers instanceof Headers) {
      headers.set('traceparent', traceparent);
    } else {
      headers['traceparent'] = traceparent;
    }
  }

  /**
   * Flush completed spans to exporters
   */
  async flush(): Promise<void> {
    if (this.completedSpans.length === 0) {
      return;
    }

    const spansToExport = [...this.completedSpans];
    this.completedSpans = [];

    // Export to all configured exporters
    const exportPromises = this.config.exporters.map(exporter =>
      exporter.export(spansToExport).catch(err => {
        console.error('[Tracer] Error exporting spans:', err);
      })
    );

    await Promise.allSettled(exportPromises);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    
    // Flush remaining spans
    this.flush().catch(err => {
      console.error('[Tracer] Error flushing spans on destroy:', err);
    });
  }
}

// Global tracer instance
const env =
  (typeof import.meta !== 'undefined' && (import.meta as any).env) ??
  (typeof process !== 'undefined' ? process.env : {});

export const tracer = new Tracer({
  serviceName: 'maguey-gate-scanner',
  serviceVersion: '1.0.0',
  environment: env.MODE || env.NODE_ENV || 'development',
  sampleRate: env.MODE === 'production' ? 0.1 : 1.0, // Sample 10% in prod, 100% in dev
});
