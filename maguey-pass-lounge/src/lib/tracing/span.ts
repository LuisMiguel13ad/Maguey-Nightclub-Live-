/**
 * Span data structures and builder for distributed tracing
 */

import { TraceContext } from './trace-context';

export type SpanKind = 'client' | 'server' | 'producer' | 'consumer' | 'internal';

export type SpanStatus = 'ok' | 'error' | 'unset';

export interface SpanAttributes {
  [key: string]: string | number | boolean | string[];
}

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: SpanAttributes;
}

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: SpanKind;
  startTime: number;
  endTime?: number;
  status: SpanStatus;
  statusMessage?: string;
  attributes: SpanAttributes;
  events: SpanEvent[];
}

/**
 * Builder class for creating and configuring spans
 */
export class SpanBuilder {
  private span: Span;

  constructor(name: string, context: TraceContext, kind: SpanKind = 'internal') {
    this.span = {
      traceId: context.traceId,
      spanId: context.spanId,
      parentSpanId: context.parentSpanId,
      name,
      kind,
      startTime: Date.now(),
      status: 'unset',
      attributes: {},
      events: [],
    };
  }

  /**
   * Set a single attribute on the span
   */
  setAttribute(key: string, value: string | number | boolean | string[]): this {
    this.span.attributes[key] = value;
    return this;
  }

  /**
   * Set multiple attributes on the span
   */
  setAttributes(attrs: SpanAttributes): this {
    Object.assign(this.span.attributes, attrs);
    return this;
  }

  /**
   * Add an event to the span
   */
  addEvent(name: string, attributes?: SpanAttributes): this {
    this.span.events.push({
      name,
      timestamp: Date.now(),
      attributes,
    });
    return this;
  }

  /**
   * Set the status of the span
   */
  setStatus(status: SpanStatus, message?: string): this {
    this.span.status = status;
    if (message) {
      this.span.statusMessage = message;
    }
    return this;
  }

  /**
   * Mark the span as an error
   */
  setError(error: Error | string): this {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorName = error instanceof Error ? error.name : 'Error';
    
    this.setStatus('error', errorMessage);
    this.setAttribute('error', true);
    this.setAttribute('error.name', errorName);
    this.setAttribute('error.message', errorMessage);
    
    if (error instanceof Error && error.stack) {
      this.setAttribute('error.stack', error.stack);
    }
    
    return this;
  }

  /**
   * Mark the span as successful
   */
  setOk(): this {
    this.setStatus('ok');
    return this;
  }

  /**
   * End the span and return the completed span
   */
  end(): Span {
    if (!this.span.endTime) {
      this.span.endTime = Date.now();
    }
    
    // If status is still unset, mark as ok
    if (this.span.status === 'unset') {
      this.span.status = 'ok';
    }
    
    return { ...this.span };
  }

  /**
   * Get the current span (for inspection before ending)
   */
  getSpan(): Readonly<Span> {
    return { ...this.span };
  }

  /**
   * Get the duration in milliseconds
   */
  getDuration(): number | null {
    if (!this.span.endTime) {
      return null;
    }
    return this.span.endTime - this.span.startTime;
  }
}
