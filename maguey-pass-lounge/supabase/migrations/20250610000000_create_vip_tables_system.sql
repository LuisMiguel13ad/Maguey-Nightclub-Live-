-- Migration: Create VIP Tables Reservation System
-- This migration creates tables for VIP table reservations with QR codes for each guest
-- Run this in your Supabase SQL Editor

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- VIP Tables - The 26 tables in the venue
-- ============================================================================
CREATE TABLE IF NOT EXISTS vip_tables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_number VARCHAR(10) NOT NULL UNIQUE,
  table_name VARCHAR(100) NOT NULL,
  tier VARCHAR(20) NOT NULL CHECK (tier IN ('premium', 'standard', 'regular')),
  price DECIMAL(10, 2) NOT NULL,
  guest_capacity INTEGER NOT NULL,
  bottle_service_description TEXT NOT NULL,
  floor_section VARCHAR(50), -- e.g., 'Main Floor', 'VIP Section', 'Balcony'
  position_description TEXT, -- e.g., 'Near DJ booth', 'Corner with view'
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Table Reservations - Bookings for each event
-- ============================================================================
CREATE TABLE IF NOT EXISTS table_reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_number VARCHAR(20) UNIQUE NOT NULL, -- e.g., VIP-20251215-001
  event_id VARCHAR NOT NULL REFERENCES events(id),
  table_id UUID NOT NULL REFERENCES vip_tables(id),
  
  -- Customer Information
  customer_first_name VARCHAR(100) NOT NULL,
  customer_last_name VARCHAR(100) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  
  -- Reservation Details
  guest_count INTEGER NOT NULL,
  bottle_choice VARCHAR(255), -- Customer's bottle selection
  special_requests TEXT,
  
  -- Pricing
  table_price DECIMAL(10, 2) NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  
  -- Payment
  stripe_payment_intent_id VARCHAR(255),
  stripe_session_id VARCHAR(255),
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  paid_at TIMESTAMP WITH TIME ZONE,
  
  -- Reservation Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
  is_walk_in BOOLEAN DEFAULT false,
  
  -- Arrival Tracking
  checked_in_guests INTEGER DEFAULT 0,
  arrival_time TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id), -- For walk-in reservations by staff
  notes TEXT, -- Internal notes for staff
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure same table can't be booked twice for same event
  CONSTRAINT unique_table_per_event UNIQUE (event_id, table_id)
);

-- ============================================================================
-- Table Guest Passes - QR codes for each guest in a reservation
-- ============================================================================
CREATE TABLE IF NOT EXISTS table_guest_passes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pass_id VARCHAR(50) UNIQUE NOT NULL, -- e.g., VIP-PASS-ABC123
  reservation_id UUID NOT NULL REFERENCES table_reservations(id) ON DELETE CASCADE,
  
  -- Guest Details (optional - for named passes)
  guest_name VARCHAR(200),
  guest_number INTEGER NOT NULL, -- 1, 2, 3... up to guest_count
  
  -- QR Code Security (same pattern as regular tickets)
  qr_token VARCHAR(100) UNIQUE NOT NULL,
  qr_signature TEXT NOT NULL,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'checked_in', 'cancelled')),
  checked_in_at TIMESTAMP WITH TIME ZONE,
  checked_in_by UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Indexes for better performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_vip_tables_tier ON vip_tables(tier);
CREATE INDEX IF NOT EXISTS idx_vip_tables_active ON vip_tables(is_active);

CREATE INDEX IF NOT EXISTS idx_table_reservations_event ON table_reservations(event_id);
CREATE INDEX IF NOT EXISTS idx_table_reservations_table ON table_reservations(table_id);
CREATE INDEX IF NOT EXISTS idx_table_reservations_customer_email ON table_reservations(customer_email);
CREATE INDEX IF NOT EXISTS idx_table_reservations_customer_phone ON table_reservations(customer_phone);
CREATE INDEX IF NOT EXISTS idx_table_reservations_status ON table_reservations(status);
CREATE INDEX IF NOT EXISTS idx_table_reservations_payment_status ON table_reservations(payment_status);
CREATE INDEX IF NOT EXISTS idx_table_reservations_reservation_number ON table_reservations(reservation_number);

CREATE INDEX IF NOT EXISTS idx_table_guest_passes_reservation ON table_guest_passes(reservation_id);
CREATE INDEX IF NOT EXISTS idx_table_guest_passes_qr_token ON table_guest_passes(qr_token);
CREATE INDEX IF NOT EXISTS idx_table_guest_passes_status ON table_guest_passes(status);
CREATE INDEX IF NOT EXISTS idx_table_guest_passes_pass_id ON table_guest_passes(pass_id);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================
ALTER TABLE vip_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_guest_passes ENABLE ROW LEVEL SECURITY;

-- VIP Tables: Public read access for available tables
CREATE POLICY "VIP tables are viewable by everyone"
  ON vip_tables FOR SELECT
  USING (true);

