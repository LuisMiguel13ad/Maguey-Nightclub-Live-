-- Migration: Fix inventory race condition with atomic reservation
-- This replaces the SELECT-then-INSERT pattern with atomic reservation using tickets_sold counter
-- Prevents overselling even under concurrent purchases

BEGIN;

-- ============================================
-- 1. ADD tickets_sold COLUMN TO ticket_types
-- ============================================

-- Add column to track reserved/sold tickets atomically
ALTER TABLE ticket_types 
ADD COLUMN IF NOT EXISTS tickets_sold INTEGER DEFAULT 0 NOT NULL;

-- ============================================
-- 2. BACKFILL tickets_sold FROM CURRENT DATA
-- ============================================

-- Update tickets_sold to match current sold ticket counts
UPDATE ticket_types tt
SET tickets_sold = (
  SELECT COUNT(*)
  FROM tickets t
  WHERE t.ticket_type_id = tt.id
  AND t.status IN ('issued', 'used', 'scanned')
);

-- ============================================
-- 3. ADD CHECK CONSTRAINT
-- ============================================

-- Prevent tickets_sold from exceeding total_inventory
-- This is the database-level guard that prevents overselling
ALTER TABLE ticket_types 
DROP CONSTRAINT IF EXISTS check_tickets_sold_within_inventory;

ALTER TABLE ticket_types 
ADD CONSTRAINT check_tickets_sold_within_inventory 
CHECK (tickets_sold >= 0 AND (total_inventory IS NULL OR tickets_sold <= total_inventory));

-- ============================================
-- 4. CREATE ATOMIC RESERVATION FUNCTION
-- ============================================

-- This function atomically checks availability and reserves tickets
-- Uses row-level locking (FOR UPDATE) to prevent race conditions
-- Returns the number of tickets actually reserved (0 if failed)
CREATE OR REPLACE FUNCTION check_and_reserve_tickets(
  p_ticket_type_id UUID,
  p_quantity INTEGER
)
RETURNS TABLE(
  success BOOLEAN,
  reserved INTEGER,
  available INTEGER,
  ticket_type_name TEXT,
  error_message TEXT
) AS $$
DECLARE
  v_total_inventory INTEGER;
  v_tickets_sold INTEGER;
  v_available INTEGER;
  v_ticket_type_name TEXT;
BEGIN
  -- Validate input
  IF p_quantity <= 0 THEN
    RETURN QUERY SELECT 
      FALSE, 
      0, 
      0, 
      NULL::TEXT, 
      'Invalid quantity: must be greater than 0'::TEXT;
    RETURN;
  END IF;

  -- Lock the row for update to prevent concurrent modifications
  -- This is the key to preventing race conditions
  SELECT 
    tt.total_inventory,
    tt.tickets_sold,
    tt.name
  INTO 
    v_total_inventory,
    v_tickets_sold,
    v_ticket_type_name
  FROM ticket_types tt
  WHERE tt.id = p_ticket_type_id
  FOR UPDATE;

  -- Check if ticket type exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      FALSE, 
      0, 
      0, 
      NULL::TEXT, 
      'Ticket type not found'::TEXT;
    RETURN;
  END IF;

  -- Calculate available tickets (handle NULL inventory as unlimited)
  IF v_total_inventory IS NULL THEN
    v_available := 999999; -- Effectively unlimited
  ELSE
    v_available := v_total_inventory - v_tickets_sold;
  END IF;

  -- Check if enough tickets are available
  IF p_quantity > v_available THEN
    RETURN QUERY SELECT 
      FALSE, 
      0, 
      v_available, 
      v_ticket_type_name, 
      format('Not enough tickets available for %s. Requested: %s, Available: %s', 
             v_ticket_type_name, p_quantity, v_available)::TEXT;
    RETURN;
  END IF;

  -- Reserve the tickets by incrementing tickets_sold
  UPDATE ticket_types
  SET tickets_sold = tickets_sold + p_quantity,
      updated_at = NOW()
  WHERE id = p_ticket_type_id;

  -- Return success
  RETURN QUERY SELECT 
    TRUE, 
    p_quantity, 
    v_available - p_quantity, 
    v_ticket_type_name, 
    NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. CREATE RELEASE FUNCTION FOR ROLLBACK
-- ============================================

-- This function releases reserved tickets if order creation fails
-- Should be called when an error occurs after reservation but before completion
CREATE OR REPLACE FUNCTION release_reserved_tickets(
  p_ticket_type_id UUID,
  p_quantity INTEGER
)
RETURNS TABLE(
  success BOOLEAN,
  released INTEGER,
  new_tickets_sold INTEGER,
  error_message TEXT
) AS $$
DECLARE
  v_current_sold INTEGER;
