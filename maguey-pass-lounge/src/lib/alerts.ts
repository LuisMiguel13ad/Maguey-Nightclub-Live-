/**
 * Alerting System
 * 
 * Monitors metrics and triggers alerts when thresholds are exceeded.
 * Supports multiple notification channels (console, webhook, email).
 * 
 * @example
 * import { alertManager, AlertSeverity } from './alerts';
 * 
 * // Configure an alert rule
 * alertManager.addRule({
 *   id: 'high-error-rate',
 *   name: 'High Error Rate',
 *   description: 'Order error rate exceeds 5%',
 *   severity: AlertSeverity.Critical,
 *   condition: (metrics) => metrics.errorRate > 5,
 *   cooldownMs: 5 * 60 * 1000, // 5 minutes between alerts
 * });
 * 
 * // Check alerts periodically
 * alertManager.check();
 */

import { createLogger } from './logger';
import { metrics, getDashboardMetrics, calculateErrorRate, calculateScanSuccessRate } from './monitoring';

// ============================================
// TYPES
// ============================================

export enum AlertSeverity {
  Info = 'info',
  Warning = 'warning',
  Critical = 'critical',
  Emergency = 'emergency',
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  severity: AlertSeverity;
  /** 
   * Condition function - can be sync or async.
   * Return true to trigger the alert.
   */
  condition: (metricsData: MetricsSnapshot) => boolean | Promise<boolean>;
  cooldownMs: number; // Minimum time between alerts
  /** Cooldown in minutes (alternative to cooldownMs) */
  cooldownMinutes?: number;
  enabled?: boolean;
  tags?: Record<string, string>;
}

export interface MetricsSnapshot {
  ordersCreated: number;
  ordersFailed: number;
  ticketsSold: number;
  revenueInCents: number;
  avgOrderDuration: number;
  errorRate: number;
  scanSuccessRate: number;
  ticketScansTotal: number;
  [key: string]: number; // Allow additional metrics
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: AlertSeverity;
  message: string;
  timestamp: Date;
  metrics: MetricsSnapshot;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface AlertNotifier {
  name: string;
  notify(alert: Alert): Promise<void>;
}

// ============================================
// NOTIFIERS
// ============================================

/**
 * Console notifier - logs alerts to console
 */
export class ConsoleNotifier implements AlertNotifier {
  name = 'console';
  private logger = createLogger({ module: 'alerts' });

  async notify(alert: Alert): Promise<void> {
    const severityColors: Record<AlertSeverity, string> = {
      [AlertSeverity.Info]: '\x1b[36m',     // Cyan
      [AlertSeverity.Warning]: '\x1b[33m',  // Yellow
      [AlertSeverity.Critical]: '\x1b[31m', // Red
      [AlertSeverity.Emergency]: '\x1b[35m', // Magenta
    };
    
    const color = severityColors[alert.severity];
    const reset = '\x1b[0m';
    
    console.log(`${color}[ALERT][${alert.severity.toUpperCase()}]${reset} ${alert.message}`);
    
    this.logger.warn(`Alert triggered: ${alert.ruleName}`, {
      alertId: alert.id,
      severity: alert.severity,
      ruleId: alert.ruleId,
    });
  }
}

/**
 * Webhook notifier - sends alerts to a webhook URL
 */
export class WebhookNotifier implements AlertNotifier {
  name = 'webhook';
  private logger = createLogger({ module: 'alerts-webhook' });

  constructor(
    private webhookUrl: string,
    private headers?: Record<string, string>
  ) {}

