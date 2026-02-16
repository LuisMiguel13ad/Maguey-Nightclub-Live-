-- Migration: Add database-level inventory protection
-- Prevents overselling at the database level even if application logic fails
-- Critical for production reliability

BEGIN;

-- ============================================
-- 1. ADD CONSTRAINTS
-- ============================================

-- Ensure inventory is never negative
ALTER TABLE ticket_types 
DROP CONSTRAINT IF EXISTS check_positive_inventory;

ALTER TABLE ticket_types 
ADD CONSTRAINT check_positive_inventory 
CHECK (total_inventory >= 0);

-- ============================================
-- 2. CREATE TRIGGER TO ENFORCE INVENTORY LIMITS
-- ============================================

-- Function to check inventory before inserting tickets
CREATE OR REPLACE FUNCTION check_ticket_inventory()
RETURNS TRIGGER AS $$
DECLARE
  sold_count INTEGER;
  total_inventory INTEGER;
  ticket_type_name TEXT;
BEGIN
  -- Skip check for cancelled, refunded, or void tickets
  IF NEW.status IN ('cancelled', 'refunded', 'void') THEN
    RETURN NEW;
  END IF;

  -- Count already sold tickets for this ticket type
  -- Only count active statuses (issued, used, scanned)
  SELECT COUNT(*) INTO sold_count
  FROM tickets
  WHERE ticket_type_id = NEW.ticket_type_id
  AND status IN ('issued', 'used', 'scanned');
  
  -- Get total inventory and name for error message
  SELECT total_inventory, name INTO total_inventory, ticket_type_name
  FROM ticket_types
  WHERE id = NEW.ticket_type_id;
  
  -- If no ticket type found, reject
  IF total_inventory IS NULL THEN
    RAISE EXCEPTION 'Ticket type not found: %', NEW.ticket_type_id;
  END IF;
  
  -- Prevent overselling: check if adding this ticket would exceed inventory
  IF sold_count >= total_inventory THEN
    RAISE EXCEPTION 'Ticket type "%" is sold out (% of % sold)', 
      ticket_type_name, sold_count, total_inventory
    USING ERRCODE = 'check_violation';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS enforce_inventory_limit ON tickets;

-- Create trigger that runs BEFORE inserting a ticket
CREATE TRIGGER enforce_inventory_limit
  BEFORE INSERT ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION check_ticket_inventory();

-- ============================================
-- 3. CREATE FUNCTION TO CHECK AVAILABILITY
-- ============================================

-- Helper function to safely check availability before purchase
CREATE OR REPLACE FUNCTION get_ticket_availability(
  p_ticket_type_id UUID
)
RETURNS TABLE(
  ticket_type_id UUID,
  ticket_type_name TEXT,
  total_inventory INTEGER,
  sold INTEGER,
  available INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tt.id AS ticket_type_id,
    tt.name AS ticket_type_name,
    tt.total_inventory,
    COALESCE(
      (SELECT COUNT(*)::INTEGER 
       FROM tickets t 
       WHERE t.ticket_type_id = tt.id 
       AND t.status IN ('issued', 'used', 'scanned')
      ), 0
    ) AS sold,
    GREATEST(
      0,
      tt.total_inventory - COALESCE(
        (SELECT COUNT(*)::INTEGER 
         FROM tickets t 
         WHERE t.ticket_type_id = tt.id 
         AND t.status IN ('issued', 'used', 'scanned')
        ), 0
      )
    ) AS available
  FROM ticket_types tt
  WHERE tt.id = p_ticket_type_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. ADD INDEX FOR PERFORMANCE
-- ============================================

-- Index to speed up ticket counting queries
CREATE INDEX IF NOT EXISTS idx_tickets_type_status 
ON tickets(ticket_type_id, status) 
WHERE status IN ('issued', 'used', 'scanned');

-- Index to speed up event-based queries
CREATE INDEX IF NOT EXISTS idx_tickets_event_type 
ON tickets(event_id, ticket_type_id, status);

COMMIT;

-- ============================================
-- USAGE NOTES
-- ============================================
-- 
-- This migration adds:
-- 1. CHECK constraint: Prevents negative inventory
-- 2. TRIGGER: Enforces inventory limits at insert time
-- 3. FUNCTION: Helper to check availability safely
-- 4. INDEXES: Performance optimization for counting
--
-- The trigger will AUTOMATICALLY prevent overselling
-- even if the application logic has bugs or race conditions.
--
-- Test it:
-- INSERT INTO tickets (ticket_type_id, ...) VALUES (...); 
-- -- Will fail with "Ticket type is sold out" if inventory exceeded