BEGIN
  -- Validate input
  IF p_quantity <= 0 THEN
    RETURN QUERY SELECT 
      FALSE, 
      0, 
      0, 
      'Invalid quantity: must be greater than 0'::TEXT;
    RETURN;
  END IF;

  -- Lock and get current count
  SELECT tickets_sold INTO v_current_sold
  FROM ticket_types
  WHERE id = p_ticket_type_id
  FOR UPDATE;

  -- Check if ticket type exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      FALSE, 
      0, 
      0, 
      'Ticket type not found'::TEXT;
    RETURN;
  END IF;

  -- Don't allow negative tickets_sold
  IF v_current_sold < p_quantity THEN
    -- Release only what's been sold (prevent going negative)
    UPDATE ticket_types
    SET tickets_sold = 0,
        updated_at = NOW()
    WHERE id = p_ticket_type_id;

    RETURN QUERY SELECT 
      TRUE, 
      v_current_sold, 
      0, 
      NULL::TEXT;
    RETURN;
  END IF;

  -- Release the reserved tickets
  UPDATE ticket_types
  SET tickets_sold = tickets_sold - p_quantity,
      updated_at = NOW()
  WHERE id = p_ticket_type_id;

  RETURN QUERY SELECT 
    TRUE, 
    p_quantity, 
    v_current_sold - p_quantity, 
    NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. CREATE BATCH RESERVATION FUNCTION
-- ============================================

-- This function reserves multiple ticket types in a single transaction
-- All-or-nothing: either all reservations succeed or all fail
CREATE OR REPLACE FUNCTION reserve_tickets_batch(
  p_reservations JSONB
  -- Format: [{"ticket_type_id": "uuid", "quantity": 2}, ...]
)
RETURNS TABLE(
  success BOOLEAN,
  error_message TEXT,
  failed_ticket_type_id UUID,
  failed_ticket_type_name TEXT,
  requested_quantity INTEGER,
  available_quantity INTEGER
) AS $$
DECLARE
  v_reservation JSONB;
  v_ticket_type_id UUID;
  v_quantity INTEGER;
  v_result RECORD;
  v_reserved_items JSONB := '[]'::JSONB;
BEGIN
  -- Process each reservation
  FOR v_reservation IN SELECT * FROM jsonb_array_elements(p_reservations)
  LOOP
    v_ticket_type_id := (v_reservation->>'ticket_type_id')::UUID;
    v_quantity := (v_reservation->>'quantity')::INTEGER;

    -- Try to reserve this ticket type
    SELECT * INTO v_result
    FROM check_and_reserve_tickets(v_ticket_type_id, v_quantity);

    IF NOT v_result.success THEN
      -- Reservation failed - rollback all previous reservations
      FOR v_reservation IN SELECT * FROM jsonb_array_elements(v_reserved_items)
      LOOP
        PERFORM release_reserved_tickets(
          (v_reservation->>'ticket_type_id')::UUID,
          (v_reservation->>'quantity')::INTEGER
        );
      END LOOP;

      -- Return failure info
      RETURN QUERY SELECT 
        FALSE,
        v_result.error_message,
        v_ticket_type_id,
        v_result.ticket_type_name,
        v_quantity,
        v_result.available;
      RETURN;
    END IF;

    -- Track successful reservation for potential rollback
    v_reserved_items := v_reserved_items || jsonb_build_object(
      'ticket_type_id', v_ticket_type_id,
      'quantity', v_quantity
    );
  END LOOP;

  -- All reservations succeeded
  RETURN QUERY SELECT 
    TRUE,
    NULL::TEXT,
    NULL::UUID,
    NULL::TEXT,
    NULL::INTEGER,
    NULL::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. CREATE BATCH RELEASE FUNCTION
-- ============================================

-- Release multiple ticket type reservations at once
CREATE OR REPLACE FUNCTION release_tickets_batch(
  p_reservations JSONB
  -- Format: [{"ticket_type_id": "uuid", "quantity": 2}, ...]
)
RETURNS BOOLEAN AS $$
DECLARE
  v_reservation JSONB;
BEGIN
  FOR v_reservation IN SELECT * FROM jsonb_array_elements(p_reservations)
  LOOP
    PERFORM release_reserved_tickets(
      (v_reservation->>'ticket_type_id')::UUID,
      (v_reservation->>'quantity')::INTEGER
    );
  END LOOP;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. ADD INDEX FOR PERFORMANCE
-- ============================================

-- Index on tickets_sold for faster queries
CREATE INDEX IF NOT EXISTS idx_ticket_types_tickets_sold 
ON ticket_types(tickets_sold);

COMMIT;

-- ============================================
-- USAGE NOTES
-- ============================================
-- 
-- This migration adds atomic inventory reservation to prevent race conditions:
--
-- 1. tickets_sold column: Tracks reserved tickets atomically
-- 2. check_and_reserve_tickets(): Atomically checks and reserves inventory
-- 3. release_reserved_tickets(): Releases reservations on failure
-- 4. reserve_tickets_batch(): Reserves multiple types atomically (all-or-nothing)
-- 5. release_tickets_batch(): Releases multiple reservations
-- 6. CHECK constraint: Database-level guard preventing overselling
--
-- USAGE IN APPLICATION:
--
-- Before:
--   1. SELECT COUNT(*) to check availability (RACE CONDITION!)
--   2. INSERT order
--   3. INSERT tickets (might oversell)
--
-- After:
--   1. Call reserve_tickets_batch() - atomic reservation with row locking
--   2. INSERT order
--   3. INSERT tickets
--   4. On any failure: call release_tickets_batch() to rollback reservations
--
-- The FOR UPDATE lock in check_and_reserve_tickets() ensures only one
-- transaction can modify a ticket_type's inventory at a time.