  async notify(alert: Alert): Promise<void> {
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.headers,
        },
        body: JSON.stringify({
          alert: {
            id: alert.id,
            ruleId: alert.ruleId,
            ruleName: alert.ruleName,
            severity: alert.severity,
            message: alert.message,
            timestamp: alert.timestamp.toISOString(),
          },
          metrics: alert.metrics,
        }),
      });

      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}`);
      }

      this.logger.debug('Alert sent to webhook', { alertId: alert.id });
    } catch (error) {
      this.logger.error('Failed to send alert to webhook', error, {
        alertId: alert.id,
        webhookUrl: this.webhookUrl,
      });
    }
  }
}

/**
 * Slack notifier - sends alerts to Slack channel
 */
export class SlackNotifier implements AlertNotifier {
  name = 'slack';
  private logger = createLogger({ module: 'alerts-slack' });

  constructor(private webhookUrl: string) {}

  async notify(alert: Alert): Promise<void> {
    const severityEmoji: Record<AlertSeverity, string> = {
      [AlertSeverity.Info]: 'ℹ️',
      [AlertSeverity.Warning]: '⚠️',
      [AlertSeverity.Critical]: '🚨',
      [AlertSeverity.Emergency]: '🔥',
    };

    const severityColor: Record<AlertSeverity, string> = {
      [AlertSeverity.Info]: '#36a64f',
      [AlertSeverity.Warning]: '#daa038',
      [AlertSeverity.Critical]: '#cc0000',
      [AlertSeverity.Emergency]: '#ff0000',
    };

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attachments: [
            {
              color: severityColor[alert.severity],
              blocks: [
                {
                  type: 'header',
                  text: {
                    type: 'plain_text',
                    text: `${severityEmoji[alert.severity]} ${alert.ruleName}`,
                    emoji: true,
                  },
                },
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: alert.message,
                  },
                },
                {
                  type: 'context',
                  elements: [
                    {
                      type: 'mrkdwn',
                      text: `*Severity:* ${alert.severity} | *Time:* ${alert.timestamp.toISOString()}`,
                    },
                  ],
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Slack webhook returned ${response.status}`);
      }

      this.logger.debug('Alert sent to Slack', { alertId: alert.id });
    } catch (error) {
      this.logger.error('Failed to send alert to Slack', error, {
        alertId: alert.id,
      });
    }
  }
}

/**
 * PagerDuty notifier - sends alerts to PagerDuty
 */
export class PagerDutyNotifier implements AlertNotifier {
  name = 'pagerduty';
  private logger = createLogger({ module: 'alerts-pagerduty' });

  constructor(private routingKey: string) {}

  async notify(alert: Alert): Promise<void> {
    // Only send Critical and Emergency to PagerDuty
    if (alert.severity !== AlertSeverity.Critical && alert.severity !== AlertSeverity.Emergency) {
      return;
    }

    const pdSeverity: Record<AlertSeverity, string> = {
      [AlertSeverity.Info]: 'info',
      [AlertSeverity.Warning]: 'warning',
      [AlertSeverity.Critical]: 'error',
      [AlertSeverity.Emergency]: 'critical',
    };

    try {
      const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routing_key: this.routingKey,
          event_action: 'trigger',
          dedup_key: alert.ruleId,
          payload: {
            summary: `[${alert.severity.toUpperCase()}] ${alert.ruleName}: ${alert.message}`,
            source: 'maguey-ticketing',
            severity: pdSeverity[alert.severity],
            timestamp: alert.timestamp.toISOString(),
            custom_details: alert.metrics,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`PagerDuty returned ${response.status}`);
      }

      this.logger.debug('Alert sent to PagerDuty', { alertId: alert.id });
    } catch (error) {
      this.logger.error('Failed to send alert to PagerDuty', error, {
        alertId: alert.id,
      });
    }
  }
}

// ============================================
// ALERT MANAGER
// ============================================

