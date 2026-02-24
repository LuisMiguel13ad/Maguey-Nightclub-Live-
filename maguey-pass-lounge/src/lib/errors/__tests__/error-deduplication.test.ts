/**
 * Error Deduplication Tests
 */

import { describe, it, expect } from 'vitest';
import { ErrorTracker } from '../error-tracker';
import { ValidationError, PaymentError } from '../error-types';

describe('Error Deduplication', () => {
  it('should generate same fingerprint for identical errors', () => {
    const tracker = new ErrorTracker({
      serviceName: 'test',
      environment: 'test',
    });

    const error1 = new ValidationError('Invalid email', 'email');
    const error2 = new ValidationError('Invalid email', 'email');

    tracker.captureError(error1);
    tracker.captureError(error2);

    const buffer = tracker.getBuffer();
    expect(buffer.length).toBe(2);
    expect(buffer[0].fingerprint).toBe(buffer[1].fingerprint);
  });

  it('should generate different fingerprints for different errors', () => {
    const tracker = new ErrorTracker({
      serviceName: 'test',
      environment: 'test',
    });

    const error1 = new ValidationError('Invalid email', 'email');
    const error2 = new PaymentError('Payment failed');

    tracker.captureError(error1);
    tracker.captureError(error2);

    const buffer = tracker.getBuffer();
    expect(buffer.length).toBe(2);
    expect(buffer[0].fingerprint).not.toBe(buffer[1].fingerprint);
  });

  it.skip('should generate different fingerprints for same message but different category', () => {
    const tracker = new ErrorTracker({
      serviceName: 'test',
      environment: 'test',
    });

    const error1 = new ValidationError('Invalid input');
    const error2 = new PaymentError('Invalid input');

    tracker.captureError(error1);
    tracker.captureError(error2);

    const buffer = tracker.getBuffer();
    expect(buffer.length).toBe(2);
    expect(buffer[0].fingerprint).not.toBe(buffer[1].fingerprint);
  });
});
