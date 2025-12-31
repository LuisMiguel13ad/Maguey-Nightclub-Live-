-- Migration: Create Event-Specific VIP Tables System
-- This creates the event_vip_tables and vip_reservations tables
-- that the create-vip-payment-intent Edge Function expects

-- ============================================================================
-- Event VIP Tables - Tables specific to each event
-- ============================================================================
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
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint: one table number per event
  CONSTRAINT unique_table_per_event UNIQUE (event_id, table_number)
);

-- ============================================================================
-- VIP Reservations - Bookings for event VIP tables
-- ============================================================================
CREATE TABLE IF NOT EXISTS vip_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(255) NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  event_vip_table_id UUID NOT NULL REFERENCES event_vip_tables(id) ON DELETE CASCADE,
  table_number INTEGER NOT NULL,
  
  -- Customer Information
  purchaser_name VARCHAR(255) NOT NULL,
  purchaser_email VARCHAR(255) NOT NULL,
  purchaser_phone VARCHAR(50),
  
  -- Payment
  amount_paid_cents INTEGER NOT NULL,
  stripe_payment_intent_id VARCHAR(255),
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show', 'checked_in')),
  
  -- QR Code
  qr_code_token VARCHAR(255) NOT NULL UNIQUE,
  
  -- Booking Details (JSON snapshot)
  package_snapshot JSONB,
  special_requests TEXT,
  
  -- Legal
  disclaimer_accepted_at TIMESTAMP WITH TIME ZONE,
  refund_policy_accepted_at TIMESTAMP WITH TIME ZONE,
  
  -- Check-in
  checked_in_at TIMESTAMP WITH TIME ZONE,
  checked_in_by UUID,
  checked_in_guests INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- VIP Guest Passes - Individual passes for guests in a reservation
-- ============================================================================
CREATE TABLE IF NOT EXISTS vip_guest_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES vip_reservations(id) ON DELETE CASCADE,
  guest_number INTEGER NOT NULL,
  guest_name VARCHAR(255),
  qr_code_token VARCHAR(255) NOT NULL UNIQUE,
  qr_signature TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'checked_in', 'cancelled')),
  checked_in_at TIMESTAMP WITH TIME ZONE,
  checked_in_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_event_vip_tables_event_id ON event_vip_tables(event_id);
CREATE INDEX IF NOT EXISTS idx_event_vip_tables_available ON event_vip_tables(is_available);
CREATE INDEX IF NOT EXISTS idx_event_vip_tables_tier ON event_vip_tables(tier);

CREATE INDEX IF NOT EXISTS idx_vip_reservations_event_id ON vip_reservations(event_id);
CREATE INDEX IF NOT EXISTS idx_vip_reservations_table_id ON vip_reservations(event_vip_table_id);
CREATE INDEX IF NOT EXISTS idx_vip_reservations_email ON vip_reservations(purchaser_email);
CREATE INDEX IF NOT EXISTS idx_vip_reservations_status ON vip_reservations(status);
CREATE INDEX IF NOT EXISTS idx_vip_reservations_qr_token ON vip_reservations(qr_code_token);

CREATE INDEX IF NOT EXISTS idx_vip_guest_passes_reservation_id ON vip_guest_passes(reservation_id);
CREATE INDEX IF NOT EXISTS idx_vip_guest_passes_qr_token ON vip_guest_passes(qr_code_token);

-- ============================================================================
-- RLS Policies
-- ============================================================================
ALTER TABLE event_vip_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE vip_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE vip_guest_passes ENABLE ROW LEVEL SECURITY;

-- Event VIP Tables: Public read for available tables
CREATE POLICY "Anyone can view event VIP tables"
  ON event_vip_tables FOR SELECT
  USING (true);

-- Event VIP Tables: Only service role can modify
CREATE POLICY "Service role can manage event VIP tables"
  ON event_vip_tables FOR ALL
  USING (auth.role() = 'service_role');

-- VIP Reservations: Public insert (for booking), users see their own
CREATE POLICY "Anyone can create VIP reservations"
  ON vip_reservations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view their own VIP reservations"
  ON vip_reservations FOR SELECT
  USING (
    purchaser_email = current_setting('request.jwt.claims', true)::json->>'email'
    OR auth.role() = 'service_role'
    OR auth.role() = 'authenticated'
  );

CREATE POLICY "Service role can manage VIP reservations"
  ON vip_reservations FOR ALL
  USING (auth.role() = 'service_role');

