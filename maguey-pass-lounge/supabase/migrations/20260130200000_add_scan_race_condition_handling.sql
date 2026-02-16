-- Migration: Add race condition handling for concurrent ticket scans
-- This prevents two scanners from successfully scanning the same ticket simultaneously

-- 1. Add unique constraint on scan_logs for successful scans
-- This ensures only one successful scan record can exist per ticket
-- The constraint only applies to successful scans (not failed attempts)

-- First, add a column to track scan success (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scan_logs' AND column_name = 'scan_success'
  ) THEN
    ALTER TABLE scan_logs ADD COLUMN scan_success BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Add device_id column if not exists (for tracking which device scanned)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scan_logs' AND column_name = 'device_id'
  ) THEN
    ALTER TABLE scan_logs ADD COLUMN device_id TEXT;
  END IF;
END $$;

-- Add scan_method column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scan_logs' AND column_name = 'scan_method'
  ) THEN
    ALTER TABLE scan_logs ADD COLUMN scan_method TEXT DEFAULT 'qr';
  END IF;
END $$;

-- Create partial unique index: only one successful scan per ticket
CREATE UNIQUE INDEX IF NOT EXISTS unique_successful_scan
ON scan_logs (ticket_id)
WHERE scan_success = true;

-- 2. Create function for atomic scan with race condition handling
CREATE OR REPLACE FUNCTION scan_ticket_atomic(
  p_ticket_id UUID,
  p_scanned_by UUID,
  p_device_id TEXT DEFAULT NULL,
  p_scan_method TEXT DEFAULT 'qr'
) RETURNS TABLE (
  success BOOLEAN,
  already_scanned BOOLEAN,
  scanned_at TIMESTAMPTZ,
  scanned_by UUID,
  error_message TEXT
) AS $$
DECLARE
  v_ticket RECORD;
  v_existing_scan RECORD;
BEGIN
  -- Lock the ticket row to prevent concurrent modifications
  SELECT * INTO v_ticket
  FROM tickets
  WHERE id = p_ticket_id
  FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, false, NULL::TIMESTAMPTZ, NULL::UUID, 'Ticket not found'::TEXT;
    RETURN;
  END IF;

  -- Check if already scanned
  IF v_ticket.is_used = true OR v_ticket.status = 'scanned' THEN
    -- Return existing scan info
    SELECT sl.scanned_at, sl.scanned_by INTO v_existing_scan
    FROM scan_logs sl
    WHERE sl.ticket_id = p_ticket_id AND sl.scan_success = true
    LIMIT 1;

    RETURN QUERY SELECT
      false,
      true,
      COALESCE(v_existing_scan.scanned_at, v_ticket.scanned_at),
      COALESCE(v_existing_scan.scanned_by, v_ticket.scanned_by),
      'Ticket already scanned'::TEXT;
    RETURN;
  END IF;

  -- Attempt to mark as scanned (atomic update)
  UPDATE tickets
  SET
    is_used = true,
    status = 'scanned',
    scanned_at = NOW(),
    scanned_by = p_scanned_by,
    updated_at = NOW()
  WHERE id = p_ticket_id
    AND is_used = false
    AND (status IS NULL OR status != 'scanned');

  IF NOT FOUND THEN
    -- Another transaction beat us - race condition handled
    RETURN QUERY SELECT false, true, NOW(), NULL::UUID, 'Concurrent scan detected'::TEXT;
    RETURN;
  END IF;

  -- Log the successful scan
  INSERT INTO scan_logs (
    ticket_id,
    scanned_by,
    scanned_at,
    scan_method,
    device_id,
    scan_success
  ) VALUES (
    p_ticket_id,
    p_scanned_by,
    NOW(),
    p_scan_method,
    p_device_id,
    true
  )
  ON CONFLICT (ticket_id) WHERE scan_success = true DO NOTHING;

  RETURN QUERY SELECT true, false, NOW(), p_scanned_by, NULL::TEXT;

EXCEPTION
  WHEN lock_not_available THEN
    -- Another transaction has the lock - likely concurrent scan
    RETURN QUERY SELECT false, false, NULL::TIMESTAMPTZ, NULL::UUID, 'Ticket being processed by another scanner'::TEXT;
  WHEN unique_violation THEN
    -- Unique constraint caught the race condition
    RETURN QUERY SELECT false, true, NOW(), NULL::UUID, 'Concurrent scan - another device scanned first'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 3. Create function for offline sync with first-scan-wins resolution
CREATE OR REPLACE FUNCTION sync_offline_scan(
  p_ticket_id UUID,
  p_scanned_by UUID,
  p_scanned_at TIMESTAMPTZ,
  p_device_id TEXT DEFAULT NULL
) RETURNS TABLE (
  success BOOLEAN,
  conflict_resolved BOOLEAN,
  winner_device TEXT,
  winner_time TIMESTAMPTZ
) AS $$
DECLARE
  v_ticket RECORD;
  v_existing_scan RECORD;
BEGIN
  -- Lock the ticket
  SELECT * INTO v_ticket
  FROM tickets
  WHERE id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, false, NULL::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- Check if already scanned
  IF v_ticket.is_used = true OR v_ticket.status = 'scanned' THEN
    -- Get existing scan details
    SELECT sl.scanned_at, sl.device_id INTO v_existing_scan
    FROM scan_logs sl
    WHERE sl.ticket_id = p_ticket_id AND sl.scan_success = true
    LIMIT 1;

    -- First-scan-wins: compare timestamps
    IF v_existing_scan.scanned_at IS NOT NULL AND p_scanned_at < v_existing_scan.scanned_at THEN
      -- Offline scan was first - update to reflect true first scanner
      -- (This is rare but handles the edge case correctly)
      UPDATE tickets
      SET
        scanned_at = p_scanned_at,
        scanned_by = p_scanned_by,
        updated_at = NOW()
      WHERE id = p_ticket_id;

      -- Update scan log
      UPDATE scan_logs
      SET
        scanned_at = p_scanned_at,
        scanned_by = p_scanned_by,
        device_id = p_device_id
      WHERE ticket_id = p_ticket_id AND scan_success = true;

      RETURN QUERY SELECT true, true, p_device_id, p_scanned_at;
    ELSE
      -- Existing scan was first - offline scan loses
      RETURN QUERY SELECT false, true, v_existing_scan.device_id, v_existing_scan.scanned_at;
    END IF;
    RETURN;
  END IF;

  -- Not yet scanned - apply offline scan
  UPDATE tickets
  SET
    is_used = true,
    status = 'scanned',
    scanned_at = p_scanned_at,
    scanned_by = p_scanned_by,
    updated_at = NOW()
  WHERE id = p_ticket_id;

  INSERT INTO scan_logs (
    ticket_id,
    scanned_by,
    scanned_at,
    scan_method,
    device_id,
    scan_success
  ) VALUES (
    p_ticket_id,
    p_scanned_by,
    p_scanned_at,
    'offline_sync',
    p_device_id,
    true
  )
  ON CONFLICT (ticket_id) WHERE scan_success = true DO NOTHING;

  RETURN QUERY SELECT true, false, p_device_id, p_scanned_at;
END;
$$ LANGUAGE plpgsql;

-- Add comments explaining the race condition handling
COMMENT ON FUNCTION scan_ticket_atomic IS 'Atomic ticket scan with row-level locking to prevent race conditions from concurrent scanners';
COMMENT ON FUNCTION sync_offline_scan IS 'Sync offline scans with first-scan-wins conflict resolution based on timestamps';
COMMENT ON INDEX unique_successful_scan IS 'Ensures only one successful scan per ticket - database-level race condition protection';
