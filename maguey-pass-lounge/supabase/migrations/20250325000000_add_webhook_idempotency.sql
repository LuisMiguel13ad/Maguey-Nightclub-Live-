-- Migration: Add Webhook Idempotency Protection
-- Prevents duplicate processing of webhooks when retried
-- Shared across all sites in the monorepo

BEGIN;

-- ============================================
-- 1. CREATE WEBHOOK IDEMPOTENCY TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS webhook_idempotency (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Unique identifier for the webhook (e.g., Stripe event.id, or hash of payload)
  idempotency_key TEXT NOT NULL,
  
  -- Type of webhook (stripe, ticket, etc.)
  webhook_type TEXT NOT NULL,
  
  -- When the webhook was processed
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Cached response data (to return on duplicate requests)
  response_data JSONB,
  
  -- HTTP status code of the response
  response_status INTEGER DEFAULT 200,
  
  -- Expiration time (for cleanup of old records)
  -- Default: 7 days
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  
  -- Additional metadata
  metadata JSONB DEFAULT '{}'::JSONB,
  
  -- Ensure idempotency_key + webhook_type is unique
  CONSTRAINT unique_idempotency_key UNIQUE (idempotency_key, webhook_type)
);

-- ============================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_webhook_idempotency_key 
ON webhook_idempotency(idempotency_key, webhook_type);

-- Index for cleanup queries (without predicate - just on the column)
CREATE INDEX IF NOT EXISTS idx_webhook_idempotency_expires 
ON webhook_idempotency(expires_at);

-- ============================================
-- 3. CREATE FUNCTION TO CHECK AND RECORD IDEMPOTENCY
-- ============================================

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
  FOR UPDATE SKIP LOCKED; -- Skip locked rows to prevent blocking

  IF FOUND THEN
    -- Webhook already processed - return cached response
    RETURN QUERY SELECT 
      TRUE,
      v_record.response_data,
      v_record.response_status,
      v_record.id;
  ELSE
    -- New webhook - create placeholder record
    INSERT INTO webhook_idempotency (
      idempotency_key,
      webhook_type,
      processed_at,
      expires_at
    ) VALUES (
      p_idempotency_key,
      p_webhook_type,
      NOW(),
      NOW() + INTERVAL '7 days'
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
-- 4. CREATE FUNCTION TO UPDATE IDEMPOTENCY RECORD
-- ============================================

CREATE OR REPLACE FUNCTION update_webhook_idempotency(
  p_record_id UUID,
  p_response_data JSONB,
  p_response_status INTEGER DEFAULT 200,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE webhook_idempotency
  SET 
    response_data = p_response_data,
    response_status = p_response_status,
    metadata = COALESCE(p_metadata, metadata),
    processed_at = NOW()
  WHERE id = p_record_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. CREATE CLEANUP FUNCTION
-- ============================================

-- Function to clean up expired idempotency records
CREATE OR REPLACE FUNCTION cleanup_expired_webhook_idempotency()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM webhook_idempotency
  WHERE expires_at < NOW();

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. GRANT PERMISSIONS
-- ============================================

-- Grant execute permissions to authenticated users and service role
GRANT EXECUTE ON FUNCTION check_webhook_idempotency TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION update_webhook_idempotency TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION cleanup_expired_webhook_idempotency TO authenticated, service_role;

-- Grant table permissions (service role can read/write, others can read)
GRANT SELECT, INSERT, UPDATE ON webhook_idempotency TO service_role;
GRANT SELECT ON webhook_idempotency TO authenticated, anon;

COMMIT;