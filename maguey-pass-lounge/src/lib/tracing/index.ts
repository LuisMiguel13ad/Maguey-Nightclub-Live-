/**
 * Distributed Tracing Module
 * 
 * Re-exports all tracing utilities and provides convenience functions.
 */

export * from './trace-context';
export * from './span';
export * from './tracer';
export * from './exporters/console-exporter';
export * from './exporters/supabase-exporter';

import { tracer } from './tracer';
import { SpanBuilder, SpanAttributes } from './span';
import { TraceContext } from './trace-context';

/**
 * Trace an async function with automatic span management
 * 
 * @param name - Name of the span
 * @param fn - Async function to trace
 * @param attributes - Optional span attributes
 * @returns Result of the function
 */
export async function traceAsync<T>(
  name: string,
  fn: () => Promise<T>,
  attributes?: SpanAttributes
): Promise<T> {
  return tracer.withSpan(name, async (span) => {
    if (attributes) {
      span.setAttributes(attributes);
    }
    return await fn();
  });
}

/**
 * Trace a database query
 * 
 * @param name - Name of the query span
 * @param queryFn - Function that executes the query
 * @returns Result of the query
 */
export async function traceQuery<T>(
  name: string,
  queryFn: () => Promise<T>
): Promise<T> {
  return tracer.withSpan(name, async (span) => {
    span.setAttribute('db.system', 'postgresql');
    span.setAttribute('db.operation', name);
    
    const startTime = Date.now();
    try {
      const result = await queryFn();
      const duration = Date.now() - startTime;
      span.setAttribute('db.duration_ms', duration);
      span.setOk();
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      span.setAttribute('db.duration_ms', duration);
      span.setError(error instanceof Error ? error : String(error));
      throw error;
    }
  }, { kind: 'client' });
}

/**
 * Trace an HTTP request
 * 
 * @param name - Name of the request span
 * @param requestFn - Function that makes the HTTP request
 * @param url - Request URL
 * @param method - HTTP method
 * @returns Result of the request
 */
export async function traceHttpRequest<T>(
  name: string,
  requestFn: () => Promise<Response>,
  url: string,
  method: string = 'GET'
): Promise<T> {
  return tracer.withSpan(name, async (span) => {
    span.setAttributes({
      'http.method': method,
      'http.url': url,
    });
    
    const startTime = Date.now();
    try {
      const response = await requestFn();
      const duration = Date.now() - startTime;
      
      span.setAttributes({
        'http.status_code': response.status,
        'http.duration_ms': duration,
      });
      
      if (response.status >= 400) {
        span.setStatus('error', `HTTP ${response.status}`);
      } else {
        span.setOk();
      }
      
      return await response.json() as T;
    } catch (error) {
      const duration = Date.now() - startTime;
      span.setAttribute('http.duration_ms', duration);
      span.setError(error instanceof Error ? error : String(error));
      throw error;
    }
  }, { kind: 'client' });
}

/**
 * Extract trace context from request headers
 */
export function extractTraceContext(headers: Headers | Record<string, string>): TraceContext | null {
  return tracer.extractContext(headers);
}

/**
 * Inject trace context into request headers
 */
export function injectTraceContext(headers: Headers | Record<string, string>, context?: TraceContext): void {
  tracer.injectContext(headers, context);
}

/**
 * Get current trace context
 */
export function getCurrentTraceContext(): TraceContext | null {
  return tracer.getCurrentContext();
}

/**
 * Start a new span manually
 */
export function startSpan(
  name: string,
  options?: {
    kind?: 'client' | 'server' | 'producer' | 'consumer' | 'internal';
    attributes?: SpanAttributes;
  }
): SpanBuilder {
  return tracer.startSpan(name, options);
}

/**
 * Decorator for tracing class methods (experimental)
 * 
 * Usage:
 * class MyService {
 *   @traced('my-operation')
 *   async myMethod() { ... }
 * }
 */
export function traced(spanName?: string) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const name = spanName || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function(...args: any[]) {
      return tracer.withSpan(name, async (span) => {
        span.setAttribute('method.name', propertyKey);
        span.setAttribute('class.name', target.constructor.name);
        return await originalMethod.apply(this, args);
      });
    };

    return descriptor;
  };
}
