-- Scanner heartbeat tracking for dashboard status display
-- Phase 03-05: Scanner status monitoring

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

-- Anyone authenticated can read scanner status (for dashboard)
CREATE POLICY "Authenticated users can read scanner status"
  ON scanner_heartbeats FOR SELECT
  TO authenticated
  USING (true);

-- Any authenticated user can insert/update scanner heartbeats
-- (scanners authenticate as users)
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
-- Check if function exists first (it was created in earlier migrations)
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

-- Comment for documentation
COMMENT ON TABLE scanner_heartbeats IS 'Tracks scanner device status via periodic heartbeats for dashboard monitoring';
COMMENT ON COLUMN scanner_heartbeats.device_id IS 'Unique device identifier from localStorage';
COMMENT ON COLUMN scanner_heartbeats.is_online IS 'Whether device reported navigator.onLine as true';
COMMENT ON COLUMN scanner_heartbeats.pending_scans IS 'Number of scans queued for sync';
COMMENT ON COLUMN scanner_heartbeats.scans_today IS 'Total successful scans today';
