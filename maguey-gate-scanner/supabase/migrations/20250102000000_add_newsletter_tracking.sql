-- Add newsletter tracking columns to events table
ALTER TABLE events
ADD COLUMN IF NOT EXISTS newsletter_sent_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS newsletter_sent_count INTEGER DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN events.newsletter_sent_at IS 'Timestamp when newsletter announcement was sent for this event';
COMMENT ON COLUMN events.newsletter_sent_count IS 'Number of subscribers the announcement was sent to';
