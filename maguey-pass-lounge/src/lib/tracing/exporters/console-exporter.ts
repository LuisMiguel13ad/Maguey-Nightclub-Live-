/**
 * Console Exporter for Development
 * 
 * Logs spans to the console in a readable format.
 * Useful for development and debugging.
 */

import { Span, SpanExporter } from '../span';

export class ConsoleExporter implements SpanExporter {
  private enabled: boolean;

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
  }

  async export(spans: Span[]): Promise<void> {
    if (!this.enabled || spans.length === 0) {
      return;
    }

    for (const span of spans) {
      const duration = span.endTime ? span.endTime - span.startTime : 0;
      const statusIcon = span.status === 'error' ? '❌' : span.status === 'ok' ? '✅' : '⏳';
      
      console.log(
        `[TRACE] ${statusIcon} ${span.name}`,
        {
          traceId: span.traceId.substring(0, 8) + '...',
          spanId: span.spanId.substring(0, 8) + '...',
          parentSpanId: span.parentSpanId?.substring(0, 8) + '...',
          duration: `${duration}ms`,
          status: span.status,
          kind: span.kind,
          attributes: Object.keys(span.attributes).length > 0 ? span.attributes : undefined,
          events: span.events.length > 0 ? span.events.map(e => e.name) : undefined,
          ...(span.statusMessage ? { statusMessage: span.statusMessage } : {}),
        }
      );

      // Log events separately if present
      if (span.events.length > 0) {
        for (const event of span.events) {
          console.log(`  └─ [EVENT] ${event.name}`, event.attributes || {});
        }
      }

      // Log errors more prominently
      if (span.status === 'error') {
        console.error(`[TRACE ERROR] ${span.name}`, {
          traceId: span.traceId,
          spanId: span.spanId,
          error: span.attributes['error.message'] || span.statusMessage,
          stack: span.attributes['error.stack'],
        });
      }
    }
  }
}