-- Guest Passes: Users can view passes for their reservations
CREATE POLICY "Users can view their VIP guest passes"
  ON vip_guest_passes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM vip_reservations r
      WHERE r.id = reservation_id
      AND (
        r.purchaser_email = current_setting('request.jwt.claims', true)::json->>'email'
        OR auth.role() = 'service_role'
        OR auth.role() = 'authenticated'
      )
    )
  );

CREATE POLICY "Service role can manage VIP guest passes"
  ON vip_guest_passes FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- Function to auto-create VIP tables for new events
-- ============================================================================
CREATE OR REPLACE FUNCTION create_default_vip_tables_for_event()
RETURNS TRIGGER AS $$
BEGIN
  -- Create 8 default VIP tables for the event
  -- Tables 1-3: Premium (Left Wing) - $750
  INSERT INTO event_vip_tables (event_id, table_number, table_name, tier, price, capacity, bottles_included, floor_section, position_description, sort_order)
  VALUES
    (NEW.id, 1, 'Premium 1', 'premium', 750.00, 8, 2, 'Left Wing', 'Stage left', 1),
    (NEW.id, 2, 'Premium 2', 'premium', 750.00, 8, 2, 'Left Wing', 'Stage left corner', 2),
    (NEW.id, 3, 'Premium 3', 'premium', 750.00, 8, 2, 'Left Wing', 'Stage left back', 3);
  
  -- Tables 4-7: Front Row - $600
  INSERT INTO event_vip_tables (event_id, table_number, table_name, tier, price, capacity, bottles_included, floor_section, position_description, sort_order)
  VALUES
    (NEW.id, 4, 'Front Row 4', 'front_row', 600.00, 6, 1, 'Front Row', 'Center stage view', 4),
    (NEW.id, 5, 'Front Row 5', 'front_row', 600.00, 6, 1, 'Front Row', 'Center stage prime', 5),
    (NEW.id, 6, 'Front Row 6', 'front_row', 600.00, 6, 1, 'Front Row', 'Center stage view', 6),
    (NEW.id, 7, 'Front Row 7', 'front_row', 600.00, 6, 1, 'Front Row', 'Center stage right', 7);
  
  -- Table 8: Standard (Right Wing) - $500
  INSERT INTO event_vip_tables (event_id, table_number, table_name, tier, price, capacity, bottles_included, floor_section, position_description, sort_order)
  VALUES
    (NEW.id, 8, 'Standard 8', 'standard', 500.00, 6, 1, 'Right Wing', 'Stage right view', 8);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create tables when an event is created
DROP TRIGGER IF EXISTS trigger_create_vip_tables_for_event ON events;
CREATE TRIGGER trigger_create_vip_tables_for_event
  AFTER INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION create_default_vip_tables_for_event();

-- ============================================================================
-- Create VIP tables for existing events (one-time backfill)
-- ============================================================================
DO $$
DECLARE
  event_record RECORD;
BEGIN
  FOR event_record IN SELECT id FROM events WHERE is_active = true LOOP
    -- Check if tables already exist for this event
    IF NOT EXISTS (SELECT 1 FROM event_vip_tables WHERE event_id = event_record.id) THEN
      -- Create default tables for this event
      INSERT INTO event_vip_tables (event_id, table_number, table_name, tier, price, capacity, bottles_included, floor_section, position_description, sort_order)
      VALUES
        (event_record.id, 1, 'Premium 1', 'premium', 750.00, 8, 2, 'Left Wing', 'Stage left', 1),
        (event_record.id, 2, 'Premium 2', 'premium', 750.00, 8, 2, 'Left Wing', 'Stage left corner', 2),
        (event_record.id, 3, 'Premium 3', 'premium', 750.00, 8, 2, 'Left Wing', 'Stage left back', 3),
        (event_record.id, 4, 'Front Row 4', 'front_row', 600.00, 6, 1, 'Front Row', 'Center stage view', 4),
        (event_record.id, 5, 'Front Row 5', 'front_row', 600.00, 6, 1, 'Front Row', 'Center stage prime', 5),
        (event_record.id, 6, 'Front Row 6', 'front_row', 600.00, 6, 1, 'Front Row', 'Center stage view', 6),
        (event_record.id, 7, 'Front Row 7', 'front_row', 600.00, 6, 1, 'Front Row', 'Center stage right', 7),
        (event_record.id, 8, 'Standard 8', 'standard', 500.00, 6, 1, 'Right Wing', 'Stage right view', 8);
    END IF;
  END LOOP;
END $$;

