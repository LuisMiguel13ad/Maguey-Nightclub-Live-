-- Migration: Add Payment Constraints and Payment Failures Table
-- Phase 01 Plan 01: Database-level protection against duplicate payments
-- This is the last line of defense - even if webhook idempotency fails,
-- unique constraints will reject duplicate inserts.

BEGIN;

-- ============================================
-- 1. UNIQUE CONSTRAINTS ON STRIPE PAYMENT IDS
-- ============================================

-- Orders: Add unique constraint on stripe_session_id
-- This prevents duplicate orders from the same checkout session
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'orders'
    AND constraint_name = 'unique_order_stripe_session'
    AND constraint_type = 'UNIQUE'
  ) THEN
    -- Only add constraint if column exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'orders' AND column_name = 'stripe_session_id'
    ) THEN
      -- Create partial unique index (NULLs don't conflict)
      CREATE UNIQUE INDEX IF NOT EXISTS unique_order_stripe_session
        ON orders(stripe_session_id)
        WHERE stripe_session_id IS NOT NULL;
    END IF;
  END IF;
END $$;

-- Orders: Add unique constraint on stripe_payment_intent_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'orders'
    AND indexname = 'unique_order_stripe_payment_intent'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'orders' AND column_name = 'stripe_payment_intent_id'
    ) THEN
      CREATE UNIQUE INDEX IF NOT EXISTS unique_order_stripe_payment_intent
        ON orders(stripe_payment_intent_id)
        WHERE stripe_payment_intent_id IS NOT NULL;
    END IF;
  END IF;
END $$;

-- VIP Reservations: Add unique constraint on stripe_payment_intent_id
-- This prevents duplicate VIP bookings from the same payment
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'vip_reservations'
    AND indexname = 'unique_vip_stripe_payment'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'vip_reservations' AND column_name = 'stripe_payment_intent_id'
    ) THEN
      CREATE UNIQUE INDEX IF NOT EXISTS unique_vip_stripe_payment
        ON vip_reservations(stripe_payment_intent_id)
        WHERE stripe_payment_intent_id IS NOT NULL;
    END IF;
  END IF;
END $$;

-- Note: tickets table doesn't have stripe_payment_intent_id directly
-- Tickets are protected indirectly through orders.stripe_session_id uniqueness
-- and the order_id foreign key relationship

-- ============================================
-- 2. PAYMENT FAILURES TABLE
-- ============================================

-- This table tracks failed payments for owner visibility and debugging
CREATE TABLE IF NOT EXISTS payment_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Stripe identifiers
  stripe_event_id TEXT,
  stripe_payment_intent_id TEXT,

  -- Customer information
  customer_email TEXT,
  amount_cents INTEGER,

  -- Error details
  error_message TEXT NOT NULL,
  error_code TEXT,

  -- Payment context
  payment_type TEXT NOT NULL CHECK (payment_type IN ('ga_ticket', 'vip_reservation')),
  event_id VARCHAR REFERENCES events(id),

  -- Resolution tracking
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  resolution_notes TEXT,

  -- Additional context
  metadata JSONB DEFAULT '{}'::JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. INDEXES FOR PAYMENT_FAILURES
-- ============================================

-- Index for filtering unresolved failures (owner dashboard)
CREATE INDEX IF NOT EXISTS idx_payment_failures_unresolved
  ON payment_failures(resolved, created_at DESC)
  WHERE resolved = FALSE;

-- Index for ordering by date (recent first)
CREATE INDEX IF NOT EXISTS idx_payment_failures_created
  ON payment_failures(created_at DESC);

-- Index for filtering by event
CREATE INDEX IF NOT EXISTS idx_payment_failures_event
  ON payment_failures(event_id)
  WHERE event_id IS NOT NULL;

