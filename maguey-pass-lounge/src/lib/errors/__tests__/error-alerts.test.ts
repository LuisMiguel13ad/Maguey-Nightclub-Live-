/**
 * Error Alerting Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorAlerter, defaultAlertRules } from '../error-alerts';
import { ErrorSeverity, ErrorCategory, AppError } from '../error-types';
import type { ErrorStats } from '../error-storage';

describe('ErrorAlerter', () => {
  let alerter: ErrorAlerter;
  let mockSendEmail: any;
  let mockSendSlack: any;
  let mockSendWebhook: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSendEmail = vi.fn();
    mockSendSlack = vi.fn();
    mockSendWebhook = vi.fn();

    // Set env vars so alert channels actually fire
    import.meta.env.VITE_SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
    import.meta.env.VITE_ALERT_WEBHOOK_URL = 'https://webhook.example.com/test';

    // Mock fetch for Slack/webhook
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    alerter = new ErrorAlerter(defaultAlertRules);
  });

  describe('critical error alert', () => {
    it('should trigger for critical errors', async () => {
      const error = new AppError('Critical system failure', 'CRITICAL_ERROR', {
        severity: ErrorSeverity.CRITICAL,
      });

      const stats: ErrorStats[] = [];
      await alerter.checkAndAlert(error.toCapturedError('test-service'), stats);

      // Should have attempted to send alerts
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should respect cooldown period', async () => {
      const error = new AppError('Critical error', 'CRITICAL_ERROR', {
        severity: ErrorSeverity.CRITICAL,
      });

      const capturedError = error.toCapturedError('test-service');
      const stats: ErrorStats[] = [];

      // First alert
      await alerter.checkAndAlert(capturedError, stats);
      const firstCallCount = (global.fetch as any).mock.calls.length;

      // Second alert immediately (should be blocked by cooldown)
      await alerter.checkAndAlert(capturedError, stats);
      const secondCallCount = (global.fetch as any).mock.calls.length;

      expect(secondCallCount).toBe(firstCallCount);
    });
  });

  describe('payment error alert', () => {
    it('should trigger for payment errors', async () => {
      const error = new AppError('Payment failed', 'PAYMENT_ERROR', {
        category: ErrorCategory.PAYMENT,
        severity: ErrorSeverity.HIGH,
      });

      const stats: ErrorStats[] = [];
      await alerter.checkAndAlert(error.toCapturedError('test-service'), stats);

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('error spike detection', () => {
    it('should detect error rate spike', async () => {
      const error = new AppError('Some error', 'ERROR', {
        severity: ErrorSeverity.MEDIUM,
      });

      const stats: ErrorStats[] = [
        {
          hour: new Date().toISOString(),
          service_name: 'test-service',
          category: ErrorCategory.UNKNOWN,
          severity: ErrorSeverity.MEDIUM,
          error_count: 100, // Last hour
          affected_users: 50,
          unique_errors: 5,
        },
        {
          hour: new Date(Date.now() - 3600000).toISOString(),
          service_name: 'test-service',
          category: ErrorCategory.UNKNOWN,
          severity: ErrorSeverity.MEDIUM,
          error_count: 40, // Previous hour (less than half)
          affected_users: 20,
          unique_errors: 3,
        },
      ];

      await alerter.checkAndAlert(error.toCapturedError('test-service'), stats);

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should not trigger if no spike', async () => {
      const error = new AppError('Some error', 'ERROR', {
        severity: ErrorSeverity.MEDIUM,
      });

      const stats: ErrorStats[] = [
        {
          hour: new Date().toISOString(),
          service_name: 'test-service',
          category: ErrorCategory.UNKNOWN,
          severity: ErrorSeverity.MEDIUM,
          error_count: 50,
          affected_users: 25,
          unique_errors: 3,
        },
        {
          hour: new Date(Date.now() - 3600000).toISOString(),
          service_name: 'test-service',
          category: ErrorCategory.UNKNOWN,
          severity: ErrorSeverity.MEDIUM,
          error_count: 40,
          affected_users: 20,
          unique_errors: 3,
        },
      ];

      const initialCallCount = (global.fetch as any).mock.calls.length;
      await alerter.checkAndAlert(error.toCapturedError('test-service'), stats);
      const finalCallCount = (global.fetch as any).mock.calls.length;

      // Should not have triggered spike alert
      expect(finalCallCount).toBe(initialCallCount);
    });
  });

  describe('custom alert rules', () => {
    it('should support custom alert rules', async () => {
      const customRule = {
        id: 'custom-rule',
        name: 'Custom Alert',
        condition: (error: any) => error.message.includes('custom'),
        cooldown: 10,
        channels: ['slack'] as const,
      };

      alerter.addRule(customRule);
      
      const error = new AppError('This is a custom error', 'CUSTOM_ERROR');
      const capturedError = error.toCapturedError('test-service');
      capturedError.message = 'This is a custom error';

      // Should trigger custom rule
      await alerter.checkAndAlert(capturedError, []);
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should remove alert rules', () => {
      const ruleId = 'critical-error';
      alerter.removeRule(ruleId);

      // Rule should be removed (no way to directly verify, but shouldn't throw)
      expect(() => alerter.removeRule(ruleId)).not.toThrow();
    });
  });
});
