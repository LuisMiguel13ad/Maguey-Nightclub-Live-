-- Migration: Add VIP Configuration to Events
-- Allows event owners to enable/disable VIP section per event
-- and customize VIP table pricing from the scanner dashboard

-- Add VIP configuration fields to events table
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS vip_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS vip_configured_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS vip_configured_by UUID REFERENCES auth.users(id);

-- Add comments for documentation
COMMENT ON COLUMN events.vip_enabled IS 'Whether VIP table reservations are available for this event';
COMMENT ON COLUMN events.vip_configured_at IS 'When VIP was last configured for this event';
COMMENT ON COLUMN events.vip_configured_by IS 'User who last configured VIP settings';

-- Create index for querying VIP-enabled events
CREATE INDEX IF NOT EXISTS idx_events_vip_enabled ON events(vip_enabled) WHERE vip_enabled = true;

-- Add is_available column to event_vip_tables if not exists
-- (for toggling individual table availability)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'event_vip_tables' AND column_name = 'is_available'
  ) THEN
    ALTER TABLE event_vip_tables ADD COLUMN is_available BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Function to toggle VIP for an event
CREATE OR REPLACE FUNCTION toggle_event_vip(
  p_event_id VARCHAR,
  p_enabled BOOLEAN,
  p_user_id UUID DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE events 
  SET 
    vip_enabled = p_enabled,
    vip_configured_at = NOW(),
    vip_configured_by = p_user_id,
    updated_at = NOW()
  WHERE id = p_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update VIP table price for an event
CREATE OR REPLACE FUNCTION update_vip_table_price(
  p_table_id UUID,
  p_new_price DECIMAL(10, 2)
)
RETURNS void AS $$
BEGIN
  UPDATE event_vip_tables 
  SET 
    price = p_new_price,
    updated_at = NOW()
  WHERE id = p_table_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to toggle individual VIP table availability
CREATE OR REPLACE FUNCTION toggle_vip_table_availability(
  p_table_id UUID,
  p_available BOOLEAN
)
RETURNS void AS $$
BEGIN
  UPDATE event_vip_tables 
  SET 
    is_available = p_available,
    updated_at = NOW()
  WHERE id = p_table_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION toggle_event_vip TO authenticated;
GRANT EXECUTE ON FUNCTION update_vip_table_price TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_vip_table_availability TO authenticated;

