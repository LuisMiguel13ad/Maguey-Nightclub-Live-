import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handlePaymentError, PaymentErrorType } from '../../lib/payment-errors';
import { toast } from 'sonner';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

describe('Payment Error Handling', () => {
  const mockSetIsLoading = vi.fn();
  const mockOnRetry = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('handlePaymentError', () => {
    it('shows toast with user-friendly message for card declined', () => {
      const error = new Error('Your card was declined.');

      handlePaymentError(error, {
        onRetry: mockOnRetry,
        setIsLoading: mockSetIsLoading,
        paymentType: 'ga_ticket',
      });

      expect(toast.error).toHaveBeenCalledWith(
        'Payment failed. Please try again.',
        expect.objectContaining({
          duration: 5000,
          action: expect.objectContaining({
            label: 'Retry',
          }),
        })
      );
    });

    it('shows generic message for unknown errors', () => {
      const error = new Error('Something completely unexpected happened');

      handlePaymentError(error, {
        onRetry: mockOnRetry,
        setIsLoading: mockSetIsLoading,
        paymentType: 'ga_ticket',
      });

      expect(toast.error).toHaveBeenCalledWith(
        'Payment failed. Please try again.',
        expect.any(Object)
      );
    });

    it('shows network message for connection errors', () => {
      const error = new Error('fetch failed: network timeout');

      handlePaymentError(error, {
        onRetry: mockOnRetry,
        setIsLoading: mockSetIsLoading,
        paymentType: 'ga_ticket',
      });

      // Network errors should show connection message
      expect(toast.error).toHaveBeenCalledWith(
        'Connection issue. Please try again.',
        expect.any(Object)
      );
    });

    it('logs error details for debugging', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Test error for logging');

      handlePaymentError(error, {
        onRetry: mockOnRetry,
        setIsLoading: mockSetIsLoading,
        paymentType: 'ga_ticket',
        eventId: 'event-123',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Payment Error]',
        expect.objectContaining({
          paymentType: 'ga_ticket',
          eventId: 'event-123',
        })
      );
    });

    it('logs error type in console output', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('card_declined');

      handlePaymentError(error, {
        onRetry: mockOnRetry,
        setIsLoading: mockSetIsLoading,
        paymentType: 'ga_ticket',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Payment Error]',
        expect.objectContaining({
          type: 'card_declined',
        })
      );
    });

    it('calls setIsLoading(true) when retry is clicked', () => {
      handlePaymentError(new Error('Test error'), {
        onRetry: mockOnRetry,
        setIsLoading: mockSetIsLoading,
        paymentType: 'ga_ticket',
      });

      // Get the action onClick handler from the toast.error call
      const toastCall = vi.mocked(toast.error).mock.calls[0];
      const toastOptions = toastCall[1] as { action: { onClick: () => void } };
      const actionOnClick = toastOptions.action.onClick;

      // Simulate clicking retry
      actionOnClick();

      expect(mockSetIsLoading).toHaveBeenCalledWith(true);
      expect(mockOnRetry).toHaveBeenCalled();
    });

    it('passes customer email to logging (truncated for privacy)', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Test error');

      handlePaymentError(error, {
        onRetry: mockOnRetry,
        setIsLoading: mockSetIsLoading,
        paymentType: 'ga_ticket',
        customerEmail: 'test@example.com',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Payment Error]',
        expect.objectContaining({
          customerEmail: 'tes...', // Truncated for privacy
        })
      );
    });
  });

  describe('Error categorization', () => {
    const testCases: Array<{ input: string; expectedType: PaymentErrorType; expectedMessage: string }> = [
      // Card declined variations
      { input: 'card_declined', expectedType: 'card_declined', expectedMessage: 'Payment failed. Please try again.' },
      { input: 'Your card was declined', expectedType: 'card_declined', expectedMessage: 'Payment failed. Please try again.' },
      { input: 'The card has been declined', expectedType: 'card_declined', expectedMessage: 'Payment failed. Please try again.' },

      // Insufficient funds variations
      { input: 'insufficient_funds', expectedType: 'insufficient_funds', expectedMessage: 'Payment failed. Please try again.' },
      { input: 'Your card has insufficient funds', expectedType: 'insufficient_funds', expectedMessage: 'Payment failed. Please try again.' },

      // Expired card variations (must contain "expired" per payment-errors.ts)
      { input: 'expired_card', expectedType: 'expired_card', expectedMessage: 'Payment failed. Please try again.' },
      { input: 'Your card has expired', expectedType: 'expired_card', expectedMessage: 'Payment failed. Please try again.' },
      { input: 'Card is expired', expectedType: 'expired_card', expectedMessage: 'Payment failed. Please try again.' },

      // Processing errors
      { input: 'processing_error', expectedType: 'processing_error', expectedMessage: 'Payment failed. Please try again.' },
      { input: 'Please try again later', expectedType: 'processing_error', expectedMessage: 'Payment failed. Please try again.' },

      // Network errors
      { input: 'network error', expectedType: 'network_error', expectedMessage: 'Connection issue. Please try again.' },
      { input: 'fetch failed', expectedType: 'network_error', expectedMessage: 'Connection issue. Please try again.' },
      { input: 'Request timeout', expectedType: 'network_error', expectedMessage: 'Connection issue. Please try again.' },

      // Unknown errors (fallback)
      { input: 'random unexpected error', expectedType: 'unknown', expectedMessage: 'Payment failed. Please try again.' },
      { input: 'something went wrong', expectedType: 'unknown', expectedMessage: 'Payment failed. Please try again.' },
    ];

    testCases.forEach(({ input, expectedType, expectedMessage }) => {
      it(`categorizes "${input}" and shows appropriate message`, () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        handlePaymentError(new Error(input), {
          onRetry: mockOnRetry,
          setIsLoading: mockSetIsLoading,
          paymentType: 'ga_ticket',
        });

        // Verify toast is shown with expected message
        expect(toast.error).toHaveBeenCalledWith(
          expectedMessage,
          expect.any(Object)
        );

        // Verify the error type is logged
        expect(consoleSpy).toHaveBeenCalledWith(
          '[Payment Error]',
          expect.objectContaining({
            type: expectedType,
          })
        );
      });
    });
  });

  describe('Toast configuration', () => {
    it('sets toast duration to 5000ms (5 seconds)', () => {
      handlePaymentError(new Error('Test'), {
        onRetry: mockOnRetry,
        setIsLoading: mockSetIsLoading,
        paymentType: 'ga_ticket',
      });

      expect(toast.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          duration: 5000,
        })
      );
    });

    it('includes retry action with correct label', () => {
      handlePaymentError(new Error('Test'), {
        onRetry: mockOnRetry,
        setIsLoading: mockSetIsLoading,
        paymentType: 'ga_ticket',
      });

      expect(toast.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          action: expect.objectContaining({
            label: 'Retry',
          }),
        })
      );
    });

    it('action onClick triggers both setIsLoading and onRetry', () => {
      handlePaymentError(new Error('Test'), {
        onRetry: mockOnRetry,
        setIsLoading: mockSetIsLoading,
        paymentType: 'ga_ticket',
      });

      const toastCall = vi.mocked(toast.error).mock.calls[0];
      const toastOptions = toastCall[1] as { action: { onClick: () => void } };
      toastOptions.action.onClick();

      // setIsLoading should be called BEFORE onRetry
      expect(mockSetIsLoading).toHaveBeenCalledWith(true);
      expect(mockOnRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('Payment types', () => {
    it('handles ga_ticket payment type', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      handlePaymentError(new Error('Test'), {
        onRetry: mockOnRetry,
        setIsLoading: mockSetIsLoading,
        paymentType: 'ga_ticket',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Payment Error]',
        expect.objectContaining({
          paymentType: 'ga_ticket',
        })
      );
    });

    it('handles vip_reservation payment type', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      handlePaymentError(new Error('Test'), {
        onRetry: mockOnRetry,
        setIsLoading: mockSetIsLoading,
        paymentType: 'vip_reservation',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Payment Error]',
        expect.objectContaining({
          paymentType: 'vip_reservation',
        })
      );
    });
  });
});

