-- Email Queue System Migration
-- Purpose: Foundation for reliable email delivery with retry capability
-- Phase 2: Email Reliability - Plan 01

-- ==========================================
-- 1. EMAIL QUEUE TABLE
-- ==========================================
-- Stores pending emails for sending with retry support
-- Populated when ticket/VIP purchase completes
-- Processed by cron job or edge function

CREATE TABLE IF NOT EXISTS email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_type TEXT NOT NULL CHECK (email_type IN ('ga_ticket', 'vip_confirmation')),
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  related_id UUID,  -- ticket_id or vip_reservation_id
  resend_email_id TEXT,  -- Populated after successful send to Resend API
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'delivered', 'failed')),
  attempt_count INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  next_retry_at TIMESTAMPTZ DEFAULT NOW(),
  last_error TEXT,
  error_context JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment for documentation
COMMENT ON TABLE email_queue IS 'Queue for outbound emails with retry support';
COMMENT ON COLUMN email_queue.email_type IS 'Type of email: ga_ticket or vip_confirmation';
COMMENT ON COLUMN email_queue.resend_email_id IS 'Resend API email ID, populated after successful send';
COMMENT ON COLUMN email_queue.status IS 'pending=waiting, processing=being sent, sent=API accepted, delivered=confirmed via webhook, failed=max retries exceeded';
COMMENT ON COLUMN email_queue.related_id IS 'References ticket_id or vip_reservation_id depending on email_type';

-- ==========================================
-- 2. INDEXES FOR QUEUE PROCESSING
-- ==========================================
-- Partial index for efficient queue polling (only pending emails)
CREATE INDEX IF NOT EXISTS idx_email_queue_pending
  ON email_queue(next_retry_at)
  WHERE status = 'pending';

-- Index for looking up email status by Resend ID (for webhook correlation)
CREATE INDEX IF NOT EXISTS idx_email_queue_resend_id
  ON email_queue(resend_email_id)
  WHERE resend_email_id IS NOT NULL;

-- Index for finding emails related to a specific ticket/reservation
CREATE INDEX IF NOT EXISTS idx_email_queue_related
  ON email_queue(related_id, email_type);

-- Index for status queries (dashboard views)
CREATE INDEX IF NOT EXISTS idx_email_queue_status
  ON email_queue(status, created_at DESC);

-- ==========================================
-- 3. EMAIL DELIVERY STATUS TABLE
-- ==========================================
-- Stores webhook events from Resend for delivery tracking
-- Used to update email_queue status and for debugging

CREATE TABLE IF NOT EXISTS email_delivery_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resend_email_id TEXT NOT NULL,
  event_type TEXT NOT NULL,  -- email.sent, email.delivered, email.bounced, email.complained, email.opened, email.clicked
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment for documentation
COMMENT ON TABLE email_delivery_status IS 'Stores Resend webhook events for email delivery tracking';
COMMENT ON COLUMN email_delivery_status.event_type IS 'Resend event types: email.sent, email.delivered, email.bounced, etc.';
COMMENT ON COLUMN email_delivery_status.event_data IS 'Full webhook payload for debugging and auditing';

-- Index for looking up delivery events by Resend email ID
CREATE INDEX IF NOT EXISTS idx_email_delivery_resend_id
  ON email_delivery_status(resend_email_id);

-- Index for event type queries (e.g., finding all bounces)
CREATE INDEX IF NOT EXISTS idx_email_delivery_event_type
  ON email_delivery_status(event_type, created_at DESC);

-- ==========================================
-- 4. ROW LEVEL SECURITY POLICIES
-- ==========================================

-- Enable RLS on email_queue
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- Service role has full access (for edge functions processing the queue)
CREATE POLICY "Service role full access to email_queue"
  ON email_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can view emails related to their tickets/reservations
-- Note: This requires a join to tickets or vip_reservations tables in application code
-- For now, allow read access to own emails (checked via related_id in application)
CREATE POLICY "Users can view their email status"
  ON email_queue
  FOR SELECT
  TO authenticated
  USING (
    -- Check if user owns the related ticket
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.id = email_queue.related_id
      AND t.user_id = auth.uid()
    )
    OR
    -- Check if user owns the related VIP reservation
    EXISTS (
      SELECT 1 FROM vip_reservations vr
      WHERE vr.id = email_queue.related_id
      AND vr.customer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Enable RLS on email_delivery_status
ALTER TABLE email_delivery_status ENABLE ROW LEVEL SECURITY;

-- Service role has full access (for webhook handler)
CREATE POLICY "Service role full access to email_delivery_status"
  ON email_delivery_status
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Users can view delivery status for their emails
CREATE POLICY "Users can view their email delivery status"
  ON email_delivery_status
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM email_queue eq
      WHERE eq.resend_email_id = email_delivery_status.resend_email_id
      AND (
        EXISTS (
          SELECT 1 FROM tickets t
          WHERE t.id = eq.related_id
          AND t.user_id = auth.uid()
        )
        OR
        EXISTS (
          SELECT 1 FROM vip_reservations vr
          WHERE vr.id = eq.related_id
          AND vr.customer_email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
      )
    )
  );

