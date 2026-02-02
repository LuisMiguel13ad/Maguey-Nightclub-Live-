-- =============================================================================
-- COMBINED SCANNER MIGRATIONS FOR PHASE 3
-- Run this in Supabase Dashboard SQL Editor
-- =============================================================================

-- =============================================================================
-- PART 1: Scanner Heartbeats Table (20260130000001_create_scanner_heartbeats.sql)
-- =============================================================================

-- Scanner heartbeat tracking for dashboard status display
CREATE TABLE IF NOT EXISTS scanner_heartbeats (
  device_id TEXT PRIMARY KEY,
  device_name TEXT,
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_online BOOLEAN NOT NULL DEFAULT true,
  pending_scans INTEGER NOT NULL DEFAULT 0,
  current_event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  current_event_name TEXT,
  scans_today INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for dashboard queries (most recent heartbeats first)
CREATE INDEX IF NOT EXISTS idx_scanner_heartbeats_last_heartbeat
  ON scanner_heartbeats(last_heartbeat DESC);

-- Index for finding online scanners
CREATE INDEX IF NOT EXISTS idx_scanner_heartbeats_is_online
  ON scanner_heartbeats(is_online)
  WHERE is_online = true;

-- RLS: Allow authenticated users to read, scanners to write their own
ALTER TABLE scanner_heartbeats ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can read scanner status" ON scanner_heartbeats;
DROP POLICY IF EXISTS "Authenticated users can upsert scanner heartbeats" ON scanner_heartbeats;
DROP POLICY IF EXISTS "Authenticated users can update scanner heartbeats" ON scanner_heartbeats;

-- Anyone authenticated can read scanner status (for dashboard)
CREATE POLICY "Authenticated users can read scanner status"
  ON scanner_heartbeats FOR SELECT
  TO authenticated
  USING (true);

-- Any authenticated user can insert/update scanner heartbeats
CREATE POLICY "Authenticated users can upsert scanner heartbeats"
  ON scanner_heartbeats FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update scanner heartbeats"
  ON scanner_heartbeats FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Trigger to update updated_at timestamp
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'update_updated_at_column'
  ) THEN
    CREATE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END
$$;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_scanner_heartbeats_updated_at ON scanner_heartbeats;
CREATE TRIGGER update_scanner_heartbeats_updated_at
  BEFORE UPDATE ON scanner_heartbeats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE scanner_heartbeats IS 'Tracks scanner device status via periodic heartbeats for dashboard monitoring';

-- =============================================================================
-- PART 2: Scan Race Condition Handling (20260130200000_add_scan_race_condition_handling.sql)
-- =============================================================================

-- Add scan_success column to scan_logs (if not exists)
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

-- Atomic scan function with race condition handling
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
    RETURN QUERY SELECT false, false, NULL::TIMESTAMPTZ, NULL::UUID, 'Ticket being processed by another scanner'::TEXT;
  WHEN unique_violation THEN
    RETURN QUERY SELECT false, true, NOW(), NULL::UUID, 'Concurrent scan - another device scanned first'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Offline sync function with first-scan-wins resolution
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
  SELECT * INTO v_ticket
  FROM tickets
  WHERE id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, false, NULL::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  IF v_ticket.is_used = true OR v_ticket.status = 'scanned' THEN
    SELECT sl.scanned_at, sl.device_id INTO v_existing_scan
    FROM scan_logs sl
    WHERE sl.ticket_id = p_ticket_id AND sl.scan_success = true
    LIMIT 1;

    IF v_existing_scan.scanned_at IS NOT NULL AND p_scanned_at < v_existing_scan.scanned_at THEN
      UPDATE tickets
      SET
        scanned_at = p_scanned_at,
        scanned_by = p_scanned_by,
        updated_at = NOW()
      WHERE id = p_ticket_id;

      UPDATE scan_logs
      SET
        scanned_at = p_scanned_at,
        scanned_by = p_scanned_by,
        device_id = p_device_id
      WHERE ticket_id = p_ticket_id AND scan_success = true;

      RETURN QUERY SELECT true, true, p_device_id, p_scanned_at;
    ELSE
      RETURN QUERY SELECT false, true, v_existing_scan.device_id, v_existing_scan.scanned_at;
    END IF;
    RETURN;
  END IF;

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

-- Add comments
COMMENT ON FUNCTION scan_ticket_atomic IS 'Atomic ticket scan with row-level locking to prevent race conditions';
COMMENT ON FUNCTION sync_offline_scan IS 'Sync offline scans with first-scan-wins conflict resolution';

-- =============================================================================
-- VERIFICATION QUERIES (uncomment to test)
-- =============================================================================
-- SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scanner_heartbeats');
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'scan_logs' AND column_name IN ('scan_success', 'device_id', 'scan_method');
-- SELECT proname FROM pg_proc WHERE proname IN ('scan_ticket_atomic', 'sync_offline_scan');
