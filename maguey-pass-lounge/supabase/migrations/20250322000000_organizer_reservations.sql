-- Migration: Organizer Profiles, Ticket Reservations, and Security Hardening
-- Adds organizer management tables, reservation holds, and hardens database functions

BEGIN;

-- ============================================
-- 1. ORGANIZER PROFILES
-- ============================================

CREATE TABLE IF NOT EXISTS organizer_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_phone TEXT,
  payout_details JSONB,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_organizer_profiles_user_id ON organizer_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_organizer_profiles_status ON organizer_profiles(verification_status);

ALTER TABLE organizer_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers manage their own profile"
  ON organizer_profiles
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role manages organizer profiles"
  ON organizer_profiles
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION update_organizer_profiles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_organizer_profiles_updated_at ON organizer_profiles;
CREATE TRIGGER update_organizer_profiles_updated_at
  BEFORE UPDATE ON organizer_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_organizer_profiles_updated_at();

-- Events now reference organizer_profiles
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS organizer_id UUID REFERENCES organizer_profiles(id) ON DELETE SET NULL;

-- Allow verified organizers (or pending) to manage their events
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Organizers can insert events"
  ON events
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM organizer_profiles op
      WHERE op.id = events.organizer_id
        AND op.user_id = auth.uid()
        AND op.verification_status <> 'rejected'
    )
  );

CREATE POLICY IF NOT EXISTS "Organizers can manage their events"
  ON events
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM organizer_profiles op
      WHERE op.id = events.organizer_id
        AND op.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM organizer_profiles op
      WHERE op.id = events.organizer_id
        AND op.user_id = auth.uid()
        AND op.verification_status <> 'rejected'
    )
  );

-- ============================================
-- 2. TICKET RESERVATIONS & INVENTORY HOLDS
-- ============================================

