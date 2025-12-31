/**
 * Webhook Security Service
 * 
 * Provides monitoring, alerting, and management for webhook security events
 * including signature validation failures, replay attempts, and rate limiting.
 * 
 * @example
 * ```typescript
 * // Get security dashboard data
 * const stats = await getSecurityDashboard();
 * 
 * // Get unacknowledged alerts
 * const alerts = await getUnacknowledgedAlerts();
 * 
 * // Acknowledge an alert
 * await acknowledgeAlert(alertId, userId, 'Investigated - false positive');
 * ```
 */

import { supabase } from '@/integrations/supabase/client';
import { isSupabaseConfigured } from '@/integrations/supabase/client';
import { createLogger } from './logger';
import { logAuditEvent } from './audit-service';

const logger = createLogger({ module: 'webhook-security-service' });

// ============================================
// TYPES
// ============================================

/**
 * Security event types
 */
export type SecurityEventType = 
  | 'INVALID_SIGNATURE'
  | 'REPLAY_ATTEMPT'
  | 'TIMESTAMP_VIOLATION'
  | 'RATE_LIMIT_EXCEEDED';

/**
 * Alert severity levels
 */
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Security event log entry
 */
export interface SecurityEventLog {
  id: string;
  event_type: SecurityEventType;
  source_ip: string | null;
  signature_prefix: string | null;
  request_timestamp: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

/**
 * Security alert
 */
export interface SecurityAlert {
  id: string;
  type: string;
  severity: AlertSeverity;
  source_ip: string | null;
  event_count: number;
  recent_events: Array<{ type: string; timestamp: string }>;
  timestamp: string;
  acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
}

/**
 * Security events summary by IP
 */
export interface SecurityEventsSummary {
  source_ip: string;
  event_type: SecurityEventType;
  event_count: number;
  first_seen: string;
  last_seen: string;
}

/**
 * Webhook event for replay tracking
 */
export interface WebhookEvent {
  id: string;
  signature_hash: string;
  event_type: string;
  source_ip: string | null;
  timestamp: string;
  expires_at: string;
  payload_hash: string | null;
  created_at: string;
}

/**
 * Security dashboard data
 */
export interface SecurityDashboard {
  totalEventsLast24h: number;
  eventsByType: Record<SecurityEventType, number>;
  topOffendingIPs: Array<{ ip: string; count: number }>;
  unacknowledgedAlerts: number;
  recentAlerts: SecurityAlert[];
  recentEvents: SecurityEventLog[];
  blockedIPs: string[];
}

// ============================================
// CONSTANTS
// ============================================

/** Threshold for blocking an IP (events in last hour) */
export const BLOCK_THRESHOLD = 10;

/** Threshold for generating an alert */
export const ALERT_THRESHOLD = 5;

/** Hours to look back for security events */
export const DEFAULT_LOOKBACK_HOURS = 24;

// ============================================
// SECURITY EVENT LOGGING
// ============================================

/**
 * Log a security event to the database
 */
export async function logSecurityEvent(
  eventType: SecurityEventType,
  sourceIp: string | null,
  details: Record<string, unknown> = {},
  signaturePrefix?: string,
  requestTimestamp?: Date
): Promise<string | null> {
  if (!isSupabaseConfigured()) {
    logger.warn('Supabase not configured, skipping security event log');
    return null;
  }

  try {
    const { data, error } = await supabase.rpc('log_security_event', {
      p_event_type: eventType,
      p_source_ip: sourceIp,
      p_signature_prefix: signaturePrefix || null,
      p_request_timestamp: requestTimestamp?.toISOString() || null,
      p_details: details,
    });

    if (error) {
      logger.error('Failed to log security event', error, { eventType, sourceIp });
      return null;
    }

    // Also log to audit trail
    await logAuditEvent(
      'security_event',
      'webhook',
      `Security event: ${eventType} from ${sourceIp || 'unknown'}`,
      {
        severity: eventType === 'REPLAY_ATTEMPT' ? 'high' : 'warning',
        metadata: { eventType, sourceIp, ...details },
      }
    );

    return data as string;
  } catch (error) {
    logger.error('Error logging security event', error as Error);
    return null;
  }
}

// ============================================
// REPLAY PROTECTION
// ============================================

/**
 * Check if a signature has been used (replay attack detection)
 */
export async function checkReplayAttack(signatureHash: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false; // Fail open in development
  }

  try {
    const { data, error } = await supabase.rpc('check_webhook_replay', {
      p_signature_hash: signatureHash,
    });

    if (error) {
      logger.warn('Replay check failed', { error: error.message });
      return false; // Fail open if check fails
    }

    return data as boolean;
  } catch (error) {
    logger.error('Error checking replay attack', error as Error);
    return false;
  }
}

