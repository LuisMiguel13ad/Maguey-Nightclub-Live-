/**
 * Saga Engine
 * 
 * Implements the Saga pattern for distributed transactions.
 * Each saga consists of a sequence of steps that can be compensated (rolled back)
 * if a later step fails.
 * 
 * @example
 * const saga = new SagaOrchestrator([
 *   { name: 'ReserveInventory', execute: reserveInventory, compensate: releaseInventory },
 *   { name: 'CreateOrder', execute: createOrder, compensate: cancelOrder },
 *   { name: 'SendEmail', execute: sendEmail, compensate: noOp }, // No compensation needed
 * ]);
 * 
 * const result = await saga.execute(initialContext);
 * if (!result.success) {
 *   console.error('Saga failed at step:', result.failedStep);
 * }
 */

import { createLogger } from '../logger';
import { metrics, startTimer } from '../monitoring';

// ============================================
// TYPES
// ============================================

/**
 * A single step in a saga
 */
export interface SagaStep<TContext> {
  /** Unique name for the step */
  name: string;
  
  /** 
   * Execute the step's action
   * @param context - Current saga context
   * @returns Updated context with any new data from this step
   */
  execute: (context: TContext) => Promise<TContext>;
  
  /**
   * Compensate (rollback) the step's action
   * Called if a later step fails
   * @param context - Context at the time of compensation
   */
  compensate: (context: TContext) => Promise<void>;
  
  /**
   * Optional: Whether this step is critical
   * If true, saga will fail if this step fails
   * If false, saga will continue even if this step fails (with warning)
   * Default: true
   */
  critical?: boolean;
  
  /**
   * Optional: Number of retries before failing
   * Default: 0 (no retries)
   */
  retries?: number;
  
  /**
   * Optional: Delay between retries in ms
   * Default: 1000 (1 second)
   */
  retryDelayMs?: number;
}

/**
 * Result of saga execution
 */
export interface SagaResult<TContext> {
  /** Whether the saga completed successfully */
  success: boolean;
  
  /** Final context after all steps (or partial context on failure) */
  context: TContext;
  
  /** Names of steps that completed successfully */
  completedSteps: string[];
  
  /** Name of the step that failed (if any) */
  failedStep?: string;
  
  /** Error that caused the failure */
  error?: Error;
  
  /** Names of steps that were compensated */
  compensatedSteps?: string[];
  
  /** Compensation errors (if any) */
  compensationErrors?: Array<{ step: string; error: Error }>;
  
  /** Total execution time in ms */
  durationMs: number;
  
  /** Unique ID for this saga execution */
  sagaId: string;
}

/**
 * Saga execution status
 */
export type SagaStatus = 
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'compensating'
  | 'compensated'
  | 'compensation_failed';

/**
 * Saga execution record for persistence
 */
export interface SagaExecution<TContext> {
  sagaId: string;
  sagaName: string;
  status: SagaStatus;
  stepsCompleted: string[];
  currentStep?: string;
  contextSnapshot: TContext;
  errorDetails?: {
    step: string;
    message: string;
    stack?: string;
  };
  compensationErrors?: Array<{
    step: string;
    message: string;
  }>;
  startedAt: Date;
  completedAt?: Date;
}

/**
 * Options for saga execution
 */
export interface SagaOptions {
  /** Custom saga ID (auto-generated if not provided) */
  sagaId?: string;
  
  /** Whether to persist saga state */
  persist?: boolean;
  
  /** Callback for state changes */
  onStateChange?: (execution: SagaExecution<unknown>) => void | Promise<void>;
  
  /** Timeout for entire saga in ms */
  timeoutMs?: number;
}

// ============================================
// SAGA ORCHESTRATOR
// ============================================

export class SagaOrchestrator<TContext extends Record<string, unknown>> {
  private logger = createLogger({ module: 'saga-engine' });
  private steps: SagaStep<TContext>[];
  private sagaName: string;

  constructor(
    steps: SagaStep<TContext>[],
    sagaName: string = 'UnnamedSaga'
  ) {
    this.steps = steps;
    this.sagaName = sagaName;
  }