class AlertManager {
  private rules: Map<string, AlertRule> = new Map();
  private notifiers: AlertNotifier[] = [];
  private activeAlerts: Map<string, Alert> = new Map();
  private lastTriggered: Map<string, number> = new Map();
  private alertHistory: Alert[] = [];
  private maxHistorySize = 1000;
  private logger = createLogger({ module: 'alert-manager' });
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Add console notifier by default
    this.notifiers.push(new ConsoleNotifier());
  }

  // ============================================
  // RULE MANAGEMENT
  // ============================================

  /**
   * Add a new alert rule
   */
  addRule(rule: AlertRule): void {
    // Support cooldownMinutes as alternative to cooldownMs
    const cooldownMs = rule.cooldownMs || (rule.cooldownMinutes ? rule.cooldownMinutes * 60 * 1000 : 5 * 60 * 1000);
    this.rules.set(rule.id, { ...rule, cooldownMs, enabled: rule.enabled ?? true });
    this.logger.info(`Alert rule added: ${rule.name}`, { ruleId: rule.id });
  }

  /**
   * Remove an alert rule
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    this.lastTriggered.delete(ruleId);
    this.logger.info(`Alert rule removed`, { ruleId });
  }

  /**
   * Enable/disable a rule
   */
  setRuleEnabled(ruleId: string, enabled: boolean): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
      this.logger.info(`Alert rule ${enabled ? 'enabled' : 'disabled'}`, { ruleId });
    }
  }

  /**
   * Get all rules
   */
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  // ============================================
  // NOTIFIER MANAGEMENT
  // ============================================

  /**
   * Add a notifier
   */
  addNotifier(notifier: AlertNotifier): void {
    this.notifiers.push(notifier);
    this.logger.info(`Notifier added: ${notifier.name}`);
  }

  /**
   * Remove a notifier by name
   */
  removeNotifier(name: string): void {
    this.notifiers = this.notifiers.filter(n => n.name !== name);
    this.logger.info(`Notifier removed: ${name}`);
  }

  // ============================================
  // ALERT CHECKING
  // ============================================

  /**
   * Check all rules against current metrics
   */
  async check(): Promise<Alert[]> {
    const metricsSnapshot = this.getMetricsSnapshot();
    const triggeredAlerts: Alert[] = [];
    const now = Date.now();

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      // Check cooldown
      const lastTrigger = this.lastTriggered.get(rule.id) || 0;
      if (now - lastTrigger < rule.cooldownMs) continue;

      try {
        // Support both sync and async conditions
        const conditionResult = rule.condition(metricsSnapshot);
        const conditionMet = conditionResult instanceof Promise 
          ? await conditionResult 
          : conditionResult;
        
        if (conditionMet) {
          const alert = this.createAlert(rule, metricsSnapshot);
          triggeredAlerts.push(alert);
          
          this.lastTriggered.set(rule.id, now);
          this.activeAlerts.set(rule.id, alert);
          this.addToHistory(alert);
          
          // Notify all channels
          await this.notifyAll(alert);
        } else {
          // If condition is no longer met, resolve any active alert
          const activeAlert = this.activeAlerts.get(rule.id);
          if (activeAlert && !activeAlert.resolved) {
            this.resolveAlert(rule.id);
          }
        }
      } catch (error) {
        this.logger.error(`Error checking rule ${rule.id}`, error);
      }
    }

    return triggeredAlerts;
  }

  /**
   * Start automatic checking at specified interval
   */
  startAutoCheck(intervalMs: number = 60000): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      this.check().catch(err => {
        this.logger.error('Auto-check failed', err);
      });
    }, intervalMs);

    this.logger.info(`Auto-check started with interval ${intervalMs}ms`);
  }

  /**
   * Stop automatic checking
   */
  stopAutoCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      this.logger.info('Auto-check stopped');
    }
  }

  // ============================================
  // ALERT MANAGEMENT
  // ============================================

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy?: string): void {
    for (const alert of this.activeAlerts.values()) {
      if (alert.id === alertId) {
        alert.acknowledged = true;
        alert.acknowledgedAt = new Date();
        alert.acknowledgedBy = acknowledgedBy;
        this.logger.info(`Alert acknowledged`, { alertId, acknowledgedBy });
        return;
      }
    }
  }

  /**
   * Resolve an alert by rule ID
   */
  resolveAlert(ruleId: string): void {
    const alert = this.activeAlerts.get(ruleId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      this.activeAlerts.delete(ruleId);
      this.logger.info(`Alert resolved`, { alertId: alert.id, ruleId });
    }
  }

  /**
   * Get all active (unresolved) alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values()).filter(a => !a.resolved);
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit: number = 100): Alert[] {
    return this.alertHistory.slice(-limit);
  }

  /**
   * Clear all active alerts
   */
  clearActiveAlerts(): void {
    this.activeAlerts.clear();
    this.logger.info('All active alerts cleared');
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private createAlert(rule: AlertRule, metricsSnapshot: MetricsSnapshot): Alert {
    return {
      id: `${rule.id}-${Date.now()}`,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      message: rule.description,
      timestamp: new Date(),
      metrics: metricsSnapshot,
      acknowledged: false,
      resolved: false,
    };
  }

  private async notifyAll(alert: Alert): Promise<void> {
    const notifications = this.notifiers.map(notifier => 
      notifier.notify(alert).catch(err => {
        this.logger.error(`Notifier ${notifier.name} failed`, err);
      })
    );
    
    await Promise.allSettled(notifications);
  }

  private addToHistory(alert: Alert): void {
    this.alertHistory.push(alert);
    
    if (this.alertHistory.length > this.maxHistorySize) {
      this.alertHistory = this.alertHistory.slice(-this.maxHistorySize);
    }
  }

  private getMetricsSnapshot(): MetricsSnapshot {
    const dashboardMetrics = getDashboardMetrics();
    const allMetrics = metrics.getAll();
    
    return {
      ...dashboardMetrics,
      // Add any additional metrics from the registry
      ...Object.entries(allMetrics).reduce((acc, [key, value]) => {
        // Convert key to camelCase for easier access
        const camelKey = key.replace(/[._]([a-z])/g, (_, c) => c.toUpperCase());
        acc[camelKey] = value;
        return acc;
      }, {} as Record<string, number>),
    };
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

export const alertManager = new AlertManager();

// ============================================
// DEFAULT ALERT RULES
// ============================================

/**
 * Configure default alert rules for the ticketing system
 */
export function configureDefaultAlerts(): void {
  // High error rate
  alertManager.addRule({
    id: 'high-error-rate',
    name: 'High Error Rate',
    description: 'Order error rate exceeds 5%',
    severity: AlertSeverity.Critical,
    condition: (m) => m.errorRate > 5 && (m.ordersCreated + m.ordersFailed) > 10,
    cooldownMs: 5 * 60 * 1000, // 5 minutes
  });

  // Very high error rate
  alertManager.addRule({
    id: 'critical-error-rate',
    name: 'Critical Error Rate',
    description: 'Order error rate exceeds 20%',
    severity: AlertSeverity.Emergency,
    condition: (m) => m.errorRate > 20 && (m.ordersCreated + m.ordersFailed) > 5,
    cooldownMs: 2 * 60 * 1000, // 2 minutes
  });

  // Slow order processing
  alertManager.addRule({
    id: 'slow-order-processing',
    name: 'Slow Order Processing',
    description: 'Average order creation time exceeds 5 seconds',
    severity: AlertSeverity.Warning,
    condition: (m) => m.avgOrderDuration > 5000,
    cooldownMs: 10 * 60 * 1000, // 10 minutes
  });

  // Very slow order processing
  alertManager.addRule({
    id: 'very-slow-order-processing',
    name: 'Very Slow Order Processing',
    description: 'Average order creation time exceeds 10 seconds',
    severity: AlertSeverity.Critical,
    condition: (m) => m.avgOrderDuration > 10000,
    cooldownMs: 5 * 60 * 1000, // 5 minutes
  });

  // Low scan success rate
  alertManager.addRule({
    id: 'low-scan-success-rate',
    name: 'Low Scan Success Rate',
    description: 'Ticket scan success rate below 80%',
    severity: AlertSeverity.Warning,
    condition: (m) => m.scanSuccessRate < 80 && m.ticketScansTotal > 20,
    cooldownMs: 15 * 60 * 1000, // 15 minutes
  });

  // No orders in a while (during expected busy times)
  alertManager.addRule({
    id: 'no-recent-orders',
    name: 'No Recent Orders',
    description: 'No orders created in the last hour during active period',
    severity: AlertSeverity.Warning,
    condition: (m) => {
      // This would need to track order rate over time
      // For now, just a placeholder that checks if orders are suspiciously low
      return m.ordersCreated === 0 && m.ticketsSold === 0;
    },
    cooldownMs: 60 * 60 * 1000, // 1 hour
    enabled: false, // Disabled by default
  });

  // High number of failed orders in a short period
  alertManager.addRule({
    id: 'order-failure-spike',
    name: 'Order Failure Spike',
    description: 'Multiple order failures detected in short period',
    severity: AlertSeverity.Critical,
    condition: (m) => m.ordersFailed > 5,
    cooldownMs: 10 * 60 * 1000, // 10 minutes
  });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Create a custom alert rule builder
 */
export function createAlertRule(
  id: string,
  name: string,
  options: {
    description: string;
    severity: AlertSeverity;
    condition: (metrics: MetricsSnapshot) => boolean;
    cooldownMinutes?: number;
    enabled?: boolean;
    tags?: Record<string, string>;
  }
): AlertRule {
  return {
    id,
    name,
    description: options.description,
    severity: options.severity,
    condition: options.condition,
    cooldownMs: (options.cooldownMinutes ?? 5) * 60 * 1000,
    enabled: options.enabled ?? true,
    tags: options.tags,
  };
}

/**
 * Configure Slack notifications
 */
export function configureSlackNotifications(webhookUrl: string): void {
  alertManager.addNotifier(new SlackNotifier(webhookUrl));
}

/**
 * Configure PagerDuty notifications
 */
export function configurePagerDutyNotifications(routingKey: string): void {
  alertManager.addNotifier(new PagerDutyNotifier(routingKey));
}

/**
 * Configure webhook notifications
 */
export function configureWebhookNotifications(
  webhookUrl: string,
  headers?: Record<string, string>
): void {
  alertManager.addNotifier(new WebhookNotifier(webhookUrl, headers));
}

/**
 * Initialize alerting with environment configuration
 */
export function initializeAlerting(config?: {
  slackWebhook?: string;
  pagerDutyRoutingKey?: string;
  customWebhook?: string;
  autoCheckIntervalMs?: number;
}): void {
  // Configure default rules
  configureDefaultAlerts();

  // Configure notifiers based on environment
  if (config?.slackWebhook) {
    configureSlackNotifications(config.slackWebhook);
  }

  if (config?.pagerDutyRoutingKey) {
    configurePagerDutyNotifications(config.pagerDutyRoutingKey);
  }

  if (config?.customWebhook) {
    configureWebhookNotifications(config.customWebhook);
  }

  // Start auto-checking if interval provided
  if (config?.autoCheckIntervalMs) {
    alertManager.startAutoCheck(config.autoCheckIntervalMs);
  }
}

// ============================================
// CONVENIENCE FUNCTIONS (matching interface spec)
// ============================================

/**
 * Check all alert rules and trigger any that meet their conditions.
 * This is the main entry point for alert checking.
 * 
 * @example
 * // Check alerts manually
 * const triggeredAlerts = await checkAlerts();
 * console.log(`${triggeredAlerts.length} alerts triggered`);
 */
export async function checkAlerts(): Promise<Alert[]> {
  return alertManager.check();
}

/**
 * Manually send an alert for a specific rule with custom details.
 * Useful for sending alerts from external triggers or custom conditions.
 * 
 * @example
 * await sendAlert(
 *   { name: 'Custom Alert', severity: 'warning', ... },
 *   'Payment gateway timeout detected'
 * );
 */
export async function sendAlert(
  rule: Pick<AlertRule, 'name' | 'severity' | 'description'> & { id?: string },
  details?: string
): Promise<void> {
  const logger = createLogger({ module: 'alerts' });
  const snapshot = getDashboardMetrics() as MetricsSnapshot;
  
  const alert: Alert = {
    id: `manual-${Date.now()}`,
    ruleId: rule.id || 'manual',
    ruleName: rule.name,
    severity: rule.severity as AlertSeverity,
    message: details || rule.description,
    timestamp: new Date(),
    metrics: snapshot,
    acknowledged: false,
    resolved: false,
  };
  
  // Get all notifiers from the alert manager and send
  const notifiers = [new ConsoleNotifier()];
  
  for (const notifier of notifiers) {
    try {
      await notifier.notify(alert);
    } catch (err) {
      logger.error(`Failed to send alert via ${notifier.name}`, err);
    }
  }
  
  logger.warn(`Manual alert sent: ${rule.name}`, { details });
}

// ============================================
// PREDEFINED ALERT RULES (matching interface spec)
// ============================================

/**
 * Pre-configured alert rules matching the interface specification
 */
export const alertRules: AlertRule[] = [
  {
    id: 'high-order-failure-rate',
    name: 'High Order Failure Rate',
    description: 'Order failure rate exceeds 5%',
    severity: AlertSeverity.Critical,
    condition: async () => {
      const created = metrics.getCounter('orders.created');
      const failed = metrics.getCounter('orders.failed');
      const total = created + failed;
      if (total < 10) return false; // Need minimum sample size
      const failRate = failed / total;
      return failRate > 0.05; // 5% failure rate
    },
    cooldownMinutes: 5,
    cooldownMs: 5 * 60 * 1000,
  },
  {
    id: 'payment-processing-slow',
    name: 'Slow Payment Processing',
    description: 'Payment processing time exceeds 10 seconds average',
    severity: AlertSeverity.Warning,
    condition: async () => {
      const avgDuration = metrics.getAverageTiming('payment.processing.duration');
      return avgDuration > 10000; // 10 seconds
    },
    cooldownMinutes: 10,
    cooldownMs: 10 * 60 * 1000,
  },
  {
    id: 'database-errors',
    name: 'Database Errors Detected',
    description: 'Multiple database query errors detected',
    severity: AlertSeverity.Critical,
    condition: async () => {
      const errors = metrics.getCounter('db.query.errors');
      return errors > 10;
    },
    cooldownMinutes: 5,
    cooldownMs: 5 * 60 * 1000,
  },
  {
    id: 'email-failures',
    name: 'Email Delivery Failures',
    description: 'Email sending is failing',
    severity: AlertSeverity.Warning,
    condition: async () => {
      const sent = metrics.getCounter('emails.sent');
      const failed = metrics.getCounter('emails.failed');
      const total = sent + failed;
      if (total < 5) return false;
      return (failed / total) > 0.2; // 20% failure rate
    },
    cooldownMinutes: 15,
    cooldownMs: 15 * 60 * 1000,
  },
  {
    id: 'ticket-scan-errors',
    name: 'High Ticket Scan Error Rate',
    description: 'Ticket scanning has high error rate',
    severity: AlertSeverity.Warning,
    condition: async () => {
      const valid = metrics.getCounter('ticket.scans.valid');
      const errors = metrics.getCounter('ticket.scans.error');
      const total = valid + errors;
      if (total < 10) return false;
      return (errors / total) > 0.1; // 10% error rate
    },
    cooldownMinutes: 10,
    cooldownMs: 10 * 60 * 1000,
  },
];

/**
 * Register all predefined alert rules with the alert manager
 */
export function registerPredefinedAlerts(): void {
  for (const rule of alertRules) {
    alertManager.addRule(rule);
  }
}
