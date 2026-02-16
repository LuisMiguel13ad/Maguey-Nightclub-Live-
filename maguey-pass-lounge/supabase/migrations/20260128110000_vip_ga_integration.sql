-- Migration: VIP + GA Ticket Integration
-- Purpose: Allow VIP table bookers to purchase GA tickets and share invite links
-- Created: 2026-01-28

-- ============================================
-- STEP 1: Add invite_code column to vip_reservations
-- ============================================

ALTER TABLE vip_reservations
ADD COLUMN IF NOT EXISTS invite_code VARCHAR(12) UNIQUE;

-- Create index for fast lookup
CREATE INDEX IF NOT EXISTS idx_vip_reservations_invite_code
ON vip_reservations(invite_code)
WHERE invite_code IS NOT NULL;

-- ============================================
-- STEP 2: Function to generate unique invite codes
-- ============================================

CREATE OR REPLACE FUNCTION generate_vip_invite_code()
RETURNS VARCHAR(12) AS $$
DECLARE
  v_code VARCHAR(12);
  v_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate 8-character uppercase alphanumeric code
    v_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM vip_reservations WHERE invite_code = v_code) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_code;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 3: Create vip_linked_tickets table
-- Links GA tickets to VIP reservations
-- ============================================

CREATE TABLE IF NOT EXISTS vip_linked_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vip_reservation_id UUID NOT NULL REFERENCES vip_reservations(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  purchased_by_email VARCHAR(255) NOT NULL,
  purchased_by_name VARCHAR(255),
  is_booker_purchase BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Each ticket can only be linked to one VIP reservation
  UNIQUE(ticket_id)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_vip_linked_tickets_reservation
ON vip_linked_tickets(vip_reservation_id);

CREATE INDEX IF NOT EXISTS idx_vip_linked_tickets_ticket
ON vip_linked_tickets(ticket_id);

CREATE INDEX IF NOT EXISTS idx_vip_linked_tickets_order
ON vip_linked_tickets(order_id);

-- ============================================
-- STEP 4: RLS Policies for vip_linked_tickets
-- ============================================

ALTER TABLE vip_linked_tickets ENABLE ROW LEVEL SECURITY;

-- Anyone can read linked tickets (for scanner and dashboard)
CREATE POLICY "vip_linked_tickets_select" ON vip_linked_tickets
FOR SELECT USING (true);

-- Only service role can insert (via edge functions)
CREATE POLICY "vip_linked_tickets_insert" ON vip_linked_tickets
FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Only service role can update
CREATE POLICY "vip_linked_tickets_update" ON vip_linked_tickets
FOR UPDATE USING (auth.role() = 'service_role');

-- Only service role can delete
CREATE POLICY "vip_linked_tickets_delete" ON vip_linked_tickets
FOR DELETE USING (auth.role() = 'service_role');

-- ============================================
-- STEP 5: Function to get linked ticket count for a reservation
-- ============================================

CREATE OR REPLACE FUNCTION get_vip_linked_ticket_count(p_reservation_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM vip_linked_tickets
  WHERE vip_reservation_id = p_reservation_id;

  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- STEP 6: Function to check if VIP table has capacity for more guests
-- ============================================

CREATE OR REPLACE FUNCTION check_vip_capacity(
  p_reservation_id UUID,
  p_requested_tickets INTEGER DEFAULT 1
)
RETURNS JSON AS $$
DECLARE
  v_reservation RECORD;
  v_linked_count INTEGER;
  v_remaining INTEGER;
BEGIN
  -- Get reservation with table capacity
  SELECT r.*, t.capacity
  INTO v_reservation
  FROM vip_reservations r
  JOIN event_vip_tables t ON t.id = r.event_vip_table_id
  WHERE r.id = p_reservation_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', FALSE,
      'error', 'RESERVATION_NOT_FOUND',
      'message', 'VIP reservation not found'
    );
  END IF;

  -- Get current linked ticket count
  v_linked_count := get_vip_linked_ticket_count(p_reservation_id);
  v_remaining := v_reservation.capacity - v_linked_count;

  IF v_remaining < p_requested_tickets THEN
    RETURN json_build_object(
      'success', FALSE,
      'error', 'CAPACITY_EXCEEDED',
      'message', format('Table only has %s spots remaining', v_remaining),
      'capacity', v_reservation.capacity,
      'linked_count', v_linked_count,
      'remaining', v_remaining
    );
  END IF;

  RETURN json_build_object(
    'success', TRUE,
    'capacity', v_reservation.capacity,
    'linked_count', v_linked_count,
    'remaining', v_remaining
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- STEP 7: Function to link ticket to VIP reservation
-- ============================================

CREATE OR REPLACE FUNCTION link_ticket_to_vip(
  p_ticket_id UUID,
  p_vip_reservation_id UUID,
  p_order_id UUID,
  p_email VARCHAR,
  p_name VARCHAR DEFAULT NULL,
  p_is_booker BOOLEAN DEFAULT FALSE
)
RETURNS JSON AS $$
DECLARE
  v_capacity_check JSON;
BEGIN
  -- Check capacity
  v_capacity_check := check_vip_capacity(p_vip_reservation_id, 1);

  IF NOT (v_capacity_check->>'success')::BOOLEAN THEN
    RETURN v_capacity_check;
  END IF;

  -- Insert the link
  INSERT INTO vip_linked_tickets (
    vip_reservation_id,
    order_id,
    ticket_id,
    purchased_by_email,
    purchased_by_name,
    is_booker_purchase
  ) VALUES (
    p_vip_reservation_id,
    p_order_id,
    p_ticket_id,
    p_email,
    p_name,
    p_is_booker
  )
  ON CONFLICT (ticket_id) DO NOTHING;

  RETURN json_build_object(
    'success', TRUE,
    'message', 'Ticket linked to VIP reservation'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', FALSE,
      'error', 'LINK_FAILED',
      'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION generate_vip_invite_code TO service_role;
GRANT EXECUTE ON FUNCTION get_vip_linked_ticket_count TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION check_vip_capacity TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION link_ticket_to_vip TO service_role;
