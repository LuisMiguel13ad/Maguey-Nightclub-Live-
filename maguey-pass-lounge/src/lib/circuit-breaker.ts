/**
 * Circuit Breaker Pattern Implementation
 * 
 * Protects against cascading failures when external services are down.
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is down, requests fail fast
 * - HALF_OPEN: Testing if service has recovered
 * 
 * Features:
 * - Automatic state transitions based on failure/success thresholds
 * - Configurable timeouts and retry logic
 * - State change event listeners for monitoring
 * - Detailed statistics for dashboard display
 * 
 * @example
 * ```typescript
 * const result = await stripeCircuit.execute(async () => {
 *   return await createCheckoutSession(orderData);
 * });
 * ```
 */

import { createLogger } from './logger';
import { metrics } from './monitoring';

const logger = createLogger({ module: 'circuit-breaker' });

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

// ============================================
// State Change Event System
// ============================================

export interface CircuitStateChangeEvent {
  circuitName: string;
  previousState: CircuitState;
  newState: CircuitState;
  timestamp: Date;
  failures: number;
  reason?: string;
}

type StateChangeListener = (event: CircuitStateChangeEvent) => void;

// Global state change listeners
const stateChangeListeners: StateChangeListener[] = [];

/**
 * Subscribe to circuit breaker state changes
 */
export function onCircuitStateChange(listener: StateChangeListener): () => void {
  stateChangeListeners.push(listener);
  return () => {
    const index = stateChangeListeners.indexOf(listener);
    if (index > -1) {
      stateChangeListeners.splice(index, 1);
    }
  };
}

/**
 * Notify all listeners of a state change
 */
function notifyStateChange(event: CircuitStateChangeEvent): void {
  // Log all state changes
  logger.info(`Circuit breaker state change: ${event.circuitName}`, {
    from: event.previousState,
    to: event.newState,
    failures: event.failures,
    reason: event.reason,
  });
  
  // Notify all listeners
  for (const listener of stateChangeListeners) {
    try {
      listener(event);
    } catch (error) {
      logger.error('State change listener error', { error });
    }
  }
}

// State change history for dashboard
const stateChangeHistory: CircuitStateChangeEvent[] = [];
const MAX_HISTORY_SIZE = 100;

/**
 * Get recent state change history
 */
export function getStateChangeHistory(limit = 50): CircuitStateChangeEvent[] {
  return stateChangeHistory.slice(-limit);
}

export interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening the circuit */
  failureThreshold: number;
  /** Time in milliseconds before attempting to close the circuit */
  resetTimeoutMs: number;
  /** Number of successful requests needed in HALF_OPEN state to close circuit */
  halfOpenRequests: number;
  /** Optional callback when state changes */
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
  /** Optional: specific error types that should trigger the circuit breaker */
  tripOnErrors?: Array<new (...args: any[]) => Error>;
  /** Optional: error types that should NOT trigger the circuit breaker */
  ignoreErrors?: Array<new (...args: any[]) => Error>;
}

export class CircuitBreakerError extends Error {
  constructor(
    public readonly circuitName: string,
    public readonly state: CircuitState,
    message?: string
  ) {
    super(message || `Circuit breaker '${circuitName}' is ${state}`);
    this.name = 'CircuitBreakerError';
  }
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private halfOpenSuccesses: number = 0;
  private halfOpenFailures: number = 0;

  constructor(
    private readonly name: string,
    private readonly options: CircuitBreakerOptions
  ) {
    logger.info(`Circuit breaker '${name}' initialized`, {
      failureThreshold: options.failureThreshold,
      resetTimeoutMs: options.resetTimeoutMs,
      halfOpenRequests: options.halfOpenRequests,
    });
  }

  /**
   * Execute a function through the circuit breaker
   * @param fn - The async function to execute
   * @returns The result of the function
   * @throws CircuitBreakerError if circuit is open
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if we should allow the request
    if (!this.canExecute()) {
      const error = new CircuitBreakerError(
        this.name,
        this.state,
        `Circuit breaker '${this.name}' is OPEN. Service unavailable. Will retry after ${this.getTimeUntilRetry()}ms`
      );
      
      logger.warn(`Circuit breaker '${this.name}' rejected request`, {
        state: this.state,
        failures: this.failures,
        timeUntilRetry: this.getTimeUntilRetry(),
      });
      
      metrics.increment('circuit_breaker.rejected', 1, { circuit: this.name });
      throw error;
    }

    const startTime = Date.now();
    
    try {
      const result = await fn();
      this.onSuccess();
      
      metrics.timing('circuit_breaker.execution_time', Date.now() - startTime, { 
        circuit: this.name,
        success: 'true',
      });
      
      return result;
    } catch (error) {
      // Check if this error should trigger the circuit breaker
      if (this.shouldTripOn(error)) {
        this.onFailure(error);
        
        metrics.timing('circuit_breaker.execution_time', Date.now() - startTime, { 
          circuit: this.name,
          success: 'false',
        });
      }
      
      throw error;
    }
  }

  /**
   * Get the current state of the circuit breaker
   */
  getState(): CircuitState {
    // Check if we should transition from OPEN to HALF_OPEN
    if (this.state === 'OPEN' && this.shouldAttemptReset()) {
      this.transitionTo('HALF_OPEN', 'Reset timeout elapsed, testing service');
    }
    return this.state;
  }

