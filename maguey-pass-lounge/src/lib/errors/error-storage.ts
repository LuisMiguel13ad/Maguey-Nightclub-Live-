/**
 * Error Storage
 * 
 * Stores errors in Supabase and manages error groups.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { CapturedError, ErrorSeverity, ErrorCategory } from './error-types';

export interface ErrorGroup {
  id: string;
  fingerprint: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  service_name: string;
  first_seen: string;
  last_seen: string;
  occurrence_count: number;
  affected_users: number;
  status: 'open' | 'resolved' | 'ignored';
  assigned_to?: string;
  resolved_at?: string;
  last_hour_count?: number;
  last_24h_count?: number;
}

export interface ErrorStats {
  hour: string;
  service_name: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  error_count: number;
  affected_users: number;
  unique_errors: number;
}

export class ErrorStorage {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Store an error event
   */
  async storeError(error: CapturedError): Promise<string> {
    // Insert error event
    const { data: eventData, error: eventError } = await this.supabase
      .from('error_events')
      .insert({
        fingerprint: error.fingerprint,
        message: error.message,
        stack: error.stack,
        category: error.category,
        severity: error.severity,
        service_name: error.serviceName,
        environment: import.meta.env.MODE || 'development',
        context: error.context,
        tags: error.tags,
        handled: error.handled,
        user_id: error.context.userId || null,
        session_id: error.context.sessionId || null,
        request_id: error.context.requestId || null,
        trace_id: error.context.traceId || null,
        url: error.context.url || null,
        user_agent: error.context.userAgent || null,
        ip_address: error.context.ip || null,
      })
      .select('id')
      .single();

    if (eventError) {
      console.error('[ErrorStorage] Error storing error event:', eventError);
      throw eventError;
    }

    // Upsert error group
    const { error: groupError } = await this.supabase.rpc('upsert_error_group', {
      p_fingerprint: error.fingerprint,
      p_message: error.message,
      p_category: error.category,
      p_severity: error.severity,
      p_service_name: error.serviceName,
      p_user_id: error.context.userId || null,
    });

    if (groupError) {
      console.error('[ErrorStorage] Error upserting error group:', groupError);
      // Don't throw - event was stored successfully
    }

    return eventData.id;
  }

  /**
   * Get error groups
   */
  async getErrorGroups(options: {
    status?: 'open' | 'resolved' | 'ignored';
    severity?: ErrorSeverity;
    service?: string;
    limit?: number;
  } = {}): Promise<ErrorGroup[]> {
    let query = this.supabase
      .from('error_groups')
      .select('*')
      .order('last_seen', { ascending: false })
      .limit(options.limit || 100);

    if (options.status) {
      query = query.eq('status', options.status);
    }

    if (options.severity) {
      query = query.eq('severity', options.severity);
    }

    if (options.service) {
      query = query.eq('service_name', options.service);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[ErrorStorage] Error fetching error groups:', error);
      throw error;
    }

    return (data || []) as ErrorGroup[];
  }

  /**
   * Get error events for a fingerprint
   */
  async getErrorEvents(fingerprint: string, limit: number = 100): Promise<CapturedError[]> {
    const { data, error } = await this.supabase.rpc('get_error_events', {
      p_fingerprint: fingerprint,
      p_limit: limit,
    });

    if (error) {
      console.error('[ErrorStorage] Error fetching error events:', error);
      throw error;
    }

    // Convert to CapturedError format
    return (data || []).map((row: any) => ({
      id: row.id,
      fingerprint,
      message: row.message,
      stack: row.stack,
      category: row.category as ErrorCategory,
      severity: row.severity as ErrorSeverity,
      context: row.context || {},
      tags: row.tags || {},
      timestamp: new Date(row.created_at),
      handled: true,
      serviceName: '', // Will be filled from error group
    }));
  }

  /**
   * Update error group status
   */
  async updateErrorGroupStatus(
    fingerprint: string,
    status: 'resolved' | 'ignored',
    assignedTo?: string
  ): Promise<void> {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'resolved') {
      updateData.resolved_at = new Date().toISOString();
    } else {
      updateData.resolved_at = null;
    }

    if (assignedTo) {
      updateData.assigned_to = assignedTo;
    }

    const { error } = await this.supabase
      .from('error_groups')
      .update(updateData)
      .eq('fingerprint', fingerprint);

    if (error) {
      console.error('[ErrorStorage] Error updating error group:', error);
      throw error;
    }
  }

  /**
   * Get error statistics
   */
  async getErrorStats(hours: number = 24): Promise<ErrorStats[]> {
    const { data, error } = await this.supabase
      .from('error_stats')
      .select('*')
      .gte('hour', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
      .order('hour', { ascending: false });

    if (error) {
      console.error('[ErrorStorage] Error fetching error stats:', error);
      throw error;
    }

    return (data || []) as ErrorStats[];
  }

  /**
   * Get recent error groups with counts
   */
  async getRecentErrorGroups(limit: number = 50): Promise<ErrorGroup[]> {
    const { data, error } = await this.supabase
      .from('recent_error_groups')
      .select('*')
      .limit(limit);

    if (error) {
      console.error('[ErrorStorage] Error fetching recent error groups:', error);
      throw error;
    }

    return (data || []) as ErrorGroup[];
  }
}
