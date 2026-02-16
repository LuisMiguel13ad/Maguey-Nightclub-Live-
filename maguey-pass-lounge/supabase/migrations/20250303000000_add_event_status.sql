-- Migration: Add status field to events table
-- This allows filtering events by publication status

-- Add status column to events table
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived'));

-- Create index for status filtering
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_status_date ON events(status, event_date);

-- Update existing events to 'published' status (assuming they should be visible)
UPDATE events SET status = 'published' WHERE status IS NULL OR status = 'draft';

-- Add comment
COMMENT ON COLUMN events.status IS 'Event publication status: draft (not visible), published (visible), archived (hidden)';

