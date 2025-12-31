/**
 * Error Tracker
 * 
 * Captures, processes, and stores errors with context and breadcrumbs.
 */

import { CapturedError, ErrorContext, ErrorSeverity, ErrorCategory, AppError } from './error-types';

export interface ErrorTrackerConfig {
  serviceName: string;
  environment: string;
  sampleRate?: number;  // 0.0 to 1.0
  beforeSend?: (error: CapturedError) => CapturedError | null;
  onError?: (error: CapturedError) => void;
  maxBreadcrumbs?: number;
}

interface Breadcrumb {
  type: 'navigation' | 'http' | 'ui' | 'user' | 'console';
  message: string;
  data?: Record<string, unknown>;
  timestamp: Date;
}

export class ErrorTracker {
  private config: Required<Omit<ErrorTrackerConfig, 'beforeSend' | 'onError'>> & {
    beforeSend?: (error: CapturedError) => CapturedError | null;
    onError?: (error: CapturedError) => void;
  };
  private errorBuffer: CapturedError[];
  private globalContext: ErrorContext;
  private breadcrumbs: Breadcrumb[];
  private user: { id: string; email?: string; name?: string } | null;

  constructor(config: ErrorTrackerConfig) {
    this.config = {
      serviceName: config.serviceName,
      environment: config.environment,
      sampleRate: config.sampleRate ?? 1.0,
      maxBreadcrumbs: config.maxBreadcrumbs ?? 100,
      beforeSend: config.beforeSend,
      onError: config.onError,
    };
    this.errorBuffer = [];
    this.globalContext = {};
    this.breadcrumbs = [];
    this.user = null;
  }

  /**
   * Capture an error
   */
  captureError(
    error: Error | string,
    options?: {
      severity?: ErrorSeverity;
      category?: ErrorCategory;
      context?: ErrorContext;
      tags?: Record<string, string>;
    }
  ): string {
    let capturedError: CapturedError;

    if (error instanceof AppError) {
      // Use AppError's built-in conversion
      capturedError = error.toCapturedError(this.config.serviceName, {
        ...this.globalContext,
        ...options?.context,
      });
    } else if (error instanceof Error) {
      // Convert standard Error to CapturedError
      capturedError = {
        id: crypto.randomUUID(),
        fingerprint: this.generateFingerprint(error, options?.category || ErrorCategory.UNKNOWN),
        message: error.message,
        stack: error.stack,
        category: options?.category || ErrorCategory.UNKNOWN,
        severity: options?.severity || ErrorSeverity.MEDIUM,
        context: {
          ...this.globalContext,
          ...options?.context,
        },
        tags: {
          errorType: error.constructor.name,
          ...options?.tags,
        },
        timestamp: new Date(),
        handled: false,
        serviceName: this.config.serviceName,
      };
    } else {
      // String error
      capturedError = {
        id: crypto.randomUUID(),
        fingerprint: this.generateFingerprint(
          new Error(error),
          options?.category || ErrorCategory.UNKNOWN
        ),
        message: error,
        category: options?.category || ErrorCategory.UNKNOWN,
        severity: options?.severity || ErrorSeverity.MEDIUM,
        context: {
          ...this.globalContext,
          ...options?.context,
        },
        tags: options?.tags || {},
        timestamp: new Date(),
        handled: false,
        serviceName: this.config.serviceName,
      };
    }

    // Add user context if available
    if (this.user) {
      capturedError.context.userId = this.user.id;
      if (this.user.email) {
        capturedError.context.userEmail = this.user.email;
      }
    }

    // Add breadcrumbs
    if (this.breadcrumbs.length > 0) {
      capturedError.context.breadcrumbs = this.breadcrumbs.slice(-20); // Last 20 breadcrumbs
    }

    // Apply beforeSend hook
    if (this.config.beforeSend) {
      const processed = this.config.beforeSend(capturedError);
      if (!processed) {
        // Error was filtered out
        return capturedError.id;
      }
      capturedError = processed;
    }

    // Check sampling
    if (Math.random() > this.config.sampleRate) {
      return capturedError.id;
    }

    // Add to buffer
    this.errorBuffer.push(capturedError);

    // Call onError hook
    if (this.config.onError) {
      this.config.onError(capturedError);
    }

    // Auto-flush if buffer is large
    if (this.errorBuffer.length >= 50) {
      this.flush().catch(err => {
        console.error('[ErrorTracker] Error flushing buffer:', err);
      });
    }

    return capturedError.id;
  }

