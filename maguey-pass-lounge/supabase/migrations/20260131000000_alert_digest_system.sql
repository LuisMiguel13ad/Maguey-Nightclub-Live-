-- Migration: Alert digest system for aggregated error notifications
-- Purpose: Aggregate errors before alerting to prevent email spam
-- Plan: 06-05 (Email Alert Digest System)

-- ========================================
-- 1. Alert Digest Table
-- ========================================

CREATE TABLE IF NOT EXISTS alert_digest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_type TEXT NOT NULL,
  error_hash TEXT NOT NULL, -- MD5 hash of error_type + message for grouping
  first_occurrence TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_occurrence TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  sample_error JSONB NOT NULL, -- First error details for context
  notified_at TIMESTAMPTZ, -- When digest email was sent
  resolved_at TIMESTAMPTZ, -- When issue was marked resolved
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint: one entry per error_hash per day (group by date)
  UNIQUE(error_hash, (first_occurrence::date))
);

-- Index for fetching unnotified errors
CREATE INDEX idx_alert_digest_unnotified
  ON alert_digest (notified_at)
  WHERE notified_at IS NULL;

-- Index for dashboard queries
CREATE INDEX idx_alert_digest_recent
  ON alert_digest (last_occurrence DESC);

-- ========================================
-- 2. Aggregate Error Function
-- ========================================

-- Function to aggregate errors (called by edge functions)
CREATE OR REPLACE FUNCTION aggregate_error(
  p_error_type TEXT,
  p_error_message TEXT,
  p_error_details JSONB DEFAULT '{}'::JSONB
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_hash TEXT;
  v_id UUID;
  v_today DATE := CURRENT_DATE;
BEGIN
  -- Create hash from error type and message for grouping
  v_hash := md5(p_error_type || ':' || COALESCE(p_error_message, 'unknown'));

  -- Upsert: insert new or update existing error entry for today
  INSERT INTO alert_digest (
    error_type,
    error_hash,
    sample_error,
    first_occurrence,
    last_occurrence,
    occurrence_count
  )
  VALUES (
    p_error_type,
    v_hash,
    jsonb_build_object(
      'message', p_error_message,
      'details', p_error_details,
      'timestamp', NOW()
    ),
    NOW(),
    NOW(),
    1
  )
  ON CONFLICT (error_hash, (first_occurrence::date))
  DO UPDATE SET
    last_occurrence = NOW(),
    occurrence_count = alert_digest.occurrence_count + 1
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ========================================
-- 3. RLS Policies
-- ========================================

ALTER TABLE alert_digest ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view alerts (for dashboard)
CREATE POLICY "Authenticated users can view alerts"
  ON alert_digest
  FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can mark alerts as resolved
CREATE POLICY "Authenticated users can update alerts"
  ON alert_digest
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Service role can insert and update (for edge functions)
CREATE POLICY "Service role can manage alerts"
  ON alert_digest
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ========================================
-- 4. Comments
-- ========================================

COMMENT ON TABLE alert_digest IS 'Aggregated error log for digest notifications';
COMMENT ON COLUMN alert_digest.error_hash IS 'MD5 hash of error_type:message for grouping similar errors';
COMMENT ON COLUMN alert_digest.sample_error IS 'First error occurrence details as JSONB';
COMMENT ON COLUMN alert_digest.notified_at IS 'When digest email was sent (NULL = not yet notified)';
COMMENT ON FUNCTION aggregate_error IS 'Aggregate an error into the digest table for later notification';
