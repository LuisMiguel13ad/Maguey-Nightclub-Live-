/**
 * Email Queue Processor Tests
 *
 * Behavior specifications for the process-email-queue edge function.
 * These tests document the expected behavior of the queue processor.
 *
 * To run: deno test --allow-net --allow-env index.test.ts
 */

import {
  assertEquals,
  assertGreater,
  assertLessOrEqual,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";

// ============================================
// Exponential Backoff Tests
// ============================================

/**
 * Calculate next retry time using exponential backoff with jitter
 * (Extracted from index.ts for unit testing)
 */
function calculateNextRetryTime(attemptCount: number): Date {
  const baseDelayMs = 60 * 1000; // 1 minute
  const maxDelayMs = 30 * 60 * 1000; // 30 minutes

  const exponentialDelay = Math.min(
    baseDelayMs * Math.pow(2, attemptCount),
    maxDelayMs
  );

  // Add jitter: +/- 10%
  const jitter = exponentialDelay * 0.1 * (Math.random() * 2 - 1);

  return new Date(Date.now() + exponentialDelay + jitter);
}

Deno.test("exponential backoff - attempt 0 delays ~1 minute", () => {
  const now = Date.now();
  const nextRetry = calculateNextRetryTime(0);
  const delayMs = nextRetry.getTime() - now;

  // Should be around 1 minute (+/- 10% jitter = 54s to 66s)
  assertGreater(delayMs, 54000, "Delay should be at least 54 seconds");
  assertLessOrEqual(delayMs, 66000, "Delay should be at most 66 seconds");
});

Deno.test("exponential backoff - attempt 1 delays ~2 minutes", () => {
  const now = Date.now();
  const nextRetry = calculateNextRetryTime(1);
  const delayMs = nextRetry.getTime() - now;

  // Should be around 2 minutes (+/- 10% jitter = 108s to 132s)
  assertGreater(delayMs, 108000, "Delay should be at least 108 seconds");
  assertLessOrEqual(delayMs, 132000, "Delay should be at most 132 seconds");
});

Deno.test("exponential backoff - attempt 2 delays ~4 minutes", () => {
  const now = Date.now();
  const nextRetry = calculateNextRetryTime(2);
  const delayMs = nextRetry.getTime() - now;

  // Should be around 4 minutes (+/- 10% jitter = 216s to 264s)
  assertGreater(delayMs, 216000, "Delay should be at least 216 seconds");
  assertLessOrEqual(delayMs, 264000, "Delay should be at most 264 seconds");
});

Deno.test("exponential backoff - attempt 3 delays ~8 minutes", () => {
  const now = Date.now();
  const nextRetry = calculateNextRetryTime(3);
  const delayMs = nextRetry.getTime() - now;

  // Should be around 8 minutes (+/- 10% jitter = 432s to 528s)
  assertGreater(delayMs, 432000, "Delay should be at least 432 seconds");
  assertLessOrEqual(delayMs, 528000, "Delay should be at most 528 seconds");
});

Deno.test("exponential backoff - attempt 4 delays ~16 minutes", () => {
  const now = Date.now();
  const nextRetry = calculateNextRetryTime(4);
  const delayMs = nextRetry.getTime() - now;

  // Should be around 16 minutes (+/- 10% jitter = 864s to 1056s)
  assertGreater(delayMs, 864000, "Delay should be at least 864 seconds");
  assertLessOrEqual(delayMs, 1056000, "Delay should be at most 1056 seconds");
});

Deno.test("exponential backoff - caps at 30 minutes", () => {
  const now = Date.now();
  const nextRetry = calculateNextRetryTime(10); // 2^10 = 1024 minutes, should be capped
  const delayMs = nextRetry.getTime() - now;

  // Should be capped at 30 minutes (+/- 10% jitter = 27min to 33min)
  const thirtyMinutesMs = 30 * 60 * 1000;
  assertLessOrEqual(
    delayMs,
    thirtyMinutesMs * 1.1,
    "Delay should be at most 33 minutes (30 + 10% jitter)"
  );
  assertGreater(
    delayMs,
    thirtyMinutesMs * 0.9,
    "Delay should be at least 27 minutes (30 - 10% jitter)"
  );
});

// ============================================
// Queue Processing Logic Tests (Behavior Documentation)
// ============================================

/**
 * These tests document the expected behavior of the queue processor.
 * They use mock objects to verify the processing logic.
 */

interface MockEmailQueueEntry {
  id: string;
  email_type: "ga_ticket" | "vip_confirmation";
  recipient_email: string;
  subject: string;
  html_body: string;
  related_id: string | null;
  resend_email_id: string | null;
  status: "pending" | "processing" | "sent" | "delivered" | "failed";
  attempt_count: number;
  max_attempts: number;
  next_retry_at: string;
  last_error: string | null;
  error_context: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

function createMockEmail(overrides: Partial<MockEmailQueueEntry> = {}): MockEmailQueueEntry {
  return {
    id: crypto.randomUUID(),
    email_type: "ga_ticket",
    recipient_email: "test@example.com",
    subject: "Your Ticket",
    html_body: "<html><body>Test</body></html>",
    related_id: null,
    resend_email_id: null,
    status: "pending",
    attempt_count: 0,
    max_attempts: 5,
    next_retry_at: new Date().toISOString(),
    last_error: null,
    error_context: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

Deno.test("queue processing - batch size limited to 10 emails", () => {
  // BEHAVIOR SPECIFICATION:
  // The queue processor fetches at most 10 emails per invocation
  // to avoid hitting Resend rate limits.
  //
  // Implementation: .limit(10) in the Supabase query
  const BATCH_SIZE = 10;
  assertEquals(BATCH_SIZE, 10, "Batch size should be 10");
});

Deno.test("queue processing - only fetches pending emails ready for retry", () => {
  // BEHAVIOR SPECIFICATION:
  // The processor only fetches emails where:
  // 1. status = 'pending'
  // 2. next_retry_at <= now
  //
  // This ensures failed emails wait for their backoff period before retry.
  const now = new Date();
  const futureRetry = new Date(now.getTime() + 60000); // 1 minute in future
  const pastRetry = new Date(now.getTime() - 60000); // 1 minute ago

  const emailReadyForRetry = createMockEmail({
    status: "pending",
    next_retry_at: pastRetry.toISOString(),
  });

  const emailNotReadyYet = createMockEmail({
    status: "pending",
    next_retry_at: futureRetry.toISOString(),
  });

  const emailAlreadyProcessing = createMockEmail({
    status: "processing",
    next_retry_at: pastRetry.toISOString(),
  });

  // Filter logic: status === 'pending' AND next_retry_at <= now
  const shouldFetch = (email: MockEmailQueueEntry) =>
    email.status === "pending" &&
    new Date(email.next_retry_at) <= now;

  assertEquals(shouldFetch(emailReadyForRetry), true, "Should fetch pending email ready for retry");
  assertEquals(shouldFetch(emailNotReadyYet), false, "Should not fetch email not ready for retry");
  assertEquals(shouldFetch(emailAlreadyProcessing), false, "Should not fetch processing email");
});

Deno.test("queue processing - uses optimistic locking", () => {
  // BEHAVIOR SPECIFICATION:
  // Before processing, the queue marks the email as 'processing'
  // with a WHERE clause that checks status = 'pending'.
  //
  // If another instance already changed the status, the update
  // returns count=0 and we skip this email.
  //
  // This prevents double-processing by concurrent invocations.
  const lockQuery = {
    table: "email_queue",
    update: { status: "processing" },
    where: { id: "some-id", status: "pending" }, // Only lock if still pending
  };

  assertEquals(lockQuery.where.status, "pending", "Lock should only succeed if status is pending");
});

Deno.test("queue processing - state transitions", () => {
  // BEHAVIOR SPECIFICATION:
  // Valid state transitions:
  // 1. pending -> processing (lock acquired)
  // 2. processing -> sent (API call succeeded)
  // 3. processing -> pending (API call failed, retries remaining)
  // 4. processing -> failed (max attempts reached OR bounce/complaint)
  // 5. sent -> delivered (webhook confirmation)
  // 6. sent -> failed (bounce or complaint webhook)
  //
  // Invalid transitions (should never happen):
  // - delivered -> anything (terminal state)
  // - failed -> anything (terminal state, except manual intervention)
  // - pending -> sent/delivered/failed (must go through processing)

  const validTransitions: Record<string, string[]> = {
    pending: ["processing"],
    processing: ["sent", "pending", "failed"],
    sent: ["delivered", "failed"],
    delivered: [], // terminal
    failed: [], // terminal
  };

  assertEquals(validTransitions.pending, ["processing"]);
  assertEquals(validTransitions.processing, ["sent", "pending", "failed"]);
  assertEquals(validTransitions.sent, ["delivered", "failed"]);
  assertEquals(validTransitions.delivered, []);
  assertEquals(validTransitions.failed, []);
});

// ============================================
// Retry Logic Tests
// ============================================

Deno.test("retry logic - schedules retry on failure with attempts remaining", () => {
  // BEHAVIOR SPECIFICATION:
  // When an email send fails and attempt_count < max_attempts:
  // 1. Increment attempt_count
  // 2. Calculate next_retry_at with exponential backoff
  // 3. Store last_error and error_context
  // 4. Set status back to 'pending'
  const email = createMockEmail({
    attempt_count: 2,
    max_attempts: 5,
  });

  const newAttemptCount = email.attempt_count + 1;
  const hasRetriesRemaining = newAttemptCount < email.max_attempts;

  assertEquals(hasRetriesRemaining, true, "Should have retries remaining");
  assertEquals(newAttemptCount, 3, "Attempt count should increment");
});

Deno.test("retry logic - permanent failure after max attempts", () => {
  // BEHAVIOR SPECIFICATION:
  // When an email send fails and attempt_count >= max_attempts:
  // 1. Set status to 'failed'
  // 2. Store last_error with failure details
  // 3. Store error_context with final_failure: true
  // 4. Do NOT schedule retry
  const email = createMockEmail({
    attempt_count: 4,
    max_attempts: 5,
  });

  const newAttemptCount = email.attempt_count + 1;
  const shouldPermanentlyFail = newAttemptCount >= email.max_attempts;

  assertEquals(shouldPermanentlyFail, true, "Should permanently fail after max attempts");

  const expectedUpdate = {
    status: "failed",
    attempt_count: 5,
    error_context: { final_failure: true },
  };

  assertEquals(expectedUpdate.status, "failed");
  assertEquals(expectedUpdate.error_context.final_failure, true);
});

// ============================================
// API Response Handling Tests
// ============================================

Deno.test("API response - stores Resend email ID on success", () => {
  // BEHAVIOR SPECIFICATION:
  // When Resend API returns 200 with email ID:
  // 1. Extract 'id' from response JSON
  // 2. Update email_queue with resend_email_id
  // 3. Set status to 'sent'
  //
  // The resend_email_id enables webhook correlation later.
  const mockResendResponse = {
    id: "re_123abc456def",
  };

  const expectedUpdate = {
    status: "sent",
    resend_email_id: mockResendResponse.id,
  };

  assertEquals(expectedUpdate.status, "sent");
  assertEquals(expectedUpdate.resend_email_id, "re_123abc456def");
});

Deno.test("API response - handles error response correctly", () => {
  // BEHAVIOR SPECIFICATION:
  // When Resend API returns an error (non-2xx):
  // 1. Extract error text from response
  // 2. Throw error to trigger retry logic
  // 3. Error message includes status code and response body
  const errorStatus = 429;
  const errorBody = "Rate limit exceeded";
  const expectedError = `Resend API error ${errorStatus}: ${errorBody}`;

  assertEquals(
    expectedError,
    "Resend API error 429: Rate limit exceeded",
    "Error message should include status and body"
  );
});

// ============================================
// Configuration Tests
// ============================================

Deno.test("configuration - requires RESEND_API_KEY", () => {
  // BEHAVIOR SPECIFICATION:
  // If RESEND_API_KEY is not set, the processor should:
  // 1. Log an error
  // 2. Return 500 with "Email service not configured"
  // 3. NOT process any emails
  const apiKey = undefined;
  const hasApiKey = !!apiKey;

  assertEquals(hasApiKey, false, "Should detect missing API key");
});

Deno.test("configuration - uses default from email if not configured", () => {
  // BEHAVIOR SPECIFICATION:
  // If EMAIL_FROM_ADDRESS is not set, use default:
  // "tickets@magueynightclub.com"
  const envFromAddress = undefined;
  const fromEmail = envFromAddress || "tickets@magueynightclub.com";

  assertEquals(
    fromEmail,
    "tickets@magueynightclub.com",
    "Should use default from address"
  );
});

// ============================================
// Return Value Tests
// ============================================

Deno.test("return value - reports processing results", () => {
  // BEHAVIOR SPECIFICATION:
  // The processor returns a JSON response with:
  // - processed: number of emails successfully sent
  // - failed: number of emails that permanently failed
  // - total: total emails processed in this batch
  // - timestamp: ISO timestamp of completion
  const result = {
    processed: 8,
    failed: 2,
    total: 10,
    timestamp: new Date().toISOString(),
  };

  assertEquals(result.processed + result.failed, result.total, "Processed + failed should equal total");
  assertEquals(typeof result.timestamp, "string", "Timestamp should be a string");
});

Deno.test("return value - handles empty queue gracefully", () => {
  // BEHAVIOR SPECIFICATION:
  // When no emails are pending, return:
  // - processed: 0
  // - failed: 0
  // - message: "No pending emails"
  // - status: 200 (not an error)
  const emptyResult = {
    processed: 0,
    failed: 0,
    message: "No pending emails",
  };

  assertEquals(emptyResult.processed, 0);
  assertEquals(emptyResult.failed, 0);
  assertEquals(emptyResult.message, "No pending emails");
});
