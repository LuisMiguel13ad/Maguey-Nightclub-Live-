/**
 * Audit Trail Service
 * 
 * Comprehensive activity logging for user actions and system changes
 */

import { supabase } from '@/integrations/supabase/client';
import { isSupabaseConfigured } from '@/integrations/supabase/client';

export type AuditAction = 
  | 'ticket_scanned'
  | 'ticket_created'
  | 'ticket_transferred'
  | 'ticket_refunded'
  | 'event_created'
  | 'event_updated'
  | 'event_deleted'
  | 'user_created'
  | 'user_updated'
  | 'user_deleted'
  | 'user_role_changed'
  | 'override_used'
  | 'capacity_override'
  | 'settings_changed'
  | 'export_generated'
  | 'login'
  | 'logout'
  | 'password_changed'
  | 'api_access'
  | 'system_change';

export type AuditSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface AuditLog {
  id?: string;
  user_id: string | null;
  action: AuditAction;
  resource_type: string;
  resource_id: string | null;
  severity: AuditSeverity;
  description: string;
  metadata?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at?: string;
}

/**
 * Log an audit event
 */
export const logAuditEvent = async (
  action: AuditAction,
  resourceType: string,
  description: string,
  options: {
    userId?: string | null;
    resourceId?: string | null;
    severity?: AuditSeverity;
    metadata?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  } = {}
): Promise<void> => {
  if (!isSupabaseConfigured()) {
    // In development mode, log to console
    console.log('[Audit]', {
      action,
      resourceType,
      description,
      ...options,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  try {
    const auditLog: AuditLog = {
      user_id: options.userId || null,
      action,
      resource_type: resourceType,
      resource_id: options.resourceId || null,
      severity: options.severity || 'info',
      description,
      metadata: options.metadata || null,
      ip_address: options.ipAddress || null,
      user_agent: options.userAgent || null,
    };

    const { error } = await supabase
      .from('audit_logs')
      .insert(auditLog);

    if (error) {
      console.error('Failed to log audit event:', error);
      // Don't throw - audit logging should not break the main flow
    }
  } catch (error) {
    console.error('Error logging audit event:', error);
    // Don't throw - audit logging should not break the main flow
  }
};

/**
 * Get audit logs with filters
 */
export const getAuditLogs = async (
  filters: {
    userId?: string;
    action?: AuditAction;
    resourceType?: string;
    resourceId?: string;
    severity?: AuditSeverity;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  } = {}
): Promise<AuditLog[]> => {
  if (!isSupabaseConfigured()) {
    return [];
  }

  try {
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.userId) {
      query = query.eq('user_id', filters.userId);
    }
    if (filters.action) {
      query = query.eq('action', filters.action);
    }
    if (filters.resourceType) {
      query = query.eq('resource_type', filters.resourceType);
    }
    if (filters.resourceId) {
      query = query.eq('resource_id', filters.resourceId);
    }
    if (filters.severity) {
      query = query.eq('severity', filters.severity);
    }
    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate.toISOString());
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate.toISOString());
    }

    const limit = filters.limit || 1000;
    query = query.limit(limit);

    const { data, error } = await query;

    if (error) throw error;

    return (data || []) as AuditLog[];
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return [];
  }
};

/**
 * Get user activity summary
 */
export const getUserActivitySummary = async (
  userId: string,
  days: number = 30
): Promise<{
  totalActions: number;
  actionsByType: Record<string, number>;
  recentActions: AuditLog[];
}> => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const logs = await getAuditLogs({
    userId,
    startDate,
    limit: 10000,
  });

  const actionsByType: Record<string, number> = {};
  logs.forEach(log => {
    actionsByType[log.action] = (actionsByType[log.action] || 0) + 1;
  });

  return {
    totalActions: logs.length,
    actionsByType,
    recentActions: logs.slice(0, 50),
  };
};

/**
 * Export audit logs to CSV
 */
export const exportAuditLogsCSV = (logs: AuditLog[]): void => {
  const headers = [
    'Timestamp',
    'User ID',
    'Action',
    'Resource Type',
    'Resource ID',
    'Severity',
    'Description',
    'IP Address',
    'User Agent',
  ];

  const rows = logs.map(log => [
    log.created_at ? new Date(log.created_at).toISOString() : '',
    log.user_id || '',
    log.action,
    log.resource_type,
    log.resource_id || '',
    log.severity,
    log.description,
    log.ip_address || '',
    log.user_agent || '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row =>
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Helper to get client IP and user agent
 */
export const getClientInfo = (): { ipAddress?: string; userAgent?: string } => {
  if (typeof window === 'undefined') {
    return {};
  }

  return {
    userAgent: navigator.userAgent,
    // IP address would need to be obtained from server-side
    // For now, we'll leave it empty
  };
};