describe('Error message user-friendliness', () => {
  const mockSetIsLoading = vi.fn();
  const mockOnRetry = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not expose technical error details to users', () => {
    const technicalErrors = [
      'Error: ECONNREFUSED 127.0.0.1:54321',
      'TypeError: Cannot read property of undefined',
      'SyntaxError: Unexpected token',
      'ReferenceError: supabase is not defined',
      'Error: stripe.paymentIntents.create failed with status 500',
    ];

    technicalErrors.forEach((errorMsg) => {
      vi.clearAllMocks();

      handlePaymentError(new Error(errorMsg), {
        onRetry: mockOnRetry,
        setIsLoading: mockSetIsLoading,
        paymentType: 'ga_ticket',
      });

      const toastCall = vi.mocked(toast.error).mock.calls[0];
      const displayedMessage = toastCall[0] as string;

      // Message should be user-friendly, not technical
      expect(displayedMessage).toMatch(/payment failed|connection issue/i);
      expect(displayedMessage).not.toContain('ECONNREFUSED');
      expect(displayedMessage).not.toContain('TypeError');
      expect(displayedMessage).not.toContain('undefined');
      expect(displayedMessage).not.toContain('500');
    });
  });

  it('shows simple actionable messages', () => {
    handlePaymentError(new Error('card_declined'), {
      onRetry: mockOnRetry,
      setIsLoading: mockSetIsLoading,
      paymentType: 'ga_ticket',
    });

    const toastCall = vi.mocked(toast.error).mock.calls[0];
    const displayedMessage = toastCall[0] as string;

    // Message should be short and actionable
    expect(displayedMessage.length).toBeLessThan(50);
    expect(displayedMessage).toContain('try again');
  });
});

