/// <reference types="cypress" />

interface EmailQueueInput {
  email_type: 'ga_ticket' | 'vip_confirmation';
  recipient_email: string;
  subject: string;
  html_body: string;
  related_id?: string;
  status?: string;
  attempt_count?: number;
  max_attempts?: number;
  next_retry_at?: string;
  last_error?: string;
}

interface EmailQueueEntry {
  id: string;
  email_type: 'ga_ticket' | 'vip_confirmation';
  recipient_email: string;
  subject: string;
  html_body: string;
  related_id: string | null;
  resend_email_id: string | null;
  status: 'pending' | 'processing' | 'sent' | 'delivered' | 'failed';
  attempt_count: number;
  max_attempts: number;
  next_retry_at: string;
  last_error: string | null;
  error_context: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

declare namespace Cypress {
  interface Chainable {
    // Auth commands
    login(email: string, password: string): Chainable<void>;
    loginScanner(): Chainable<void>;

    // Purchase commands
    fillStripe(): Chainable<void>;
    fillStripeDeclined(declineType: 'generic' | 'insufficientFunds' | 'expired' | 'incorrectCvc'): Chainable<void>;

    // Scan commands
    scanTicket(qrCodeToken: string): Chainable<void>;

    // DB verification commands
    waitForEmailQueued(ticketId: string, timeout?: number): Chainable<any[]>;

    // Email queue commands
    task(event: 'insertEmailQueue', arg: EmailQueueInput): Chainable<EmailQueueEntry>;
    task(event: 'updateEmailQueue', arg: { id: string; updates: Record<string, unknown> }): Chainable<EmailQueueEntry>;
    task(event: 'getEmailQueueEntry', arg: string): Chainable<EmailQueueEntry>;
    task(event: 'deleteEmailQueueEntry', arg: string): Chainable<boolean>;
  }
}