  /**
   * Get statistics about the circuit breaker
   */
  getStats(): {
    name: string;
    state: CircuitState;
    failures: number;
    lastFailureTime: number;
    timeUntilRetry: number;
    halfOpenSuccesses: number;
    halfOpenFailures: number;
  } {
    return {
      name: this.name,
      state: this.getState(),
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
      timeUntilRetry: this.getTimeUntilRetry(),
      halfOpenSuccesses: this.halfOpenSuccesses,
      halfOpenFailures: this.halfOpenFailures,
    };
  }

  /**
   * Force the circuit to open (e.g., for maintenance)
   */
  forceOpen(): void {
    logger.warn(`Circuit breaker '${this.name}' force opened`);
    this.transitionTo('OPEN', 'Manual force open');
    this.lastFailureTime = Date.now();
    metrics.increment('circuit_breaker.force_opened', 1, { circuit: this.name });
  }

  /**
   * Force the circuit to close (e.g., for recovery)
   */
  forceClose(): void {
    logger.info(`Circuit breaker '${this.name}' force closed`);
    this.transitionTo('CLOSED', 'Manual force close');
    this.failures = 0;
    this.lastFailureTime = 0;
    this.halfOpenSuccesses = 0;
    this.halfOpenFailures = 0;
    metrics.increment('circuit_breaker.force_closed', 1, { circuit: this.name });
  }

  /**
   * Reset the circuit breaker to initial state
   */
  reset(): void {
    this.transitionTo('CLOSED', 'Circuit recovered');
    this.failures = 0;
    this.lastFailureTime = 0;
    this.halfOpenSuccesses = 0;
    this.halfOpenFailures = 0;
  }

  /**
   * Check if an execution can proceed
   */
  private canExecute(): boolean {
    const currentState = this.getState();
    
    switch (currentState) {
      case 'CLOSED':
        return true;
      case 'OPEN':
        return false;
      case 'HALF_OPEN':
        // In HALF_OPEN, allow limited requests to test the service
        return true;
      default:
        return false;
    }
  }

  /**
   * Handle a successful execution
   */
  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.halfOpenSuccesses++;
      
      logger.debug(`Circuit breaker '${this.name}' half-open success`, {
        successes: this.halfOpenSuccesses,
        required: this.options.halfOpenRequests,
      });
      
      // If we've had enough successes, close the circuit
      if (this.halfOpenSuccesses >= this.options.halfOpenRequests) {
        logger.info(`Circuit breaker '${this.name}' recovered, closing circuit`);
        this.reset();
        metrics.increment('circuit_breaker.recovered', 1, { circuit: this.name });
      }
    } else if (this.state === 'CLOSED') {
      // Reset failure count on success when closed
      if (this.failures > 0) {
        this.failures = 0;
      }
    }
    
    metrics.increment('circuit_breaker.success', 1, { circuit: this.name });
  }

  /**
   * Handle a failed execution
   */
  private onFailure(error: unknown): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.warn(`Circuit breaker '${this.name}' recorded failure`, {
      failures: this.failures,
      threshold: this.options.failureThreshold,
      state: this.state,
      error: errorMessage,
    });
    
    metrics.increment('circuit_breaker.failure', 1, { circuit: this.name });

    if (this.state === 'HALF_OPEN') {
      // Any failure in HALF_OPEN immediately opens the circuit
      this.halfOpenFailures++;
      logger.warn(`Circuit breaker '${this.name}' failed in half-open state, reopening`);
      this.transitionTo('OPEN', `Failed during half-open test: ${errorMessage}`);
      metrics.increment('circuit_breaker.half_open_failure', 1, { circuit: this.name });
    } else if (this.state === 'CLOSED' && this.failures >= this.options.failureThreshold) {
      // Threshold exceeded, open the circuit
      logger.error(`Circuit breaker '${this.name}' threshold exceeded, opening circuit`, {
        failures: this.failures,
        threshold: this.options.failureThreshold,
      });
      this.transitionTo('OPEN', `Failure threshold exceeded (${this.failures}/${this.options.failureThreshold})`);
      metrics.increment('circuit_breaker.opened', 1, { circuit: this.name });
    }
  }

  /**
   * Check if enough time has passed to attempt a reset
   */
  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime >= this.options.resetTimeoutMs;
  }

  /**
   * Get time remaining until reset attempt
   */
  private getTimeUntilRetry(): number {
    if (this.state !== 'OPEN') return 0;
    const elapsed = Date.now() - this.lastFailureTime;
    return Math.max(0, this.options.resetTimeoutMs - elapsed);
  }

  /**
   * Check if an error should trigger the circuit breaker
   */
  private shouldTripOn(error: unknown): boolean {
    if (!(error instanceof Error)) return true;

    // If ignoreErrors is specified, check if this error should be ignored
    if (this.options.ignoreErrors?.length) {
      for (const ErrorType of this.options.ignoreErrors) {
        if (error instanceof ErrorType) {
          return false;
        }
      }
    }

    // If tripOnErrors is specified, only trip on those errors
    if (this.options.tripOnErrors?.length) {
      for (const ErrorType of this.options.tripOnErrors) {
        if (error instanceof ErrorType) {
          return true;
        }
      }
      return false;
    }

    // By default, all errors trigger the circuit breaker
    return true;
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState, reason?: string): void {
    if (this.state === newState) return;

    const previousState = this.state;
    this.state = newState;

    // Reset half-open counters when entering HALF_OPEN state
    if (newState === 'HALF_OPEN') {
      this.halfOpenSuccesses = 0;
      this.halfOpenFailures = 0;
    }

    // Create state change event
    const event: CircuitStateChangeEvent = {
      circuitName: this.name,
      previousState,
      newState,
      timestamp: new Date(),
      failures: this.failures,
      reason,
    };

    // Add to history
    stateChangeHistory.push(event);
    if (stateChangeHistory.length > MAX_HISTORY_SIZE) {
      stateChangeHistory.shift();
    }

    // Notify global listeners
    notifyStateChange(event);

    metrics.increment('circuit_breaker.state_change', 1, { 
      circuit: this.name,
      from: previousState,
      to: newState,
    });

    // Call the optional callback
    this.options.onStateChange?.(previousState, newState);
  }
}