  /**
   * Capture a message (non-error)
   */
  captureMessage(
    message: string,
    severity: ErrorSeverity = ErrorSeverity.LOW,
    context?: ErrorContext
  ): string {
    const capturedError: CapturedError = {
      id: crypto.randomUUID(),
      fingerprint: this.generateFingerprint(new Error(message), ErrorCategory.UNKNOWN),
      message,
      category: ErrorCategory.UNKNOWN,
      severity,
      context: {
        ...this.globalContext,
        ...context,
      },
      tags: {
        type: 'message',
      },
      timestamp: new Date(),
      handled: true,
      serviceName: this.config.serviceName,
    };

    // Add user context if available
    if (this.user) {
      capturedError.context.userId = this.user.id;
    }

    this.errorBuffer.push(capturedError);

    if (this.errorBuffer.length >= 50) {
      this.flush().catch(err => {
        console.error('[ErrorTracker] Error flushing buffer:', err);
      });
    }

    return capturedError.id;
  }

  /**
   * Set global context (user, session, etc.)
   */
  setGlobalContext(context: Partial<ErrorContext>): void {
    this.globalContext = {
      ...this.globalContext,
      ...context,
    };
  }

  /**
   * Clear global context
   */
  clearGlobalContext(): void {
    this.globalContext = {};
  }

  /**
   * Set user context
   */
  setUser(user: { id: string; email?: string; name?: string } | null): void {
    this.user = user;
    if (user) {
      this.setGlobalContext({ userId: user.id });
    } else {
      // Remove userId from global context when clearing user
      const { userId, ...rest } = this.globalContext;
      this.globalContext = rest;
    }
  }

  /**
   * Add breadcrumb for debugging
   */
  addBreadcrumb(breadcrumb: {
    type: 'navigation' | 'http' | 'ui' | 'user' | 'console';
    message: string;
    data?: Record<string, unknown>;
  }): void {
    this.breadcrumbs.push({
      ...breadcrumb,
      timestamp: new Date(),
    });

    // Limit breadcrumb count
    if (this.breadcrumbs.length > this.config.maxBreadcrumbs) {
      this.breadcrumbs.shift();
    }
  }

  /**
   * Clear breadcrumbs
   */
  clearBreadcrumbs(): void {
    this.breadcrumbs = [];
  }

  /**
   * Generate fingerprint for deduplication
   */
  private generateFingerprint(error: Error, category: ErrorCategory): string {
    // Use error message and category for fingerprinting
    const key = `${category}:${error.message}`;
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(16).padStart(16, '0');
  }

  /**
   * Parse and normalize stack trace
   */
  private parseStackTrace(stack?: string): string[] {
    if (!stack) return [];

    return stack
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('Error:'));
  }

  /**
   * Flush errors to storage
   */
  async flush(): Promise<void> {
    if (this.errorBuffer.length === 0) {
      return;
    }

    const errorsToFlush = [...this.errorBuffer];
    this.errorBuffer = [];

    // Import storage dynamically to avoid circular dependencies
    const { ErrorStorage } = await import('./error-storage');
    const { supabase } = await import('../supabase');
    
    const storage = new ErrorStorage(supabase);
    
    // Store errors in parallel
    await Promise.allSettled(
      errorsToFlush.map(error => storage.storeError(error))
    );
  }

  /**
   * Get current error buffer (for testing/debugging)
   */
  getBuffer(): ReadonlyArray<CapturedError> {
    return [...this.errorBuffer];
  }
}

// Global error tracker instance
const env =
  (typeof import.meta !== 'undefined' && (import.meta as any).env) ??
  (typeof process !== 'undefined' ? process.env : {});

export const errorTracker = new ErrorTracker({
  serviceName: 'maguey-gate-scanner',
  environment: env.MODE || env.NODE_ENV || 'development',
  sampleRate: env.MODE === 'production' ? 0.1 : 1.0, // Sample 10% in prod, 100% in dev
});