  /**
   * Execute the saga with the given initial context
   */
  async execute(
    initialContext: TContext,
    options: SagaOptions = {}
  ): Promise<SagaResult<TContext>> {
    const sagaTimer = startTimer();
    const sagaId = options.sagaId || this.generateSagaId();
    const sagaLogger = this.logger.child({ sagaId, sagaName: this.sagaName });
    
    sagaLogger.info('Saga execution started', { 
      stepCount: this.steps.length,
      steps: this.steps.map(s => s.name),
    });
    
    metrics.increment('saga.executions.started', 1, { saga: this.sagaName });
    
    let context = { ...initialContext };
    const completedSteps: string[] = [];
    const compensatedSteps: string[] = [];
    const compensationErrors: Array<{ step: string; error: Error }> = [];
    
    // Create execution record
    const execution: SagaExecution<TContext> = {
      sagaId,
      sagaName: this.sagaName,
      status: 'running',
      stepsCompleted: [],
      contextSnapshot: context,
      startedAt: new Date(),
    };
    
    await this.notifyStateChange(execution, options);

    try {
      // Execute each step in order
      for (const step of this.steps) {
        execution.currentStep = step.name;
        await this.notifyStateChange(execution, options);
        
        sagaLogger.debug(`Executing step: ${step.name}`);
        const stepTimer = startTimer();
        
        try {
          context = await this.executeStepWithRetry(step, context, sagaLogger);
          
          completedSteps.push(step.name);
          execution.stepsCompleted = [...completedSteps];
          execution.contextSnapshot = context;
          
          const stepDuration = stepTimer();
          metrics.timing('saga.step.duration', stepDuration, { 
            saga: this.sagaName, 
            step: step.name,
            success: 'true',
          });
          
          sagaLogger.debug(`Step completed: ${step.name}`, { durationMs: stepDuration });
          
        } catch (error) {
          const stepDuration = stepTimer();
          metrics.timing('saga.step.duration', stepDuration, { 
            saga: this.sagaName, 
            step: step.name,
            success: 'false',
          });
          
          // Check if step is non-critical
          if (step.critical === false) {
            sagaLogger.warn(`Non-critical step failed: ${step.name}`, { error });
            continue; // Skip this step and continue
          }
          
          sagaLogger.error(`Step failed: ${step.name}`, error);
          
          // Store error details
          execution.status = 'compensating';
          execution.errorDetails = {
            step: step.name,
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          };
          await this.notifyStateChange(execution, options);
          
          // Compensate completed steps in reverse order
          sagaLogger.info('Starting compensation', { 
            stepsToCompensate: [...completedSteps].reverse() 
          });
          
          for (const completedStep of [...completedSteps].reverse()) {
            const stepDef = this.steps.find(s => s.name === completedStep);
            if (!stepDef) continue;
            
            try {
              sagaLogger.debug(`Compensating step: ${completedStep}`);
              const compensateTimer = startTimer();
              
              await stepDef.compensate(context);
              
              compensatedSteps.push(completedStep);
              
              const compensateDuration = compensateTimer();
              metrics.timing('saga.compensation.duration', compensateDuration, {
                saga: this.sagaName,
                step: completedStep,
              });
              
              sagaLogger.debug(`Step compensated: ${completedStep}`, { 
                durationMs: compensateDuration 
              });
              
            } catch (compensationError) {
              sagaLogger.error(`Compensation failed for step: ${completedStep}`, compensationError);
              compensationErrors.push({
                step: completedStep,
                error: compensationError instanceof Error 
                  ? compensationError 
                  : new Error(String(compensationError)),
              });
            }
          }
          
          // Update execution status
          execution.status = compensationErrors.length > 0 
            ? 'compensation_failed' 
            : 'compensated';
          execution.compensationErrors = compensationErrors.map(e => ({
            step: e.step,
            message: e.error.message,
          }));
          execution.completedAt = new Date();
          await this.notifyStateChange(execution, options);
          
          const duration = sagaTimer();
          metrics.increment('saga.executions.failed', 1, { saga: this.sagaName });
          metrics.timing('saga.execution.duration', duration, { 
            saga: this.sagaName,
            success: 'false',
          });
          
          sagaLogger.error('Saga failed', { 
            failedStep: step.name,
            compensatedSteps,
            compensationErrors: compensationErrors.length,
            durationMs: duration,
          });
          
          return {
            success: false,
            context,
            completedSteps,
            failedStep: step.name,
            error: error instanceof Error ? error : new Error(String(error)),
            compensatedSteps,
            compensationErrors: compensationErrors.length > 0 ? compensationErrors : undefined,
            durationMs: duration,
            sagaId,
          };
        }
      }
      
      // All steps completed successfully
      execution.status = 'completed';
      execution.completedAt = new Date();
      execution.currentStep = undefined;
      await this.notifyStateChange(execution, options);
      
      const duration = sagaTimer();
      metrics.increment('saga.executions.completed', 1, { saga: this.sagaName });
      metrics.timing('saga.execution.duration', duration, { 
        saga: this.sagaName,
        success: 'true',
      });
      
      sagaLogger.info('Saga completed successfully', { 
        completedSteps,
        durationMs: duration,
      });
      
      return {
        success: true,
        context,
        completedSteps,
        durationMs: duration,
        sagaId,
      };
      
    } catch (unexpectedError) {
      // Handle unexpected errors (should not normally occur)
      const duration = sagaTimer();
      sagaLogger.error('Unexpected saga error', unexpectedError);
      
      execution.status = 'failed';
      execution.errorDetails = {
        step: 'unknown',
        message: unexpectedError instanceof Error ? unexpectedError.message : String(unexpectedError),
      };
      execution.completedAt = new Date();
      await this.notifyStateChange(execution, options);
      
      return {
        success: false,
        context,
        completedSteps,
        failedStep: 'unknown',
        error: unexpectedError instanceof Error ? unexpectedError : new Error(String(unexpectedError)),
        durationMs: duration,
        sagaId,
      };
    }
  }

