-- Migration: Add Re-entry Tracking Support
-- Creates scan_history table and adds re-entry columns to tickets table

-- Create scan_history table for tracking entry/exit logs
CREATE TABLE IF NOT EXISTS scan_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  scan_type TEXT NOT NULL CHECK (scan_type IN ('entry', 'exit')),
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scanned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  device_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_scan_history_ticket_id ON scan_history(ticket_id);
CREATE INDEX IF NOT EXISTS idx_scan_history_scanned_at ON scan_history(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_history_scan_type ON scan_history(scan_type);

-- Add re-entry tracking columns to tickets table
ALTER TABLE tickets 
  ADD COLUMN IF NOT EXISTS current_status TEXT DEFAULT 'outside' CHECK (current_status IN ('inside', 'outside', 'left')),
  ADD COLUMN IF NOT EXISTS entry_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exit_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_entry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_exit_at TIMESTAMPTZ;

-- Create index for current_status queries
CREATE INDEX IF NOT EXISTS idx_tickets_current_status ON tickets(current_status);

-- Update existing scanned tickets to have current_status = 'inside' if they were scanned
UPDATE tickets 
SET current_status = 'inside', entry_count = 1, last_entry_at = scanned_at
WHERE status = 'scanned' AND scanned_at IS NOT NULL AND current_status IS NULL;

-- Enable RLS on scan_history table
ALTER TABLE scan_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for scan_history
-- Allow authenticated users to read scan history
CREATE POLICY "Allow authenticated users to read scan history"
  ON scan_history
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert scan history
CREATE POLICY "Allow authenticated users to insert scan history"
  ON scan_history
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow service role to do everything (for backend operations)
CREATE POLICY "Allow service role full access to scan_history"
  ON scan_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add comment to table
COMMENT ON TABLE scan_history IS 'Tracks entry and exit scans for re-entry tracking';
COMMENT ON COLUMN tickets.current_status IS 'Current location status: inside, outside, or left';
COMMENT ON COLUMN tickets.entry_count IS 'Number of times ticket holder has entered';
COMMENT ON COLUMN tickets.exit_count IS 'Number of times ticket holder has exited';