-- VIP Tables: Only service role can modify
CREATE POLICY "Only service role can modify vip_tables"
  ON vip_tables FOR ALL
  USING (auth.role() = 'service_role');

-- Table Reservations: Users can view their own reservations, staff can view all
CREATE POLICY "Users can view their own reservations"
  ON table_reservations FOR SELECT
  USING (
    customer_email = auth.jwt() ->> 'email'
    OR auth.role() = 'service_role'
    OR auth.role() = 'authenticated'
  );

-- Table Reservations: Service role can insert/update/delete
CREATE POLICY "Service role can manage reservations"
  ON table_reservations FOR ALL
  USING (auth.role() = 'service_role');

-- Table Reservations: Allow public insert for booking (through edge function)
CREATE POLICY "Allow public reservation creation"
  ON table_reservations FOR INSERT
  WITH CHECK (true);

-- Table Guest Passes: Users can view passes for their reservations
CREATE POLICY "Users can view their guest passes"
  ON table_guest_passes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM table_reservations
      WHERE table_reservations.id = table_guest_passes.reservation_id
      AND (
        table_reservations.customer_email = auth.jwt() ->> 'email'
        OR auth.role() = 'service_role'
        OR auth.role() = 'authenticated'
      )
    )
  );

-- Table Guest Passes: Service role can manage all
CREATE POLICY "Service role can manage guest passes"
  ON table_guest_passes FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- Triggers for updated_at
-- ============================================================================
CREATE TRIGGER update_vip_tables_updated_at BEFORE UPDATE ON vip_tables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_table_reservations_updated_at BEFORE UPDATE ON table_reservations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_table_guest_passes_updated_at BEFORE UPDATE ON table_guest_passes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Function to generate reservation number
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_reservation_number()
RETURNS TEXT AS $$
DECLARE
  date_part TEXT;
  seq_part TEXT;
  new_number TEXT;
