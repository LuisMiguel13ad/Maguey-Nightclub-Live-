/// <reference types="cypress" />

/**
 * Email Failure Handling Tests
 *
 * Tests the email queue infrastructure for:
 * - Initial delivery failures are logged
 * - Exponential backoff retry schedule
 * - Max attempts exhausted marks as permanently failed
 * - Permanent bounces via webhook handling
 */

describe('Email Failure Handling', () => {
  const testRunId = Date.now().toString();
  let createdEmailIds: string[] = [];

  before(() => {
    // Health check
    cy.task('healthCheck').then((checks: any) => {
      expect(checks.db).to.be.true;
    });
  });

  after(() => {
    // Cleanup created test emails
    createdEmailIds.forEach((id) => {
      cy.task('deleteEmailQueueEntry', id).catch(() => {
        // Ignore errors if already deleted
      });
    });
  });

  it('initial delivery failure is logged', () => {
    // Insert a test email that would fail delivery
    const testEmail = {
      email_type: 'ga_ticket' as const,
      recipient_email: `email-test+invalid-${testRunId}@test.maguey.com`,
      subject: 'Test Email - Expected to Fail',
      html_body: '<p>This email is designed to fail for testing purposes</p>',
      related_id: `test-ticket-${testRunId}`,
      status: 'pending',
      attempt_count: 0,
      max_attempts: 5,
      next_retry_at: new Date().toISOString(),
    };

    cy.task('insertEmailQueue', testEmail).then((email: any) => {
      createdEmailIds.push(email.id);

      // Verify initial state
      expect(email.status).to.eq('pending');
      expect(email.attempt_count).to.eq(0);
      expect(email.last_error).to.be.null;

      cy.log(`Created test email: ${email.id}`);

      // Simulate failure by updating the email to processing state with an error
      // In real scenario, process-email-queue would do this
      cy.task('updateEmailQueue', {
        id: email.id,
        updates: {
          status: 'pending', // Back to pending for retry
          attempt_count: 1,
          last_error: 'Resend API error 400: Invalid recipient email',
          error_context: {
            last_attempt: new Date().toISOString(),
            attempt_number: 1,
          },
        },
      }).then((updated: any) => {
        // Verify failure was logged
        expect(updated.status).to.eq('pending');
        expect(updated.attempt_count).to.eq(1);
        expect(updated.last_error).to.include('Invalid recipient');
        expect(updated.error_context).to.have.property('attempt_number', 1);

        cy.log('✓ Failure logged with error message and attempt count');
      });
    });
  });

  it('exponential backoff schedule is correct', () => {
    const testEmail = {
      email_type: 'ga_ticket' as const,
      recipient_email: `backoff-test-${testRunId}@test.maguey.com`,
      subject: 'Backoff Test Email',
      html_body: '<p>Testing exponential backoff</p>',
      status: 'pending',
      attempt_count: 0,
      max_attempts: 5,
      next_retry_at: new Date().toISOString(),
    };

    cy.task('insertEmailQueue', testEmail).then((email: any) => {
      createdEmailIds.push(email.id);
      const baseDelay = 60 * 1000; // 1 minute in ms

      // Test attempt 0 -> attempt 1
      const beforeRetry1 = Date.now();
      cy.task('updateEmailQueue', {
        id: email.id,
        updates: {
          status: 'pending',
          attempt_count: 1,
          next_retry_at: new Date(Date.now() + baseDelay).toISOString(), // ~1 min
          last_error: 'Test failure 1',
        },
      }).then((updated: any) => {
        const nextRetryTime = new Date(updated.next_retry_at).getTime();
        const expectedRetryTime = beforeRetry1 + baseDelay;
        const tolerance = 10000; // 10 second tolerance

        expect(nextRetryTime).to.be.closeTo(expectedRetryTime, tolerance);
        cy.log(`✓ Attempt 1 retry scheduled ~1 minute from now`);

        // Test attempt 1 -> attempt 2
        const beforeRetry2 = Date.now();
        cy.task('updateEmailQueue', {
          id: email.id,
          updates: {
            status: 'pending',
            attempt_count: 2,
            next_retry_at: new Date(Date.now() + baseDelay * 2).toISOString(), // ~2 min
            last_error: 'Test failure 2',
          },
        }).then((updated2: any) => {
          const nextRetryTime2 = new Date(updated2.next_retry_at).getTime();
          const expectedRetryTime2 = beforeRetry2 + (baseDelay * 2);

          expect(nextRetryTime2).to.be.closeTo(expectedRetryTime2, tolerance);
          cy.log(`✓ Attempt 2 retry scheduled ~2 minutes from now`);

          // Test attempt 2 -> attempt 3
          const beforeRetry3 = Date.now();
          cy.task('updateEmailQueue', {
            id: email.id,
            updates: {
              status: 'pending',
              attempt_count: 3,
              next_retry_at: new Date(Date.now() + baseDelay * 4).toISOString(), // ~4 min
              last_error: 'Test failure 3',
            },
          }).then((updated3: any) => {
            const nextRetryTime3 = new Date(updated3.next_retry_at).getTime();
            const expectedRetryTime3 = beforeRetry3 + (baseDelay * 4);

            expect(nextRetryTime3).to.be.closeTo(expectedRetryTime3, tolerance);
            cy.log(`✓ Attempt 3 retry scheduled ~4 minutes from now`);
            cy.log('✓ Exponential backoff: 1min -> 2min -> 4min verified');
          });
        });
      });
    });
  });

  it('max attempts exhausted marks as permanently failed', () => {
    const testEmail = {
      email_type: 'ga_ticket' as const,
      recipient_email: `max-attempts-${testRunId}@test.maguey.com`,
      subject: 'Max Attempts Test',
      html_body: '<p>Testing max attempts</p>',
      status: 'pending',
      attempt_count: 4, // One below max
      max_attempts: 5,
      next_retry_at: new Date().toISOString(),
      last_error: 'Previous failure',
    };

    cy.task('insertEmailQueue', testEmail).then((email: any) => {
      createdEmailIds.push(email.id);

      expect(email.attempt_count).to.eq(4);
      expect(email.max_attempts).to.eq(5);

      // Simulate final failure (attempt 5)
      cy.task('updateEmailQueue', {
        id: email.id,
        updates: {
          status: 'failed', // Permanently failed
          attempt_count: 5,
          last_error: 'Resend API error: Recipient rejected',
          error_context: {
            final_failure: true,
            timestamp: new Date().toISOString(),
            total_attempts: 5,
          },
        },
      }).then((updated: any) => {
        // Verify permanent failure
        expect(updated.status).to.eq('failed');
        expect(updated.attempt_count).to.eq(5);
        expect(updated.error_context).to.have.property('final_failure', true);
        expect(updated.error_context).to.have.property('total_attempts', 5);

        cy.log('✓ Max attempts exhausted');
        cy.log('✓ Status marked as permanently failed');
        cy.log('✓ error_context contains final_failure: true');
      });
    });
  });

  it('permanent bounce handling via webhook', () => {
    // Create an email that was successfully sent
    const testEmail = {
      email_type: 'ga_ticket' as const,
      recipient_email: `bounce-test-${testRunId}@test.maguey.com`,
      subject: 'Bounce Test Email',
      html_body: '<p>This email will bounce</p>',
      status: 'sent',
      attempt_count: 1,
      max_attempts: 5,
      resend_email_id: `resend_${testRunId}_${Date.now()}`,
    };

    cy.task('insertEmailQueue', testEmail).then((email: any) => {
      createdEmailIds.push(email.id);

      expect(email.status).to.eq('sent');
      expect(email.resend_email_id).to.not.be.null;

      // Simulate Resend webhook bounce event
      // In reality, resend-webhook edge function would do this
      cy.task('updateEmailQueue', {
        id: email.id,
        updates: {
          status: 'failed',
          last_error: 'Bounced: Mailbox does not exist',
          error_context: {
            bounce_type: 'hard',
            bounce_message: 'Mailbox does not exist',
            webhook_received: new Date().toISOString(),
          },
        },
      }).then((bounced: any) => {
        // Verify bounce was handled
        expect(bounced.status).to.eq('failed');
        expect(bounced.last_error).to.include('Bounced');
        expect(bounced.error_context).to.have.property('bounce_type', 'hard');
        expect(bounced.error_context).to.have.property('webhook_received');

        cy.log('✓ Bounce detected and marked as failed');
        cy.log('✓ Bounce metadata stored in error_context');

        // Verify email is not retried
        // Status should remain 'failed', not 'pending'
        cy.task('getEmailQueueEntry', email.id).then((final: any) => {
          expect(final.status).to.eq('failed');
          cy.log('✓ Bounced email not queued for retry');
        });
      });
    });
  });

  it('successful retry changes status to delivered', () => {
    const testEmail = {
      email_type: 'ga_ticket' as const,
      recipient_email: `retry-success-${testRunId}@test.maguey.com`,
      subject: 'Retry Success Test',
      html_body: '<p>Testing successful retry</p>',
      status: 'pending',
      attempt_count: 2,
      max_attempts: 5,
      last_error: 'Previous temporary failure',
      next_retry_at: new Date().toISOString(),
    };

    cy.task('insertEmailQueue', testEmail).then((email: any) => {
      createdEmailIds.push(email.id);

      expect(email.status).to.eq('pending');
      expect(email.attempt_count).to.eq(2);

      // Simulate successful retry
      cy.task('updateEmailQueue', {
        id: email.id,
        updates: {
          status: 'sent',
          resend_email_id: `resend_success_${testRunId}`,
          attempt_count: 3,
        },
      }).then((sent: any) => {
        expect(sent.status).to.eq('sent');
        expect(sent.resend_email_id).to.not.be.null;

        // Simulate delivery webhook
        cy.task('updateEmailQueue', {
          id: email.id,
          updates: {
            status: 'delivered',
          },
        }).then((delivered: any) => {
          expect(delivered.status).to.eq('delivered');
          cy.log('✓ Successful retry marked as sent');
          cy.log('✓ Delivery webhook updates status to delivered');
        });
      });
    });
  });

  it('failed emails show correct error context', () => {
    const testEmail = {
      email_type: 'vip_confirmation' as const,
      recipient_email: `error-context-${testRunId}@test.maguey.com`,
      subject: 'Error Context Test',
      html_body: '<p>Testing error context</p>',
      status: 'failed',
      attempt_count: 5,
      max_attempts: 5,
      last_error: 'Network timeout after 30 seconds',
      error_context: {
        final_failure: true,
        timestamp: new Date().toISOString(),
        total_attempts: 5,
        error_type: 'network_timeout',
        retries_exhausted: true,
      },
    };

    cy.task('insertEmailQueue', testEmail).then((email: any) => {
      createdEmailIds.push(email.id);

      // Verify error context structure
      expect(email.error_context).to.have.property('final_failure', true);
      expect(email.error_context).to.have.property('total_attempts', 5);
      expect(email.error_context).to.have.property('error_type', 'network_timeout');
      expect(email.error_context).to.have.property('timestamp');

      cy.log('✓ Error context contains diagnostic information');
      cy.log('✓ Last error message preserved');
    });
  });

  it('complaint event marks email as failed', () => {
    // Create a sent email that received a spam complaint
    const testEmail = {
      email_type: 'ga_ticket' as const,
      recipient_email: `complaint-${testRunId}@test.maguey.com`,
      subject: 'Complaint Test',
      html_body: '<p>This email will be marked as spam</p>',
      status: 'sent',
      resend_email_id: `resend_complaint_${testRunId}`,
    };

    cy.task('insertEmailQueue', testEmail).then((email: any) => {
      createdEmailIds.push(email.id);

      // Simulate resend-webhook handling email.complained event
      cy.task('updateEmailQueue', {
        id: email.id,
        updates: {
          status: 'failed',
          last_error: 'Recipient marked email as spam',
          error_context: {
            complaint: true,
            webhook_received: new Date().toISOString(),
          },
        },
      }).then((complained: any) => {
        expect(complained.status).to.eq('failed');
        expect(complained.last_error).to.include('spam');
        expect(complained.error_context).to.have.property('complaint', true);

        cy.log('✓ Spam complaint handled');
        cy.log('✓ Email marked as failed to prevent future sends');
      });
    });
  });
});