CREATE TABLE IF NOT EXISTS ticket_reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id VARCHAR NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  ticket_type_id UUID NOT NULL REFERENCES ticket_types(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  customer_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'converted', 'expired', 'released')),
  expires_at TIMESTAMPTZ NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_reservations_active
  ON ticket_reservations(ticket_type_id, status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_ticket_reservations_expires
  ON ticket_reservations(expires_at);

ALTER TABLE ticket_reservations ENABLE ROW LEVEL SECURITY;

-- Reservations are managed by service role only
CREATE POLICY "Service role manages reservations"
  ON ticket_reservations
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION update_ticket_reservations_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_ticket_reservations_updated_at ON ticket_reservations;
CREATE TRIGGER update_ticket_reservations_updated_at
  BEFORE UPDATE ON ticket_reservations
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_reservations_updated_at();

-- Function: expire stale reservations
CREATE OR REPLACE FUNCTION expire_stale_reservations()
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE ticket_reservations
  SET status = 'expired',
      updated_at = NOW()
  WHERE status = 'active'
    AND expires_at <= NOW();

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN COALESCE(updated_count, 0);
END;
$$;

-- Function: reserve inventory atomically
CREATE OR REPLACE FUNCTION reserve_ticket_inventory(
  p_event_id VARCHAR,
  p_ticket_type_id UUID,
  p_quantity INTEGER,
  p_customer_email TEXT,
  p_hold_minutes INTEGER DEFAULT 15
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  sold_count INTEGER;
  total_inventory INTEGER;
  active_reserved INTEGER;
  reservation_id UUID;
BEGIN
  PERFORM expire_stale_reservations();

  -- Lock ticket type row to prevent race conditions
  SELECT total_inventory
  INTO total_inventory
  FROM ticket_types
  WHERE id = p_ticket_type_id
  FOR UPDATE;

  IF total_inventory IS NULL THEN
    RAISE EXCEPTION 'Ticket type % not found', p_ticket_type_id
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Count sold tickets
  SELECT COUNT(*) INTO sold_count
  FROM tickets
  WHERE ticket_type_id = p_ticket_type_id
    AND status IN ('issued', 'used', 'scanned');

  -- Count active reservations
  SELECT COALESCE(SUM(quantity), 0) INTO active_reserved
  FROM ticket_reservations
  WHERE ticket_type_id = p_ticket_type_id
    AND status = 'active'
    AND expires_at > NOW();

  IF p_quantity > (total_inventory - sold_count - active_reserved) THEN
    RAISE EXCEPTION 'Not enough inventory for ticket type %, requested %, available %',
      p_ticket_type_id, p_quantity, total_inventory - sold_count - active_reserved
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO ticket_reservations (
    event_id,
    ticket_type_id,
    quantity,
    customer_email,
    expires_at
  )
  VALUES (
    p_event_id,
    p_ticket_type_id,
    p_quantity,
    LOWER(p_customer_email),
    NOW() + MAKE_INTERVAL(mins => p_hold_minutes)
  )
  RETURNING id INTO reservation_id;

  RETURN reservation_id;
END;
$$;

-- Function: Attach reservations to order
CREATE OR REPLACE FUNCTION assign_reservations_to_order(
  p_reservation_ids UUID[],
  p_order_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE ticket_reservations
  SET order_id = p_order_id,
      updated_at = NOW()
  WHERE id = ANY(p_reservation_ids)
    AND status = 'active';
END;
$$;

-- Function: Convert reservations after successful payment
CREATE OR REPLACE FUNCTION convert_reservations_to_order(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE ticket_reservations
  SET status = 'converted',
      updated_at = NOW()
  WHERE order_id = p_order_id
    AND status = 'active';
END;
$$;

-- Function: Release reservations (manual or payment failure)
CREATE OR REPLACE FUNCTION release_reservations_for_order(
  p_order_id UUID,
  p_reason TEXT DEFAULT 'released'
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE ticket_reservations
  SET status = CASE
    WHEN p_reason = 'expired' THEN 'expired'
    ELSE 'released'
  END,
  updated_at = NOW()
  WHERE order_id = p_order_id
    AND status = 'active';
END;
$$;

-- Function: Release single reservation (rollback safety)
CREATE OR REPLACE FUNCTION release_reservation(p_reservation_id UUID, p_reason TEXT DEFAULT 'released')
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE ticket_reservations
  SET status = CASE
    WHEN p_reason = 'expired' THEN 'expired'
    ELSE 'released'
  END,
  updated_at = NOW()
  WHERE id = p_reservation_id
    AND status = 'active';
END;
$$;

-- Helper: sum of active reservations for a ticket type
CREATE OR REPLACE FUNCTION sum_active_reservations(p_ticket_type_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  total_active INTEGER;
BEGIN
  SELECT COALESCE(SUM(quantity), 0)
  INTO total_active
  FROM ticket_reservations
  WHERE ticket_type_id = p_ticket_type_id
    AND status = 'active'
    AND expires_at > NOW();

  RETURN COALESCE(total_active, 0);
END;
$$;

-- ============================================
-- 3. SECURITY HARDENING & RLS ENHANCEMENTS
-- ============================================

-- Allow organizers to view orders for their events
CREATE POLICY IF NOT EXISTS "Organizers view event orders"
  ON orders
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM events e
      JOIN organizer_profiles op ON op.id = e.organizer_id
      WHERE e.id = orders.event_id
        AND op.user_id = auth.uid()
    )
  );

-- Allow organizers to view tickets for their events
CREATE POLICY IF NOT EXISTS "Organizers view event tickets"
  ON tickets
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM events e
      JOIN organizer_profiles op ON op.id = e.organizer_id
      WHERE e.id = tickets.event_id
        AND op.user_id = auth.uid()
    )
  );

-- ============================================
-- 4. ENSURE ALL FUNCTIONS USE PUBLIC SEARCH PATH
-- ============================================

ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.check_ticket_inventory() SET search_path = public;
ALTER FUNCTION public.get_ticket_availability(UUID) SET search_path = public;
ALTER FUNCTION public.update_ticket_types_updated_at() SET search_path = public;
ALTER FUNCTION public.update_profiles_updated_at() SET search_path = public;
ALTER FUNCTION public.update_user_devices_updated_at() SET search_path = public;
ALTER FUNCTION public.update_referrals_updated_at() SET search_path = public;
ALTER FUNCTION public.generate_referral_code() SET search_path = public;
ALTER FUNCTION public.update_membership_tier() SET search_path = public;

COMMIT;


