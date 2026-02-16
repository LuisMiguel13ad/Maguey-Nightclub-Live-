/**
 * Error Alerting
 * 
 * Monitors errors and sends alerts based on configured rules.
 */

import { CapturedError, ErrorSeverity, ErrorCategory } from './error-types';
import { ErrorStats } from './error-storage';

export interface AlertRule {
  id: string;
  name: string;
  condition: (error: CapturedError, stats: ErrorStats[]) => boolean;
  cooldown: number;  // Minutes between alerts
  channels: ('email' | 'slack' | 'webhook')[];
}

export const defaultAlertRules: AlertRule[] = [
  {
    id: 'critical-error',
    name: 'Critical Error Alert',
    condition: (error) => error.severity === ErrorSeverity.CRITICAL,
    cooldown: 5,
    channels: ['email', 'slack'],
  },
  {
    id: 'error-spike',
    name: 'Error Rate Spike',
    condition: (_, stats) => {
      if (stats.length < 2) return false;
      const lastHour = stats[0]?.error_count || 0;
      const previousHour = stats[1]?.error_count || 0;
      return previousHour > 0 && lastHour > previousHour * 2;
    },
    cooldown: 30,
    channels: ['slack'],
  },
  {
    id: 'payment-errors',
    name: 'Payment Error Alert',
    condition: (error) => error.category === ErrorCategory.PAYMENT,
    cooldown: 15,
    channels: ['email', 'slack'],
  },
  {
    id: 'high-severity-errors',
    name: 'High Severity Error Alert',
    condition: (error) => error.severity === ErrorSeverity.HIGH,
    cooldown: 10,
    channels: ['slack'],
  },
];

export class ErrorAlerter {
  private lastAlertTimes: Map<string, Date>;
  private rules: AlertRule[];

  constructor(rules: AlertRule[] = defaultAlertRules) {
    this.lastAlertTimes = new Map();
    this.rules = rules;
  }

  /**
   * Check if alert should be sent and send it
   */
  async checkAndAlert(error: CapturedError, stats: ErrorStats[]): Promise<void> {
    for (const rule of this.rules) {
      if (this.shouldAlert(rule, error, stats)) {
        await this.sendAlert(rule, error, stats);
        this.lastAlertTimes.set(rule.id, new Date());
      }
    }
  }

  /**
   * Check if alert should be sent (respects cooldown)
   */
  private shouldAlert(rule: AlertRule, error: CapturedError, stats: ErrorStats[]): boolean {
    // Check cooldown
    const lastAlert = this.lastAlertTimes.get(rule.id);
    if (lastAlert) {
      const minutesSinceLastAlert = (Date.now() - lastAlert.getTime()) / (1000 * 60);
      if (minutesSinceLastAlert < rule.cooldown) {
        return false;
      }
    }

    // Check condition
    return rule.condition(error, stats);
  }

  /**
   * Send alert through configured channels
   */
  private async sendAlert(rule: AlertRule, error: CapturedError, stats: ErrorStats[]): Promise<void> {
    const alertMessage = this.formatAlertMessage(rule, error, stats);

    const promises: Promise<void>[] = [];

    for (const channel of rule.channels) {
      switch (channel) {
        case 'email':
          promises.push(this.sendEmailAlert(rule, alertMessage));
          break;
        case 'slack':
          promises.push(this.sendSlackAlert(rule, alertMessage));
          break;
        case 'webhook':
          promises.push(this.sendWebhookAlert(rule, alertMessage));
          break;
      }
    }

    await Promise.allSettled(promises);
  }

  /**
   * Format alert message
   */
  private formatAlertMessage(rule: AlertRule, error: CapturedError, stats: ErrorStats[]): string {
    const lines = [
      `🚨 ${rule.name}`,
      '',
      `Error: ${error.message}`,
      `Category: ${error.category}`,
      `Severity: ${error.severity}`,
      `Service: ${error.serviceName}`,
      `Fingerprint: ${error.fingerprint}`,
      '',
    ];

    if (error.context.traceId) {
      lines.push(`Trace ID: ${error.context.traceId}`);
    }

    if (error.context.userId) {
      lines.push(`User ID: ${error.context.userId}`);
    }

    if (stats.length > 0) {
      const lastHour = stats[0];
      lines.push('');
      lines.push('Recent Stats:');
      lines.push(`  Last Hour: ${lastHour.error_count} errors, ${lastHour.affected_users} users`);
    }

    return lines.join('\n');
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(rule: AlertRule, message: string): Promise<void> {
    // TODO: Integrate with email service
    console.log('[ErrorAlerter] Email alert:', message);
    
    // In production, this would call your email service
    // For now, just log
    if (import.meta.env.DEV) {
      console.log('[ErrorAlerter] Would send email:', {
        to: process.env.ALERT_EMAIL || 'admin@example.com',
        subject: `[${rule.name}] Error Alert`,
        body: message,
      });
    }
  }

  /**
   * Send Slack alert
   */
  private async sendSlackAlert(rule: AlertRule, message: string): Promise<void> {
    // TODO: Integrate with Slack webhook
    console.log('[ErrorAlerter] Slack alert:', message);
    
    const webhookUrl = import.meta.env.VITE_SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      console.warn('[ErrorAlerter] Slack webhook URL not configured');
      return;
    }

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: message,
          username: 'Error Tracker',
          icon_emoji: ':warning:',
        }),
      });
    } catch (error) {
      console.error('[ErrorAlerter] Failed to send Slack alert:', error);
    }
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(rule: AlertRule, message: string): Promise<void> {
    // TODO: Integrate with custom webhook
    console.log('[ErrorAlerter] Webhook alert:', message);
    
    const webhookUrl = import.meta.env.VITE_ALERT_WEBHOOK_URL;
    if (!webhookUrl) {
      console.warn('[ErrorAlerter] Alert webhook URL not configured');
      return;
    }

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rule: rule.name,
          message,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error('[ErrorAlerter] Failed to send webhook alert:', error);
    }
  }

  /**
   * Add custom alert rule
   */
  addRule(rule: AlertRule): void {
    this.rules.push(rule);
  }

  /**
   * Remove alert rule
   */
  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(r => r.id !== ruleId);
  }
}

// Global error alerter instance
export const errorAlerter = new ErrorAlerter(defaultAlertRules);