BEGIN
  date_part := TO_CHAR(NOW(), 'YYYYMMDD');
  
  -- Get the count of reservations today + 1
  SELECT LPAD((COALESCE(MAX(
    CAST(SUBSTRING(reservation_number FROM 14 FOR 3) AS INTEGER)
  ), 0) + 1)::TEXT, 3, '0')
  INTO seq_part
  FROM table_reservations
  WHERE reservation_number LIKE 'VIP-' || date_part || '-%';
  
  new_number := 'VIP-' || date_part || '-' || seq_part;
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Function to generate pass ID
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_pass_id()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := 'VIP-PASS-';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || SUBSTR(chars, FLOOR(RANDOM() * LENGTH(chars) + 1)::INTEGER, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Function to check table availability for an event
-- ============================================================================
CREATE OR REPLACE FUNCTION check_table_availability(
  p_event_id VARCHAR,
  p_table_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  is_available BOOLEAN;
BEGIN
  SELECT NOT EXISTS (
    SELECT 1 FROM table_reservations
    WHERE event_id = p_event_id
    AND table_id = p_table_id
    AND status NOT IN ('cancelled')
    AND payment_status NOT IN ('failed', 'refunded')
  ) INTO is_available;
  
  RETURN is_available;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Function to get available tables for an event
-- ============================================================================
CREATE OR REPLACE FUNCTION get_available_tables(p_event_id VARCHAR)
RETURNS TABLE (
  id UUID,
  table_number VARCHAR(10),
  table_name VARCHAR(100),
  tier VARCHAR(20),
  price DECIMAL(10, 2),
  guest_capacity INTEGER,
  bottle_service_description TEXT,
  floor_section VARCHAR(50),
  position_description TEXT,
  is_available BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.table_number,
    t.table_name,
    t.tier,
    t.price,
    t.guest_capacity,
    t.bottle_service_description,
    t.floor_section,
    t.position_description,
    check_table_availability(p_event_id, t.id) as is_available
  FROM vip_tables t
  WHERE t.is_active = true
  ORDER BY t.sort_order, t.tier, t.table_number;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SEED DATA: Insert the 26 VIP tables
-- ============================================================================

-- 4 Premium Tables @ $700 (1 bottle any choice + champagne, 10 guests)
INSERT INTO vip_tables (table_number, table_name, tier, price, guest_capacity, bottle_service_description, floor_section, position_description, sort_order)
VALUES 
  ('P1', 'Premium Table 1', 'premium', 700.00, 10, '1 bottle of your choice + champagne bottle', 'VIP Section', 'Prime location near DJ booth with elevated view', 1),
  ('P2', 'Premium Table 2', 'premium', 700.00, 10, '1 bottle of your choice + champagne bottle', 'VIP Section', 'Corner booth with panoramic dance floor view', 2),
  ('P3', 'Premium Table 3', 'premium', 700.00, 10, '1 bottle of your choice + champagne bottle', 'VIP Section', 'Front row VIP with bottle sparklers service', 3),
  ('P4', 'Premium Table 4', 'premium', 700.00, 10, '1 bottle of your choice + champagne bottle', 'VIP Section', 'Exclusive corner with dedicated server', 4)
ON CONFLICT (table_number) DO NOTHING;

-- 4 Standard Tables @ $600 (1 bottle + champagne, 8 guests)
INSERT INTO vip_tables (table_number, table_name, tier, price, guest_capacity, bottle_service_description, floor_section, position_description, sort_order)
VALUES 
  ('S1', 'Standard Table 1', 'standard', 600.00, 8, '1 bottle + champagne bottle', 'Elevated Platform', 'Great sightlines to main stage', 5),
  ('S2', 'Standard Table 2', 'standard', 600.00, 8, '1 bottle + champagne bottle', 'Elevated Platform', 'Adjacent to VIP lounge entrance', 6),
  ('S3', 'Standard Table 3', 'standard', 600.00, 8, '1 bottle + champagne bottle', 'Elevated Platform', 'Semi-private booth setting', 7),
  ('S4', 'Standard Table 4', 'standard', 600.00, 8, '1 bottle + champagne bottle', 'Elevated Platform', 'Near bar with quick service', 8)
ON CONFLICT (table_number) DO NOTHING;

-- 18 Regular Tables @ $500 (1 bottle, 6 guests)
INSERT INTO vip_tables (table_number, table_name, tier, price, guest_capacity, bottle_service_description, floor_section, position_description, sort_order)
VALUES 
  ('R1', 'Regular Table 1', 'regular', 500.00, 6, '1 bottle included', 'Main Floor', 'Dance floor adjacent', 9),
  ('R2', 'Regular Table 2', 'regular', 500.00, 6, '1 bottle included', 'Main Floor', 'Near main entrance', 10),
  ('R3', 'Regular Table 3', 'regular', 500.00, 6, '1 bottle included', 'Main Floor', 'Center floor location', 11),
  ('R4', 'Regular Table 4', 'regular', 500.00, 6, '1 bottle included', 'Main Floor', 'By the stage', 12),
  ('R5', 'Regular Table 5', 'regular', 500.00, 6, '1 bottle included', 'Main Floor', 'Near restrooms', 13),
  ('R6', 'Regular Table 6', 'regular', 500.00, 6, '1 bottle included', 'Main Floor', 'Back corner booth', 14),
  ('R7', 'Regular Table 7', 'regular', 500.00, 6, '1 bottle included', 'Main Floor', 'Wall-side seating', 15),
  ('R8', 'Regular Table 8', 'regular', 500.00, 6, '1 bottle included', 'Main Floor', 'Near secondary bar', 16),
  ('R9', 'Regular Table 9', 'regular', 500.00, 6, '1 bottle included', 'Main Floor', 'Dance floor view', 17),
  ('R10', 'Regular Table 10', 'regular', 500.00, 6, '1 bottle included', 'Lounge Area', 'Cozy lounge setting', 18),
  ('R11', 'Regular Table 11', 'regular', 500.00, 6, '1 bottle included', 'Lounge Area', 'Low seating area', 19),
  ('R12', 'Regular Table 12', 'regular', 500.00, 6, '1 bottle included', 'Lounge Area', 'Near hookah lounge', 20),
  ('R13', 'Regular Table 13', 'regular', 500.00, 6, '1 bottle included', 'Lounge Area', 'Quiet conversation spot', 21),
  ('R14', 'Regular Table 14', 'regular', 500.00, 6, '1 bottle included', 'Patio Area', 'Outdoor patio table', 22),
  ('R15', 'Regular Table 15', 'regular', 500.00, 6, '1 bottle included', 'Patio Area', 'Covered patio seating', 23),
  ('R16', 'Regular Table 16', 'regular', 500.00, 6, '1 bottle included', 'Patio Area', 'Fresh air location', 24),
  ('R17', 'Regular Table 17', 'regular', 500.00, 6, '1 bottle included', 'Mezzanine', 'Upper level view', 25),
  ('R18', 'Regular Table 18', 'regular', 500.00, 6, '1 bottle included', 'Mezzanine', 'Balcony overlooking floor', 26)
ON CONFLICT (table_number) DO NOTHING;

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE vip_tables IS 'VIP table inventory with pricing and capacity (26 total tables)';
COMMENT ON TABLE table_reservations IS 'Customer reservations for VIP tables per event';
COMMENT ON TABLE table_guest_passes IS 'Individual QR code passes for each guest in a table reservation';

COMMENT ON COLUMN table_reservations.reservation_number IS 'Unique reservation ID (format: VIP-YYYYMMDD-NNN)';
COMMENT ON COLUMN table_reservations.is_walk_in IS 'True if reservation was made at the door by staff';
COMMENT ON COLUMN table_guest_passes.qr_token IS 'Secure token for QR code, used for scanner verification';
COMMENT ON COLUMN table_guest_passes.qr_signature IS 'HMAC signature for validating the QR token';
COMMENT ON COLUMN vip_tables.tier IS 'Table tier: premium ($700), standard ($600), or regular ($500)';