describe('Retry behavior', () => {
  const mockSetIsLoading = vi.fn();
  const mockOnRetry = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows unlimited retries (no retry counter)', () => {
    // Simulate multiple error-retry cycles
    for (let i = 0; i < 10; i++) {
      vi.clearAllMocks();

      handlePaymentError(new Error('Test error'), {
        onRetry: mockOnRetry,
        setIsLoading: mockSetIsLoading,
        paymentType: 'ga_ticket',
      });

      // Each time, toast should be shown with retry option
      expect(toast.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          action: expect.objectContaining({
            label: 'Retry',
          }),
        })
      );

      // Simulate clicking retry
      const toastCall = vi.mocked(toast.error).mock.calls[0];
      const toastOptions = toastCall[1] as { action: { onClick: () => void } };
      toastOptions.action.onClick();

      // Retry should always be callable
      expect(mockOnRetry).toHaveBeenCalled();
    }
  });

  it('sets loading state before calling retry function', () => {
    const callOrder: string[] = [];

    const trackingSetIsLoading = vi.fn((loading: boolean) => {
      if (loading) callOrder.push('setIsLoading');
    });

    const trackingOnRetry = vi.fn(() => {
      callOrder.push('onRetry');
    });

    handlePaymentError(new Error('Test'), {
      onRetry: trackingOnRetry,
      setIsLoading: trackingSetIsLoading,
      paymentType: 'ga_ticket',
    });

    const toastCall = vi.mocked(toast.error).mock.calls[0];
    const toastOptions = toastCall[1] as { action: { onClick: () => void } };
    toastOptions.action.onClick();

    // setIsLoading should be called before onRetry
    expect(callOrder).toEqual(['setIsLoading', 'onRetry']);
  });
});