  /**
   * Execute a step with optional retries
   */
  private async executeStepWithRetry(
    step: SagaStep<TContext>,
    context: TContext,
    sagaLogger: ReturnType<typeof createLogger>
  ): Promise<TContext> {
    const maxRetries = step.retries ?? 0;
    const retryDelay = step.retryDelayMs ?? 1000;
    
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          sagaLogger.debug(`Retrying step: ${step.name}`, { attempt, maxRetries });
          await this.delay(retryDelay * attempt); // Exponential backoff
        }
        
        return await step.execute(context);
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < maxRetries) {
          sagaLogger.warn(`Step failed, will retry: ${step.name}`, { 
            attempt,
            maxRetries,
            error: lastError.message,
          });
          metrics.increment('saga.step.retries', 1, { 
            saga: this.sagaName, 
            step: step.name,
          });
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Generate a unique saga ID
   */
  private generateSagaId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `saga_${timestamp}_${random}`;
  }

  /**
   * Notify state change callback
   */
  private async notifyStateChange(
    execution: SagaExecution<TContext>,
    options: SagaOptions
  ): Promise<void> {
    if (options.onStateChange) {
      try {
        await options.onStateChange(execution as SagaExecution<unknown>);
      } catch (error) {
        this.logger.warn('State change callback failed', { error });
      }
    }
  }

  /**
   * Helper to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Create a no-op compensation function for idempotent steps
 */
export function noOpCompensation<TContext>(): (context: TContext) => Promise<void> {
  return async () => {
    // No compensation needed
  };
}

/**
 * Create a saga step with sensible defaults
 */
export function createSagaStep<TContext>(
  name: string,
  execute: (context: TContext) => Promise<TContext>,
  compensate?: (context: TContext) => Promise<void>,
  options?: {
    critical?: boolean;
    retries?: number;
    retryDelayMs?: number;
  }
): SagaStep<TContext> {
  return {
    name,
    execute,
    compensate: compensate || noOpCompensation<TContext>(),
    critical: options?.critical ?? true,
    retries: options?.retries ?? 0,
    retryDelayMs: options?.retryDelayMs ?? 1000,
  };
}

/**
 * Wrap an async function to be used as a saga step execution
 * Preserves the context and adds the result to it
 */
export function wrapExecution<TContext extends Record<string, unknown>, TResult>(
  fn: (context: TContext) => Promise<TResult>,
  resultKey: keyof TContext
): (context: TContext) => Promise<TContext> {
  return async (context: TContext): Promise<TContext> => {
    const result = await fn(context);
    return {
      ...context,
      [resultKey]: result,
    };
  };
}

// ============================================
// SAGA BUILDER (FLUENT API)
// ============================================

/**
 * Builder for creating sagas with a fluent API
 * 
 * @example
 * const saga = SagaBuilder.create<OrderContext>('CreateOrder')
 *   .step('ReserveInventory', reserveInventory, releaseInventory)
 *   .step('CreateOrder', createOrder, cancelOrder)
 *   .step('SendEmail', sendEmail) // No compensation
 *   .build();
 */
export class SagaBuilder<TContext extends Record<string, unknown>> {
  private steps: SagaStep<TContext>[] = [];
  private sagaName: string;

  private constructor(sagaName: string) {
    this.sagaName = sagaName;
  }

  static create<TContext extends Record<string, unknown>>(
    sagaName: string
  ): SagaBuilder<TContext> {
    return new SagaBuilder<TContext>(sagaName);
  }

  /**
   * Add a step to the saga
   */
  step(
    name: string,
    execute: (context: TContext) => Promise<TContext>,
    compensate?: (context: TContext) => Promise<void>,
    options?: {
      critical?: boolean;
      retries?: number;
      retryDelayMs?: number;
    }
  ): this {
    this.steps.push(createSagaStep(name, execute, compensate, options));
    return this;
  }

  /**
   * Add an optional (non-critical) step
   */
  optionalStep(
    name: string,
    execute: (context: TContext) => Promise<TContext>,
    compensate?: (context: TContext) => Promise<void>
  ): this {
    return this.step(name, execute, compensate, { critical: false });
  }

  /**
   * Add a step with retries
   */
  retryableStep(
    name: string,
    execute: (context: TContext) => Promise<TContext>,
    compensate?: (context: TContext) => Promise<void>,
    retries: number = 3,
    retryDelayMs: number = 1000
  ): this {
    return this.step(name, execute, compensate, { retries, retryDelayMs });
  }

  /**
   * Build the saga orchestrator
   */
  build(): SagaOrchestrator<TContext> {
    return new SagaOrchestrator(this.steps, this.sagaName);
  }
}

// ============================================
// EXPORTS
// ============================================

export { createLogger };
