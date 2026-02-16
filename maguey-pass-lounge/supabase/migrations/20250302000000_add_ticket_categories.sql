-- Migration: Add ticket categories and sections
-- Adds category, section_name, section_description, and display_order to ticket_types table
-- Updates ticket_scan_view to include category information

BEGIN;

-- Create ticket_types table if it doesn't exist
CREATE TABLE IF NOT EXISTS ticket_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id VARCHAR NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  code VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
  limit_per_order INTEGER NOT NULL DEFAULT 10,
  total_inventory INTEGER,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, code)
);

-- Add category column to ticket_types
ALTER TABLE ticket_types 
  ADD COLUMN IF NOT EXISTS category VARCHAR DEFAULT 'general';

-- Add section_name column to ticket_types
ALTER TABLE ticket_types 
  ADD COLUMN IF NOT EXISTS section_name VARCHAR;

-- Add section_description column to ticket_types
ALTER TABLE ticket_types 
  ADD COLUMN IF NOT EXISTS section_description TEXT;

-- Add display_order column to ticket_types
ALTER TABLE ticket_types 
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Create index on category for faster filtering
CREATE INDEX IF NOT EXISTS idx_ticket_types_category ON ticket_types(category);

-- Create index on event_id and display_order for ordered queries
CREATE INDEX IF NOT EXISTS idx_ticket_types_event_display ON ticket_types(event_id, display_order);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ticket_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_ticket_types_updated_at ON ticket_types;
CREATE TRIGGER update_ticket_types_updated_at
  BEFORE UPDATE ON ticket_types
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_types_updated_at();

-- Add comments for documentation
COMMENT ON COLUMN ticket_types.category IS 'Ticket category: general, vip, service, or section';
COMMENT ON COLUMN ticket_types.section_name IS 'Specific section name (e.g., VIP Section A, Bottle Service Table 1)';
COMMENT ON COLUMN ticket_types.section_description IS 'Optional description of the section or service';
COMMENT ON COLUMN ticket_types.display_order IS 'Order for displaying tickets in UI (lower numbers first)';

COMMIT;

