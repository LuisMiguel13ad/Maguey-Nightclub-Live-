/**
 * Error Tracker Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ErrorTracker } from '../error-tracker';
import { ErrorSeverity, ErrorCategory, AppError, ValidationError } from '../error-types';

describe('ErrorTracker', () => {
  let tracker: ErrorTracker;
  let mockStorage: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock error storage
    mockStorage = {
      storeError: vi.fn().mockResolvedValue('test-id'),
    };

    // Create tracker instance
    tracker = new ErrorTracker({
      serviceName: 'test-service',
      environment: 'test',
      sampleRate: 1.0,
    });
  });

  describe('captureError', () => {
    it('should capture AppError with context', () => {
      const error = new ValidationError('Invalid input', 'email');
      const errorId = tracker.captureError(error, {
        context: { userId: 'user-123' },
        category: ErrorCategory.VALIDATION, // Explicitly set category
      });

      expect(errorId).toBeDefined();
      const buffer = tracker.getBuffer();
      expect(buffer.length).toBe(1);
      expect(buffer[0].message).toBe('Invalid input');
      expect(buffer[0].category).toBe(ErrorCategory.VALIDATION);
      expect(buffer[0].context.userId).toBe('user-123');
    });

    it('should capture standard Error', () => {
      const error = new Error('Something went wrong');
      const errorId = tracker.captureError(error, {
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.UNKNOWN,
      });

      expect(errorId).toBeDefined();
      const buffer = tracker.getBuffer();
      expect(buffer.length).toBe(1);
      expect(buffer[0].message).toBe('Something went wrong');
      expect(buffer[0].severity).toBe(ErrorSeverity.HIGH);
    });

    it('should capture string error', () => {
      const errorId = tracker.captureError('String error', {
        severity: ErrorSeverity.LOW,
      });

      expect(errorId).toBeDefined();
      const buffer = tracker.getBuffer();
      expect(buffer.length).toBe(1);
      expect(buffer[0].message).toBe('String error');
    });

    it('should respect sample rate', () => {
      const lowSampleTracker = new ErrorTracker({
        serviceName: 'test',
        environment: 'test',
        sampleRate: 0.0, // Sample nothing
      });

      lowSampleTracker.captureError(new Error('Test'));
      expect(lowSampleTracker.getBuffer().length).toBe(0);
    });

    it('should apply beforeSend hook', () => {
      const filteredTracker = new ErrorTracker({
        serviceName: 'test',
        environment: 'test',
        beforeSend: (error) => {
          // Filter out errors with "filtered" in message
          if (error.message.includes('filtered')) {
            return null;
          }
          return error;
        },
      });

      filteredTracker.captureError(new Error('This should be filtered'));
      filteredTracker.captureError(new Error('This should pass'));

      expect(filteredTracker.getBuffer().length).toBe(1);
      expect(filteredTracker.getBuffer()[0].message).toBe('This should pass');
    });
  });

  describe('captureMessage', () => {
    it('should capture non-error messages', () => {
      const messageId = tracker.captureMessage('Info message', ErrorSeverity.LOW);
      
      expect(messageId).toBeDefined();
      const buffer = tracker.getBuffer();
      expect(buffer.length).toBe(1);
      expect(buffer[0].message).toBe('Info message');
      expect(buffer[0].handled).toBe(true);
      expect(buffer[0].tags.type).toBe('message');
    });
  });

  describe('breadcrumbs', () => {
    it('should add breadcrumbs', () => {
      tracker.addBreadcrumb({
        type: 'navigation',
        message: 'User navigated to /checkout',
        data: { url: '/checkout' },
      });

      tracker.captureError(new Error('Checkout error'));

      const buffer = tracker.getBuffer();
      expect(buffer[0].context.breadcrumbs).toBeDefined();
      expect(Array.isArray(buffer[0].context.breadcrumbs)).toBe(true);
    });

    it('should limit breadcrumb count', () => {
      const limitedTracker = new ErrorTracker({
        serviceName: 'test',
        environment: 'test',
        maxBreadcrumbs: 5,
      });

      for (let i = 0; i < 10; i++) {
        limitedTracker.addBreadcrumb({
          type: 'user',
          message: `Action ${i}`,
        });
      }

      limitedTracker.captureError(new Error('Error'));
      const buffer = limitedTracker.getBuffer();
      const breadcrumbs = buffer[0].context.breadcrumbs as any[];
      expect(breadcrumbs.length).toBeLessThanOrEqual(5);
    });
  });

  describe('user context', () => {
    it('should include user context in errors', () => {
      tracker.setUser({ id: 'user-123', email: 'test@example.com' });
      tracker.captureError(new Error('User error'));

      const buffer = tracker.getBuffer();
      expect(buffer[0].context.userId).toBe('user-123');
      expect(buffer[0].context.userEmail).toBe('test@example.com');
    });

    it('should clear user context', () => {
      tracker.setUser({ id: 'user-123' });
      tracker.setUser(null);
      tracker.clearGlobalContext(); // Clear global context that might have userId
      tracker.captureError(new Error('Error'));

      const buffer = tracker.getBuffer();
      // User context should not be included after clearing
      expect(buffer[0].context.userId).toBeUndefined();
    });
  });

  describe('global context', () => {
    it('should include global context in errors', () => {
      tracker.setGlobalContext({ requestId: 'req-123', traceId: 'trace-456' });
      tracker.captureError(new Error('Error'));

      const buffer = tracker.getBuffer();
      expect(buffer[0].context.requestId).toBe('req-123');
      expect(buffer[0].context.traceId).toBe('trace-456');
    });
  });
});
