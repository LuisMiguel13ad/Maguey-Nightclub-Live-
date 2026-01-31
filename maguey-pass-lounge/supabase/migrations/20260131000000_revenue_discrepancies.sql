-- Migration: Create Revenue Discrepancies Audit Table
-- Purpose: Track and audit discrepancies between database revenue and Stripe payment records
-- Used by: verify-revenue Edge Function for revenue reconciliation

-- ============================================================================
-- Revenue Discrepancies Table
-- ============================================================================
-- Stores audit records when database revenue calculations don't match Stripe's
-- authoritative payment records. Enables transparency by logging discrepancies
-- for owner review and resolution.

CREATE TABLE IF NOT EXISTS revenue_discrepancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event reference (nullable for global/cross-event checks)
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,

  -- Revenue figures (in dollars, 2 decimal places)
  db_revenue NUMERIC(10,2) NOT NULL,           -- Database calculated total
  stripe_revenue NUMERIC(10,2) NOT NULL,       -- Stripe verified total
  discrepancy_amount NUMERIC(10,2) NOT NULL,   -- Absolute difference |db - stripe|
  discrepancy_percent NUMERIC(5,2),            -- Percentage difference

  -- Time period for the verification
  period_start TIMESTAMPTZ,                    -- Start of verified period
  period_end TIMESTAMPTZ,                      -- End of verified period

  -- Audit timestamps
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,                     -- When discrepancy was investigated/resolved
  resolution_notes TEXT,                       -- How it was resolved or explained

  -- Additional context for debugging
  metadata JSONB DEFAULT '{}'::jsonb           -- Stripe transaction IDs, ticket IDs, etc.
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Fast lookup by event
CREATE INDEX idx_revenue_discrepancies_event_id
  ON revenue_discrepancies(event_id);

-- Recent discrepancies first
CREATE INDEX idx_revenue_discrepancies_checked_at
  ON revenue_discrepancies(checked_at DESC);

-- Find unresolved discrepancies for an event
CREATE INDEX idx_revenue_discrepancies_unresolved
  ON revenue_discrepancies(event_id)
  WHERE resolved_at IS NULL;

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE revenue_discrepancies ENABLE ROW LEVEL SECURITY;

-- SELECT: Authenticated users (owners) can view discrepancies
-- This allows dashboard access to discrepancy history
CREATE POLICY "Authenticated users can view revenue discrepancies"
  ON revenue_discrepancies
  FOR SELECT
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- INSERT: Service role only (Edge Functions)
-- Prevents unauthorized discrepancy logging
CREATE POLICY "Only service role can insert revenue discrepancies"
  ON revenue_discrepancies
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- UPDATE: Authenticated users can mark as resolved
-- Allows owners to add resolution notes and mark investigated
CREATE POLICY "Authenticated users can update revenue discrepancies"
  ON revenue_discrepancies
  FOR UPDATE
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- DELETE: Service role only (rarely needed, audit data should persist)
CREATE POLICY "Only service role can delete revenue discrepancies"
  ON revenue_discrepancies
  FOR DELETE
  USING (auth.role() = 'service_role');

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE revenue_discrepancies IS 'Audit log of discrepancies between database revenue and Stripe payment totals';
COMMENT ON COLUMN revenue_discrepancies.db_revenue IS 'Sum of tickets.price + vip_reservations.amount_paid_cents/100 from database';
COMMENT ON COLUMN revenue_discrepancies.stripe_revenue IS 'Sum of balance transactions from Stripe API for the period';
COMMENT ON COLUMN revenue_discrepancies.discrepancy_amount IS 'Absolute difference: |db_revenue - stripe_revenue|';
COMMENT ON COLUMN revenue_discrepancies.discrepancy_percent IS 'Percentage difference: (discrepancy_amount / stripe_revenue) * 100';
COMMENT ON COLUMN revenue_discrepancies.metadata IS 'Additional context: transaction IDs, breakdown by type, etc.';
