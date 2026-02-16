/**
 * Supabase Exporter for Trace Storage
 * 
 * Stores traces in Supabase for analysis and visualization.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { Span, SpanExporter } from '../span';

interface TraceRow {
  trace_id: string;
  span_id: string;
  parent_span_id: string | null;
  service_name: string;
  span_name: string;
  span_kind: string;
  start_time: string;
  end_time: string | null;
  status: string;
  status_message: string | null;
  attributes: Record<string, unknown>;
  events: Array<{
    name: string;
    timestamp: number;
    attributes?: Record<string, unknown>;
  }>;
}

export class SupabaseExporter implements SpanExporter {
  private supabase: SupabaseClient;
  private batchSize: number;

  constructor(supabase: SupabaseClient, batchSize: number = 50) {
    this.supabase = supabase;
    this.batchSize = batchSize;
  }

  async export(spans: Span[]): Promise<void> {
    if (spans.length === 0) {
      return;
    }

    // Convert spans to database rows
    const rows: TraceRow[] = spans.map(span => ({
      trace_id: span.traceId,
      span_id: span.spanId,
      parent_span_id: span.parentSpanId || null,
      service_name: span.attributes['service.name'] as string || 'unknown',
      span_name: span.name,
      span_kind: span.kind,
      start_time: new Date(span.startTime).toISOString(),
      end_time: span.endTime ? new Date(span.endTime).toISOString() : null,
      status: span.status,
      status_message: span.statusMessage || null,
      attributes: span.attributes,
      events: span.events.map(event => ({
        name: event.name,
        timestamp: event.timestamp,
        attributes: event.attributes || {},
      })),
    }));

    // Batch insert to avoid overwhelming the database
    for (let i = 0; i < rows.length; i += this.batchSize) {
      const batch = rows.slice(i, i + this.batchSize);
      
      const { error } = await this.supabase
        .from('traces')
        .insert(batch);

      if (error) {
        console.error('[SupabaseExporter] Error inserting traces:', error);
        // Don't throw - we don't want to break the application if tracing fails
      }
    }
  }
}
