-- Migration: Backfill VIP Tables for Existing Events
-- Creates default VIP tables for any events that don't have them yet

-- First, ensure the tables exist (IF NOT EXISTS makes this safe)
CREATE TABLE IF NOT EXISTS event_vip_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(255) NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  table_number INTEGER NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  tier VARCHAR(50) NOT NULL DEFAULT 'standard',
  price DECIMAL(10, 2) NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 6,
  bottles_included INTEGER NOT NULL DEFAULT 1,
  bottle_service_description TEXT,
  floor_section VARCHAR(100),
  position_description TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add constraint if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_table_per_event'
  ) THEN
    ALTER TABLE event_vip_tables ADD CONSTRAINT unique_table_per_event UNIQUE (event_id, table_number);
  END IF;
END $$;

-- Create VIP tables for existing events that don't have them
DO $$
DECLARE
  event_record RECORD;
BEGIN
  FOR event_record IN SELECT id FROM events WHERE is_active = true LOOP
    -- Check if tables already exist for this event
    IF NOT EXISTS (SELECT 1 FROM event_vip_tables WHERE event_id = event_record.id) THEN
      RAISE NOTICE 'Creating VIP tables for event: %', event_record.id;
      
      -- Create 8 default VIP tables for this event
      -- Tables 1-3: Premium (Left Wing) - $750
      INSERT INTO event_vip_tables (event_id, table_number, table_name, tier, price, capacity, bottles_included, floor_section, position_description, sort_order)
      VALUES
        (event_record.id, 1, 'Premium 1', 'premium', 750.00, 8, 2, 'Left Wing', 'Stage left', 1),
        (event_record.id, 2, 'Premium 2', 'premium', 750.00, 8, 2, 'Left Wing', 'Stage left corner', 2),
        (event_record.id, 3, 'Premium 3', 'premium', 750.00, 8, 2, 'Left Wing', 'Stage left back', 3);
      
      -- Tables 4-7: Front Row - $600
      INSERT INTO event_vip_tables (event_id, table_number, table_name, tier, price, capacity, bottles_included, floor_section, position_description, sort_order)
      VALUES
        (event_record.id, 4, 'Front Row 4', 'front_row', 600.00, 6, 1, 'Front Row', 'Center stage view', 4),
        (event_record.id, 5, 'Front Row 5', 'front_row', 600.00, 6, 1, 'Front Row', 'Center stage prime', 5),
        (event_record.id, 6, 'Front Row 6', 'front_row', 600.00, 6, 1, 'Front Row', 'Center stage view', 6),
        (event_record.id, 7, 'Front Row 7', 'front_row', 600.00, 6, 1, 'Front Row', 'Center stage right', 7);
      
      -- Table 8: Standard (Right Wing) - $500
      INSERT INTO event_vip_tables (event_id, table_number, table_name, tier, price, capacity, bottles_included, floor_section, position_description, sort_order)
      VALUES
        (event_record.id, 8, 'Standard 8', 'standard', 500.00, 6, 1, 'Right Wing', 'Stage right view', 8);
        
      -- Add more tables for variety (9-12)
      INSERT INTO event_vip_tables (event_id, table_number, table_name, tier, price, capacity, bottles_included, floor_section, position_description, sort_order)
      VALUES
        (event_record.id, 9, 'Standard 9', 'standard', 500.00, 6, 1, 'Center', 'Center floor', 9),
        (event_record.id, 10, 'Standard 10', 'standard', 500.00, 6, 1, 'Center', 'Center floor', 10),
        (event_record.id, 11, 'Standard 11', 'standard', 500.00, 6, 1, 'Center', 'Center floor', 11),
        (event_record.id, 12, 'Standard 12', 'standard', 500.00, 6, 1, 'Center', 'Center floor', 12);
    END IF;
  END LOOP;
END $$;