/**
 * Record a webhook signature for replay protection
 */
export async function recordWebhookSignature(
  signatureHash: string,
  eventType: string,
  sourceIp: string | null,
  timestamp: Date,
  expiresAt: Date,
  payloadHash?: string
): Promise<string | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const { data, error } = await supabase.rpc('record_webhook_signature', {
      p_signature_hash: signatureHash,
      p_event_type: eventType,
      p_source_ip: sourceIp,
      p_timestamp: timestamp.toISOString(),
      p_expires_at: expiresAt.toISOString(),
      p_payload_hash: payloadHash || null,
    });

    if (error) {
      logger.warn('Failed to record webhook signature', { error: error.message });
      return null;
    }

    return data as string;
  } catch (error) {
    logger.error('Error recording webhook signature', error as Error);
    return null;
  }
}

// ============================================
// SECURITY ALERTS
// ============================================

/**
 * Get all unacknowledged security alerts
 */
export async function getUnacknowledgedAlerts(): Promise<SecurityAlert[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('security_alerts')
      .select('*')
      .eq('acknowledged', false)
      .order('timestamp', { ascending: false });

    if (error) {
      logger.error('Failed to get unacknowledged alerts', error);
      return [];
    }

    return data as SecurityAlert[];
  } catch (error) {
    logger.error('Error getting unacknowledged alerts', error as Error);
    return [];
  }
}

/**
 * Get recent security alerts
 */
export async function getRecentAlerts(hours: number = DEFAULT_LOOKBACK_HOURS): Promise<SecurityAlert[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('security_alerts')
      .select('*')
      .gte('timestamp', cutoff)
      .order('timestamp', { ascending: false });

    if (error) {
      logger.error('Failed to get recent alerts', error);
      return [];
    }

    return data as SecurityAlert[];
  } catch (error) {
    logger.error('Error getting recent alerts', error as Error);
    return [];
  }
}

/**
 * Acknowledge a security alert
 */
export async function acknowledgeAlert(
  alertId: string,
  userId: string,
  notes?: string
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    const { error } = await supabase
      .from('security_alerts')
      .update({
        acknowledged: true,
        acknowledged_by: userId,
        acknowledged_at: new Date().toISOString(),
        notes: notes || null,
      })
      .eq('id', alertId);

    if (error) {
      logger.error('Failed to acknowledge alert', error);
      return false;
    }

    await logAuditEvent(
      'alert_acknowledged',
      'security_alert',
      `Alert ${alertId} acknowledged`,
      {
        userId,
        metadata: { alertId, notes },
      }
    );

    return true;
  } catch (error) {
    logger.error('Error acknowledging alert', error as Error);
    return false;
  }
}

/**
 * Create a new security alert
 */
export async function createSecurityAlert(
  type: string,
  severity: AlertSeverity,
  sourceIp: string | null,
  eventCount: number,
  recentEvents: Array<{ type: string; timestamp: string }>,
  metadata: Record<string, unknown> = {}
): Promise<string | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('security_alerts')
      .insert({
        type,
        severity,
        source_ip: sourceIp,
        event_count: eventCount,
        recent_events: recentEvents,
        metadata,
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Failed to create security alert', error);
      return null;
    }

    logger.warn('Security alert created', {
      alertId: data.id,
      type,
      severity,
      sourceIp,
      eventCount,
    });

    return data.id;
  } catch (error) {
    logger.error('Error creating security alert', error as Error);
    return null;
  }
}

// ============================================
// SECURITY EVENTS QUERIES
// ============================================

/**
 * Get recent security events
 */
export async function getRecentSecurityEvents(
  hours: number = DEFAULT_LOOKBACK_HOURS,
  limit: number = 100
): Promise<SecurityEventLog[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('security_event_logs')
      .select('*')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Failed to get recent security events', error);
      return [];
    }

    return data as SecurityEventLog[];
  } catch (error) {
    logger.error('Error getting recent security events', error as Error);
    return [];
  }
}

/**
 * Get security events summary by IP
 */
export async function getSecurityEventsSummary(): Promise<SecurityEventsSummary[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('security_events_summary')
      .select('*');

    if (error) {
      logger.error('Failed to get security events summary', error);
      return [];
    }

    return data as SecurityEventsSummary[];
  } catch (error) {
    logger.error('Error getting security events summary', error as Error);
    return [];
  }
}

/**
 * Get security event count for an IP
 */
