-- Add age restriction column to events table
-- Used by nightclub events to indicate minimum age requirements (e.g., "18+", "21+")
-- Displayed on event details and enforced as acknowledgment checkbox at checkout

ALTER TABLE events ADD COLUMN IF NOT EXISTS age_restriction VARCHAR(10) DEFAULT NULL;

COMMENT ON COLUMN events.age_restriction IS 'Minimum age restriction for event entry (e.g., 18+, 21+). NULL means no restriction.';