-- Index for looking up by stripe payment intent (debugging)
CREATE INDEX IF NOT EXISTS idx_payment_failures_stripe_intent
  ON payment_failures(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- ============================================
-- 4. RLS POLICIES FOR PAYMENT_FAILURES
-- ============================================

ALTER TABLE payment_failures ENABLE ROW LEVEL SECURITY;

-- Note: There is no owner_assignments table in this schema.
-- Using a simpler approach: authenticated users can view all payment failures
-- In production, you may want to add an is_owner flag to users or create an owners table

-- Authenticated users can view payment failures (for owner dashboard)
-- Service role can also view
DROP POLICY IF EXISTS "payment_failures_select_authenticated" ON payment_failures;
CREATE POLICY "payment_failures_select_authenticated" ON payment_failures
  FOR SELECT TO authenticated
  USING (true);

-- Authenticated users can update (mark as resolved)
DROP POLICY IF EXISTS "payment_failures_update_authenticated" ON payment_failures;
CREATE POLICY "payment_failures_update_authenticated" ON payment_failures
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- Service role can insert (from webhook handlers)
DROP POLICY IF EXISTS "payment_failures_insert_service" ON payment_failures;
CREATE POLICY "payment_failures_insert_service" ON payment_failures
  FOR INSERT TO service_role
  WITH CHECK (true);

-- Service role has full access
DROP POLICY IF EXISTS "payment_failures_service_all" ON payment_failures;
CREATE POLICY "payment_failures_service_all" ON payment_failures
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 5. GRANTS FOR PAYMENT_FAILURES
-- ============================================

-- Service role: full access
GRANT SELECT, INSERT, UPDATE, DELETE ON payment_failures TO service_role;

-- Authenticated: read and update (for marking resolved)
GRANT SELECT, UPDATE ON payment_failures TO authenticated;

-- ============================================
-- 6. UPDATED_AT TRIGGER
-- ============================================

-- Use existing update_updated_at_column function if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
  ) THEN
    DROP TRIGGER IF EXISTS update_payment_failures_updated_at ON payment_failures;
    CREATE TRIGGER update_payment_failures_updated_at
      BEFORE UPDATE ON payment_failures
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================
-- 7. UPDATE IDEMPOTENCY CLEANUP TO 30 DAYS
-- ============================================

-- Per user decision: extend webhook idempotency retention from 7 days to 30 days
-- This provides longer protection against late duplicate webhooks

-- Update the check_webhook_idempotency function to use 30-day expiration
CREATE OR REPLACE FUNCTION check_webhook_idempotency(
  p_idempotency_key TEXT,
  p_webhook_type TEXT
)
RETURNS TABLE(
  is_duplicate BOOLEAN,
  cached_response JSONB,
  cached_status INTEGER,
  record_id UUID
) AS $$
DECLARE
  v_record RECORD;
BEGIN
  -- Try to find existing record
  SELECT * INTO v_record
  FROM webhook_idempotency
  WHERE idempotency_key = p_idempotency_key
    AND webhook_type = p_webhook_type
  FOR UPDATE SKIP LOCKED;

  IF FOUND THEN
    -- Webhook already processed - return cached response
    RETURN QUERY SELECT
      TRUE,
      v_record.response_data,
      v_record.response_status,
      v_record.id;
  ELSE
    -- New webhook - create placeholder record with 30-day expiration
    INSERT INTO webhook_idempotency (
      idempotency_key,
      webhook_type,
      processed_at,
      expires_at
    ) VALUES (
      p_idempotency_key,
      p_webhook_type,
      NOW(),
      NOW() + INTERVAL '30 days'  -- Changed from 7 days to 30 days
    ) RETURNING id, response_data, response_status INTO v_record;

    -- Return new record (not a duplicate)
    RETURN QUERY SELECT
      FALSE,
      NULL::JSONB,
      200,
      v_record.id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE payment_failures IS 'Tracks failed Stripe payments for owner notification and debugging. Part of payment flow hardening.';

COMMENT ON COLUMN payment_failures.payment_type IS 'Type of payment: ga_ticket (general admission) or vip_reservation';
COMMENT ON COLUMN payment_failures.resolved IS 'Whether the failure has been reviewed and resolved by owner/admin';
COMMENT ON COLUMN payment_failures.resolution_notes IS 'Notes from owner about how the failure was resolved';

COMMENT ON INDEX unique_order_stripe_session IS 'Prevents duplicate orders from same Stripe checkout session';
COMMENT ON INDEX unique_vip_stripe_payment IS 'Prevents duplicate VIP reservations from same Stripe payment intent';

COMMIT;
