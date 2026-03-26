-- ============================================================================
-- Phase 17-03: Tighten VIP RLS Policies
-- ============================================================================
-- Removes anonymous SELECT access from vip_reservations and vip_guest_passes.
-- Creates SECURITY DEFINER RPC for public token-based VIP pass lookup.
--
-- BEFORE: Anonymous users could query ALL rows in both tables (PII exposure)
-- AFTER: Only authenticated users and service_role can SELECT.
--        Public pass view uses get_vip_pass_by_token() RPC (returns single record by token).
-- ============================================================================

-- Ensure RLS is enabled on both tables
ALTER TABLE vip_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE vip_guest_passes ENABLE ROW LEVEL SECURITY;

-- aggressively drop any existing policies that might be misnamed
DO $$ 
BEGIN
    -- Drop all for vip_reservations
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vip_reservations') THEN
        EXECUTE (
            SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON vip_reservations;', ' ')
            FROM pg_policies WHERE tablename = 'vip_reservations'
        );
    END IF;
    -- Drop all for vip_guest_passes
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'vip_guest_passes') THEN
        EXECUTE (
            SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON vip_guest_passes;', ' ')
            FROM pg_policies WHERE tablename = 'vip_guest_passes'
        );
    END IF;
END $$;

-- Part 1: Recreate vip_reservations SELECT policy
-- Recreate without anon access
CREATE POLICY "vip_reservations_select" ON vip_reservations FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND purchaser_email = auth.jwt() ->> 'email')
  );

-- Part 2: Recreate vip_guest_passes SELECT policy

-- Recreate without anon access
CREATE POLICY "vip_guest_passes_select" ON vip_guest_passes FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR auth.role() = 'authenticated'
  );

-- Part 3: Create SECURITY DEFINER RPC for token-based lookup
-- RPC for public VIP pass view (bypasses RLS via SECURITY DEFINER)
-- Returns only the specific pass matching the QR code token.
-- This is safe because:
-- 1. Lookup is by token (must know the exact token to get data)
-- 2. Returns limited fields (no full table scan)
-- 3. Token is a UUID, not guessable
CREATE OR REPLACE FUNCTION get_vip_pass_by_token(p_qr_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Validate input
  IF p_qr_token IS NULL OR p_qr_token = '' THEN
    RETURN NULL;
  END IF;

  SELECT json_build_object(
    'id', gp.id,
    'pass_number', gp.pass_number,
    'guest_name', gp.guest_name,
    'guest_email', gp.guest_email,
    'pass_type', gp.pass_type,
    'qr_token', gp.qr_code_token,
    'status', gp.status,
    'scanned_at', gp.scanned_at,
    'vip_reservations', json_build_object(
      'id', vr.id,
      'table_number', vr.table_number,
      'purchaser_name', vr.purchaser_name,
      'package_snapshot', vr.package_snapshot,
      'event_vip_tables', CASE
        WHEN evt.id IS NOT NULL THEN json_build_object(
          'table_number', evt.table_number,
          'tier', evt.tier,
          'guest_capacity', evt.guest_capacity
        )
        ELSE NULL
      END,
      'events', CASE
        WHEN e.id IS NOT NULL THEN json_build_object(
          'id', e.id,
          'name', e.name,
          'event_date', e.event_date,
          'venue_name', e.venue_name,
          'image_url', e.image_url
        )
        ELSE NULL
      END
    )
  )
  INTO v_result
  FROM vip_guest_passes gp
  JOIN vip_reservations vr ON gp.vip_reservation_id = vr.id
  LEFT JOIN events e ON vr.event_id = e.id
  LEFT JOIN event_vip_tables evt ON vr.event_vip_table_id = evt.id
  WHERE gp.qr_code_token = p_qr_token;

  RETURN v_result;
END;
$$;
