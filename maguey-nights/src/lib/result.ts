/**
 * Result Type Pattern
 * 
 * A standardized way to handle operations that can succeed or fail.
 * Replaces inconsistent error handling (throw, null, { success, error }).
 * 
 * Usage:
 *   const result = await fetchUser(id);
 *   if (isOk(result)) {
 *     console.log(result.data.name);
 *   } else {
 *     console.error(result.error.message);
 *   }
 */

// ============================================
// CORE TYPES
// ============================================

/**
 * Result type that can be either success or failure.
 * @template T - The type of the success value
 * @template E - The type of the error (defaults to Error)
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Async Result for promise-based operations
 */
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

// ============================================
// CONSTRUCTOR FUNCTIONS
// ============================================

/**
 * Create a successful Result
 * @param data - The success value
 * @returns A success Result containing the data
 * 
 * @example
 * const result = ok({ id: 1, name: "John" });
 * // { success: true, data: { id: 1, name: "John" } }
 */
export function ok<T>(data: T): Result<T, never> {
  return { success: true, data };
}

/**
 * Create a failed Result
 * @param error - The error value
 * @returns A failure Result containing the error
 * 
 * @example
 * const result = err(new Error("Not found"));
 * // { success: false, error: Error("Not found") }
 */
export function err<E>(error: E): Result<never, E> {
  return { success: false, error };
}

// ============================================
// TYPE GUARDS
// ============================================

/**
 * Check if a Result is successful
 * @param result - The Result to check
 * @returns true if the Result is successful, with type narrowing
 * 
 * @example
 * if (isOk(result)) {
 *   console.log(result.data); // TypeScript knows data exists
 * }
 */
export function isOk<T, E>(result: Result<T, E>): result is { success: true; data: T } {
  return result.success === true;
}

/**
 * Check if a Result is a failure
 * @param result - The Result to check
 * @returns true if the Result is a failure, with type narrowing
 * 
 * @example
 * if (isErr(result)) {
 *   console.error(result.error); // TypeScript knows error exists
 * }
 */
export function isErr<T, E>(result: Result<T, E>): result is { success: false; error: E } {
  return result.success === false;
}

// ============================================
// TRANSFORMATION FUNCTIONS
// ============================================

/**
 * Transform the success value of a Result
 * @param result - The Result to transform
 * @param fn - Function to apply to the success value
 * @returns A new Result with the transformed value, or the original error
 * 
 * @example
 * const result = ok(5);
 * const doubled = map(result, x => x * 2);
 * // { success: true, data: 10 }
 */
export function map<T, U, E>(result: Result<T, E>, fn: (data: T) => U): Result<U, E> {
  if (isOk(result)) {
    return ok(fn(result.data));
  }
  return result;
}

/**
 * Transform the error value of a Result
 * @param result - The Result to transform
 * @param fn - Function to apply to the error value
 * @returns A new Result with the transformed error, or the original success
 * 
 * @example
 * const result = err("not found");
 * const mapped = mapErr(result, msg => new Error(msg));
 * // { success: false, error: Error("not found") }
 */
export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
  if (isErr(result)) {
    return err(fn(result.error));
  }
  return result;
}

/**
 * Chain Result-returning operations
 * @param result - The Result to chain from
 * @param fn - Function that returns a new Result
 * @returns The new Result, or the original error
 * 
 * @example
 * const getUser = (id: number): Result<User, Error> => ...;
 * const getProfile = (user: User): Result<Profile, Error> => ...;
 * 
 * const result = flatMap(getUser(1), getProfile);
 */
export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (data: T) => Result<U, E>
): Result<U, E> {
  if (isOk(result)) {
    return fn(result.data);
  }
  return result;
}

/**
 * Async version of flatMap for chaining async operations
 * @param result - The Result to chain from
 * @param fn - Async function that returns a new Result
 * @returns Promise of the new Result, or the original error
 */
export async function flatMapAsync<T, U, E>(
  result: Result<T, E>,
  fn: (data: T) => Promise<Result<U, E>>
): Promise<Result<U, E>> {
  if (isOk(result)) {
    return fn(result.data);
  }
  return result;
}

// ============================================
// UNWRAP FUNCTIONS
// ============================================

