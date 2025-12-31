/**
 * Retry utility for network operations
 * Provides exponential backoff and configurable retry logic
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'],
};

/**
 * Retry an operation with exponential backoff
 * @param operation - The async operation to retry
 * @param options - Retry configuration options
 * @returns The result of the operation
 * @throws The last error if all retries fail
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Check if error is retryable
      const errorCode = (error as any)?.code || '';
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      const isRetryable = 
        config.retryableErrors.some(code => 
          errorCode.includes(code) || errorMessage.includes(code)
        ) ||
        errorMessage.includes('network') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('ECONN');
      
      // Don't retry if it's the last attempt or error is not retryable
      if (attempt === config.maxRetries || !isRetryable) {
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        config.initialDelay * Math.pow(config.backoffMultiplier, attempt),
        config.maxDelay
      );
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
      
      console.warn(`Retry attempt ${attempt + 1}/${config.maxRetries} after ${delay}ms:`, errorMessage);
    }
  }
  
  throw lastError || new Error('Operation failed after retries');
}

/**
 * Retry a Supabase operation
 * @param operation - The Supabase operation to retry
 * @param options - Retry configuration options
 * @returns The result of the operation
 */
export async function retrySupabaseOperation<T>(
  operation: () => Promise<{ data: T | null; error: any }>,
  options: RetryOptions = {}
): Promise<{ data: T | null; error: any }> {
  return retryOperation(async () => {
    const result = await operation();
    
    // Retry on certain Supabase errors
    if (result.error) {
      const errorCode = result.error.code || '';
      const errorMessage = result.error.message || '';
      
      // Retry on network errors or temporary failures
      if (
        errorCode === 'PGRST116' || // Connection error
        errorCode === 'PGRST301' || // Timeout
        errorMessage.includes('network') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('ECONN')
      ) {
        throw new Error(`Supabase error: ${errorMessage}`);
      }
    }
    
    return result;
  }, options);
}

/**
 * Retry a fetch operation
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @param retryOptions - Retry configuration options
 * @returns The fetch response
 */
export async function retryFetch(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  return retryOperation(async () => {
    const response = await fetch(url, options);
    
    // Retry on server errors (5xx) or network errors
    if (!response.ok && response.status >= 500) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response;
  }, retryOptions);
}