// ============================================
// Pre-configured Circuit Breakers
// ============================================

/**
 * Circuit breaker for Stripe API calls
 * - Opens after 5 consecutive failures
 * - Waits 30 seconds before retrying
 * - Needs 2 successful requests to close
 */
export const stripeCircuit = new CircuitBreaker('stripe', {
  failureThreshold: 5,
  resetTimeoutMs: 30000, // 30 seconds
  halfOpenRequests: 2,
  onStateChange: (from, to) => {
    if (to === 'OPEN') {
      logger.error('Stripe circuit breaker OPENED - payment processing unavailable');
    } else if (from === 'OPEN' && to === 'CLOSED') {
      logger.info('Stripe circuit breaker recovered - payment processing restored');
    }
  },
});

/**
 * Circuit breaker for email service (Resend API)
 * - Opens after 3 consecutive failures
 * - Waits 60 seconds before retrying
 * - Needs 1 successful request to close
 */
export const emailCircuit = new CircuitBreaker('email', {
  failureThreshold: 3,
  resetTimeoutMs: 60000, // 1 minute
  halfOpenRequests: 1,
  onStateChange: (from, to) => {
    if (to === 'OPEN') {
      logger.warn('Email circuit breaker OPENED - email delivery unavailable');
    } else if (from === 'OPEN' && to === 'CLOSED') {
      logger.info('Email circuit breaker recovered - email delivery restored');
    }
  },
});

/**
 * Circuit breaker for Supabase database calls
 * - Opens after 10 consecutive failures (more tolerant)
 * - Waits 15 seconds before retrying
 * - Needs 3 successful requests to close
 */
export const supabaseCircuit = new CircuitBreaker('supabase', {
  failureThreshold: 10,
  resetTimeoutMs: 15000, // 15 seconds
  halfOpenRequests: 3,
  onStateChange: (from, to) => {
    if (to === 'OPEN') {
      logger.error('Supabase circuit breaker OPENED - database unavailable');
    } else if (from === 'OPEN' && to === 'CLOSED') {
      logger.info('Supabase circuit breaker recovered - database restored');
    }
  },
});

/**
 * Factory function to create a custom circuit breaker
 */
export function createCircuitBreaker(
  name: string,
  options: Partial<CircuitBreakerOptions> = {}
): CircuitBreaker {
  return new CircuitBreaker(name, {
    failureThreshold: options.failureThreshold ?? 5,
    resetTimeoutMs: options.resetTimeoutMs ?? 30000,
    halfOpenRequests: options.halfOpenRequests ?? 2,
    ...options,
  });
}

/**
 * Utility to wrap an async function with a circuit breaker
 */
export function withCircuitBreaker<TArgs extends any[], TResult>(
  circuit: CircuitBreaker,
  fn: (...args: TArgs) => Promise<TResult>
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    return circuit.execute(() => fn(...args));
  };
}

/**
 * Get the status of all circuit breakers
 */
export function getAllCircuitBreakerStats(): Array<ReturnType<CircuitBreaker['getStats']>> {
  return [
    stripeCircuit.getStats(),
    emailCircuit.getStats(),
    supabaseCircuit.getStats(),
  ];
}