/**
 * Extract the success value or throw the error
 * @param result - The Result to unwrap
 * @returns The success value
 * @throws The error if Result is a failure
 * 
 * @example
 * const data = unwrap(result); // throws if error
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.data;
  }
  throw result.error;
}

/**
 * Extract the success value or return a default
 * @param result - The Result to unwrap
 * @param defaultValue - Value to return if Result is a failure
 * @returns The success value or the default
 * 
 * @example
 * const count = unwrapOr(result, 0);
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (isOk(result)) {
    return result.data;
  }
  return defaultValue;
}

/**
 * Extract the success value or compute a default from the error
 * @param result - The Result to unwrap
 * @param fn - Function to compute default from error
 * @returns The success value or computed default
 * 
 * @example
 * const count = unwrapOrElse(result, err => {
 *   console.error(err);
 *   return 0;
 * });
 */
export function unwrapOrElse<T, E>(result: Result<T, E>, fn: (error: E) => T): T {
  if (isOk(result)) {
    return result.data;
  }
  return fn(result.error);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Convert a throwing function to a Result-returning function
 * @param fn - Function that may throw
 * @returns Result containing the return value or caught error
 * 
 * @example
 * const result = tryCatch(() => JSON.parse(jsonString));
 */
export function tryCatch<T>(fn: () => T): Result<T, Error> {
  try {
    return ok(fn());
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Async version of tryCatch
 * @param fn - Async function that may throw
 * @returns Promise of Result containing the return value or caught error
 * 
 * @example
 * const result = await tryCatchAsync(() => fetch(url));
 */
export async function tryCatchAsync<T>(fn: () => Promise<T>): AsyncResult<T, Error> {
  try {
    const data = await fn();
    return ok(data);
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Combine multiple Results into a single Result
 * @param results - Array of Results to combine
 * @returns Result containing array of success values, or first error
 * 
 * @example
 * const results = [ok(1), ok(2), ok(3)];
 * const combined = combine(results);
 * // { success: true, data: [1, 2, 3] }
 */
export function combine<T, E>(results: Result<T, E>[]): Result<T[], E> {
  const data: T[] = [];
  
  for (const result of results) {
    if (isErr(result)) {
      return result;
    }
    data.push(result.data);
  }
  
  return ok(data);
}

/**
 * Combine multiple async Results
 * @param results - Array of Promise Results to combine
 * @returns Promise of Result containing array of success values, or first error
 */
export async function combineAsync<T, E>(
  results: Promise<Result<T, E>>[]
): Promise<Result<T[], E>> {
  const resolved = await Promise.all(results);
  return combine(resolved);
}

/**
 * Execute a side effect if Result is successful
 * @param result - The Result to tap
 * @param fn - Side effect function
 * @returns The original Result unchanged
 * 
 * @example
 * const result = tap(ok(data), d => console.log("Got:", d));
 */
export function tap<T, E>(result: Result<T, E>, fn: (data: T) => void): Result<T, E> {
  if (isOk(result)) {
    fn(result.data);
  }
  return result;
}

/**
 * Execute a side effect if Result is a failure
 * @param result - The Result to tap
 * @param fn - Side effect function
 * @returns The original Result unchanged
 */
export function tapErr<T, E>(result: Result<T, E>, fn: (error: E) => void): Result<T, E> {
  if (isErr(result)) {
    fn(result.error);
  }
  return result;
}

/**
 * Pattern match on a Result
 * @param result - The Result to match
 * @param handlers - Object with ok and err handlers
 * @returns The result of the matching handler
 * 
 * @example
 * const message = match(result, {
 *   ok: data => `Found: ${data.name}`,
 *   err: error => `Error: ${error.message}`
 * });
 */
export function match<T, E, U>(
  result: Result<T, E>,
  handlers: {
    ok: (data: T) => U;
    err: (error: E) => U;
  }
): U {
  if (isOk(result)) {
    return handlers.ok(result.data);
  }
  return handlers.err(result.error);
}

/**
 * Convert a nullable value to a Result
 * @param value - Value that may be null or undefined
 * @param error - Error to use if value is null/undefined
 * @returns Result containing the value or the error
 * 
 * @example
 * const result = fromNullable(user, new Error("User not found"));
 */
export function fromNullable<T, E>(value: T | null | undefined, error: E): Result<T, E> {
  if (value === null || value === undefined) {
    return err(error);
  }
  return ok(value);
}

/**
 * Convert a Result to a nullable value
 * @param result - The Result to convert
 * @returns The success value or null
 */
export function toNullable<T, E>(result: Result<T, E>): T | null {
  if (isOk(result)) {
    return result.data;
  }
  return null;
}
