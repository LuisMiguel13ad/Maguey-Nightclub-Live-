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

interface VipTable {
  id: string;
  event_id: string;
  table_number: number;
  tier: 'premium' | 'front_row' | 'standard';
  capacity: number;
  price_cents: number;
  bottles_included: number;
  is_available: boolean;
}

interface VipReservation {
  id: string;
  event_id: string;
  event_vip_table_id: string;
  table_number: number;
  purchaser_name: string;
  purchaser_email: string;
  qr_code_token: string;
  invite_code: string;
  status: 'pending' | 'confirmed' | 'checked_in' | 'no_show' | 'cancelled';
  amount_paid_cents: number;
}

interface VipGuestPass {
  id: string;
  reservation_id: string;
  event_id: string;
  pass_number: number;
  pass_type: 'purchaser' | 'guest';
  qr_token: string;
  status: 'available' | 'shared' | 'checked_in';
}

interface VipTestData {
  reservation: VipReservation;
  passes: VipGuestPass[];
}

interface TestEvent {
  id: string;
  name: string;
  event_date: string;
  event_time: string;
  status: string;
  ticket_types: Array<{
    id: string;
    code: string;
    name: string;
    price: number;
    fee: number;
    total_inventory: number;
  }>;
}

interface TestInvitation {
  id: string;
  token: string;
  created_by: string;
  expires_at: string;
  metadata: Record<string, unknown>;
}

interface TestPromoCode {
  id: string;
  code: string;
  discount_type: 'amount' | 'percent';
  amount: number;
  usage_limit: number;
  active: boolean;
  valid_from: string;
  valid_to: string;
}

interface VipBookingFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  guestCount?: number;
  celebration?: string;
  specialRequests?: string;
}

declare namespace Cypress {
  interface Chainable {
    // Auth commands
    login(email: string, password: string): Chainable<void>;
    loginScanner(): Chainable<void>;
    loginOwner(): Chainable<void>;

    // Purchase commands
    fillStripe(): Chainable<void>;
    fillStripeDeclined(declineType: 'generic' | 'insufficientFunds' | 'expired' | 'incorrectCvc'): Chainable<void>;

    // Scan commands
    scanTicket(qrCodeToken: string): Chainable<void>;

    // VIP commands
    fillVipBookingForm(data: VipBookingFormData): Chainable<void>;

    // Dashboard commands
    navigateSidebar(section: string): Chainable<void>;

    // DB verification commands
    waitForEmailQueued(ticketId: string, timeout?: number): Chainable<any[]>;

    // Email queue tasks
    task(event: 'insertEmailQueue', arg: EmailQueueInput): Chainable<EmailQueueEntry>;
    task(event: 'updateEmailQueue', arg: { id: string; updates: Record<string, unknown> }): Chainable<EmailQueueEntry>;
    task(event: 'getEmailQueueEntry', arg: string): Chainable<EmailQueueEntry>;
    task(event: 'deleteEmailQueueEntry', arg: string): Chainable<boolean>;

    // VIP tasks
    task(event: 'createTestVipTable', arg: string): Chainable<VipTable | null>;
    task(event: 'createTestVipReservation', arg: { eventId: string; tableId: string; email: string }): Chainable<VipTestData | null>;
    task(event: 'getVipGuestPasses', arg: string): Chainable<VipGuestPass[]>;
    task(event: 'cleanupVipTestData', arg: string): Chainable<null>;

    // Promo code tasks
    task(event: 'createTestPromoCode', arg: { code: string; discountType: 'amount' | 'percent'; amount: number; usageLimit?: number; validFrom?: string; validTo?: string }): Chainable<TestPromoCode | null>;
    task(event: 'deleteTestPromoCode', arg: string): Chainable<null>;

    // Event tasks
    task(event: 'createTestEvent', arg: { name: string; datetime?: string; status?: string }): Chainable<TestEvent | null>;
    task(event: 'deleteTestEvent', arg: string): Chainable<null>;

    // Invitation tasks
    task(event: 'createTestInvitation', arg: { createdBy: string; role?: string; expiresInHours?: number }): Chainable<TestInvitation | null>;
    task(event: 'deleteTestInvitation', arg: string): Chainable<null>;

    // Ticket tasks
    task(event: 'markTicketAsUsed', arg: { ticketId: string; scannedAt?: string }): Chainable<any>;
  }
}