-- ==========================================
-- 5. UPDATED_AT TRIGGER
-- ==========================================
-- Use existing update_updated_at_column function from prior migrations

CREATE TRIGGER update_email_queue_updated_at
  BEFORE UPDATE ON email_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- 6. HELPER FUNCTION: ENQUEUE EMAIL
-- ==========================================
-- Convenience function to add emails to the queue

CREATE OR REPLACE FUNCTION enqueue_email(
  p_email_type TEXT,
  p_recipient_email TEXT,
  p_subject TEXT,
  p_html_body TEXT,
  p_related_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email_id UUID;
BEGIN
  INSERT INTO email_queue (
    email_type,
    recipient_email,
    subject,
    html_body,
    related_id
  ) VALUES (
    p_email_type,
    p_recipient_email,
    p_subject,
    p_html_body,
    p_related_id
  )
  RETURNING id INTO v_email_id;

  RETURN v_email_id;
END;
$$;

COMMENT ON FUNCTION enqueue_email IS 'Add an email to the queue for sending';

-- ==========================================
-- 7. HELPER FUNCTION: GET PENDING EMAILS
-- ==========================================
-- Atomic function to claim pending emails for processing

CREATE OR REPLACE FUNCTION claim_pending_emails(
  p_batch_size INTEGER DEFAULT 10
)
RETURNS SETOF email_queue
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE email_queue
  SET
    status = 'processing',
    attempt_count = attempt_count + 1,
    updated_at = NOW()
  WHERE id IN (
    SELECT id FROM email_queue
    WHERE status = 'pending'
    AND next_retry_at <= NOW()
    AND attempt_count < max_attempts
    ORDER BY next_retry_at
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

COMMENT ON FUNCTION claim_pending_emails IS 'Atomically claim a batch of pending emails for processing (prevents duplicate sends)';

-- ==========================================
-- 8. HELPER FUNCTION: MARK EMAIL RESULT
-- ==========================================
-- Update email status after send attempt

CREATE OR REPLACE FUNCTION mark_email_sent(
  p_email_id UUID,
  p_resend_email_id TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE email_queue
  SET
    status = 'sent',
    resend_email_id = p_resend_email_id,
    updated_at = NOW()
  WHERE id = p_email_id;
END;
$$;

CREATE OR REPLACE FUNCTION mark_email_failed(
  p_email_id UUID,
  p_error TEXT,
  p_error_context JSONB DEFAULT '{}'::JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email email_queue%ROWTYPE;
BEGIN
  SELECT * INTO v_email FROM email_queue WHERE id = p_email_id;

  IF v_email.attempt_count >= v_email.max_attempts THEN
    -- Max retries exceeded, mark as failed
    UPDATE email_queue
    SET
      status = 'failed',
      last_error = p_error,
      error_context = p_error_context,
      updated_at = NOW()
    WHERE id = p_email_id;
  ELSE
    -- Schedule retry with exponential backoff (2^attempt * 30 seconds, max 30 minutes)
    UPDATE email_queue
    SET
      status = 'pending',
      last_error = p_error,
      error_context = p_error_context,
      next_retry_at = NOW() + (LEAST(POWER(2, v_email.attempt_count) * 30, 1800) || ' seconds')::INTERVAL,
      updated_at = NOW()
    WHERE id = p_email_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION mark_email_sent IS 'Mark email as successfully sent with Resend email ID';
COMMENT ON FUNCTION mark_email_failed IS 'Mark email as failed with retry scheduling using exponential backoff';

-- ==========================================
-- 9. HELPER FUNCTION: RECORD DELIVERY EVENT
-- ==========================================
-- Called by Resend webhook handler to record delivery events

CREATE OR REPLACE FUNCTION record_email_delivery_event(
  p_resend_email_id TEXT,
  p_event_type TEXT,
  p_event_data JSONB DEFAULT '{}'::JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Record the event
  INSERT INTO email_delivery_status (
    resend_email_id,
    event_type,
    event_data
  ) VALUES (
    p_resend_email_id,
    p_event_type,
    p_event_data
  );

  -- Update email_queue status based on event
  IF p_event_type = 'email.delivered' THEN
    UPDATE email_queue
    SET status = 'delivered', updated_at = NOW()
    WHERE resend_email_id = p_resend_email_id;
  ELSIF p_event_type IN ('email.bounced', 'email.complained') THEN
    UPDATE email_queue
    SET
      status = 'failed',
      last_error = p_event_type,
      error_context = p_event_data,
      updated_at = NOW()
    WHERE resend_email_id = p_resend_email_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION record_email_delivery_event IS 'Record Resend webhook delivery event and update queue status';