export async function getSecurityEventCount(
  sourceIp: string,
  hours: number = 1
): Promise<number> {
  if (!isSupabaseConfigured()) {
    return 0;
  }

  try {
    const { data, error } = await supabase.rpc('get_security_event_count', {
      p_source_ip: sourceIp,
      p_hours: hours,
    });

    if (error) {
      logger.warn('Failed to get security event count', { error: error.message });
      return 0;
    }

    return data as number;
  } catch (error) {
    logger.error('Error getting security event count', error as Error);
    return 0;
  }
}

// ============================================
// IP BLOCKING
// ============================================

/**
 * Check if an IP should be blocked based on security events
 */
export async function shouldBlockIP(sourceIp: string): Promise<boolean> {
  const count = await getSecurityEventCount(sourceIp, 1);
  return count >= BLOCK_THRESHOLD;
}

/**
 * Get list of IPs that should be blocked
 */
export async function getBlockedIPs(): Promise<string[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    const summary = await getSecurityEventsSummary();
    
    // Aggregate by IP
    const ipCounts = new Map<string, number>();
    for (const entry of summary) {
      if (entry.source_ip) {
        ipCounts.set(
          entry.source_ip,
          (ipCounts.get(entry.source_ip) || 0) + entry.event_count
        );
      }
    }

    // Filter IPs that exceed threshold
    const blocked: string[] = [];
    for (const [ip, count] of ipCounts.entries()) {
      if (count >= BLOCK_THRESHOLD) {
        blocked.push(ip);
      }
    }

    return blocked;
  } catch (error) {
    logger.error('Error getting blocked IPs', error as Error);
    return [];
  }
}

// ============================================
// SECURITY DASHBOARD
// ============================================

/**
 * Get comprehensive security dashboard data
 */
export async function getSecurityDashboard(): Promise<SecurityDashboard> {
  const [
    recentEvents,
    recentAlerts,
    unacknowledgedAlerts,
    blockedIPs,
    summary,
  ] = await Promise.all([
    getRecentSecurityEvents(24, 50),
    getRecentAlerts(24),
    getUnacknowledgedAlerts(),
    getBlockedIPs(),
    getSecurityEventsSummary(),
  ]);

  // Calculate events by type
  const eventsByType: Record<SecurityEventType, number> = {
    INVALID_SIGNATURE: 0,
    REPLAY_ATTEMPT: 0,
    TIMESTAMP_VIOLATION: 0,
    RATE_LIMIT_EXCEEDED: 0,
  };

  for (const entry of summary) {
    if (entry.event_type in eventsByType) {
      eventsByType[entry.event_type as SecurityEventType] += entry.event_count;
    }
  }

  // Calculate top offending IPs
  const ipCounts = new Map<string, number>();
  for (const entry of summary) {
    if (entry.source_ip) {
      ipCounts.set(
        entry.source_ip,
        (ipCounts.get(entry.source_ip) || 0) + entry.event_count
      );
    }
  }

  const topOffendingIPs = Array.from(ipCounts.entries())
    .map(([ip, count]) => ({ ip, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const totalEventsLast24h = Object.values(eventsByType).reduce((a, b) => a + b, 0);

  return {
    totalEventsLast24h,
    eventsByType,
    topOffendingIPs,
    unacknowledgedAlerts: unacknowledgedAlerts.length,
    recentAlerts,
    recentEvents,
    blockedIPs,
  };
}

// ============================================
// CLEANUP
// ============================================

/**
 * Cleanup expired webhook events
 */
export async function cleanupExpiredWebhookEvents(): Promise<number> {
  if (!isSupabaseConfigured()) {
    return 0;
  }

  try {
    const { data, error } = await supabase.rpc('cleanup_expired_webhook_events');

    if (error) {
      logger.error('Failed to cleanup expired webhook events', error);
      return 0;
    }

    logger.info('Cleaned up expired webhook events', { count: data });
    return data as number;
  } catch (error) {
    logger.error('Error cleaning up expired webhook events', error as Error);
    return 0;
  }
}

// ============================================
// EXPORTS
// ============================================

export const webhookSecurityService = {
  // Event logging
  logSecurityEvent,
  
  // Replay protection
  checkReplayAttack,
  recordWebhookSignature,
  
  // Alerts
  getUnacknowledgedAlerts,
  getRecentAlerts,
  acknowledgeAlert,
  createSecurityAlert,
  
  // Events queries
  getRecentSecurityEvents,
  getSecurityEventsSummary,
  getSecurityEventCount,
  
  // IP blocking
  shouldBlockIP,
  getBlockedIPs,
  
  // Dashboard
  getSecurityDashboard,
  
  // Cleanup
  cleanupExpiredWebhookEvents,
  
  // Constants
  BLOCK_THRESHOLD,
  ALERT_THRESHOLD,
  DEFAULT_LOOKBACK_HOURS,
};

export default webhookSecurityService;
