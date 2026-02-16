-- Migration: Ensure event_id and event image are properly linked
-- This migration adds any missing columns and ensures data integrity

-- Add event_id column to tickets if it doesn't exist (should already be in main migration)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tickets' AND column_name = 'event_id'
  ) THEN
    ALTER TABLE tickets ADD COLUMN event_id VARCHAR REFERENCES events(id);
  END IF;
END $$;

-- Ensure events table has image_url column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'events' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE events ADD COLUMN image_url VARCHAR;
  END IF;
END $$;

-- Add index on event_id in tickets for better JOIN performance
CREATE INDEX IF NOT EXISTS idx_tickets_event_id_fk ON tickets(event_id);

-- Create a view for ticket scanning (includes event image)
CREATE OR REPLACE VIEW ticket_scan_view AS
SELECT 
  t.id,
  t.ticket_id,
  t.order_id,
  t.event_id,
  t.ticket_type,
  t.ticket_type_name,
  t.status,
  t.price,
  t.fee,
  t.total,
  t.issued_at,
  t.checked_in_at,
  t.expires_at,
  -- Event information
  e.name AS event_name,
  e.image_url AS event_image,
  e.date AS event_date,
  e.time AS event_time,
  e.venue_name,
  e.venue_address,
  e.city,
  -- Order information
  o.customer_first_name,
  o.customer_last_name,
  o.customer_email,
  o.total AS order_total
FROM tickets t
JOIN events e ON t.event_id = e.id
JOIN orders o ON t.order_id = o.id;

COMMENT ON VIEW ticket_scan_view IS 'View for scanner to quickly access ticket with event image and details';

