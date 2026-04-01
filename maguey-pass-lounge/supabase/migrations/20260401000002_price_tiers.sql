-- Dynamic / Early-Bird Pricing: ticket_type_price_tiers table + RPCs
-- Allows multiple price tiers per ticket type (e.g. Early Bird → Standard → Door)
-- Backward-compatible: events without tiers continue to use ticket_types.price

CREATE TABLE IF NOT EXISTS ticket_type_price_tiers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_type_id    UUID NOT NULL REFERENCES ticket_types(id) ON DELETE CASCADE,
  tier_name         TEXT NOT NULL,
  price             NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  tickets_available INTEGER NOT NULL CHECK (tickets_available > 0),
  tickets_sold      INTEGER NOT NULL DEFAULT 0 CHECK (tickets_sold >= 0),
  sort_order        INTEGER NOT NULL DEFAULT 0,
  is_active         BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one active tier per ticket type at a time
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_tier_per_ticket_type
  ON ticket_type_price_tiers (ticket_type_id)
  WHERE is_active = true;

-- Fast lookup by ticket type sorted by order
CREATE INDEX IF NOT EXISTS idx_price_tiers_ticket_type_sort
  ON ticket_type_price_tiers (ticket_type_id, sort_order);

-- RLS
ALTER TABLE ticket_type_price_tiers ENABLE ROW LEVEL SECURITY;

-- Anyone can read tiers (needed for EventDetail display)
CREATE POLICY "price_tiers_read_public"
  ON ticket_type_price_tiers FOR SELECT
  USING (true);

-- Only service role (Edge Functions) can insert/update/delete
CREATE POLICY "price_tiers_write_service"
  ON ticket_type_price_tiers FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Organizers (pass-lounge admins) can manage tiers from the browser
CREATE POLICY "price_tiers_write_organizer"
  ON ticket_type_price_tiers FOR ALL
  USING (
    auth.role() = 'authenticated'
    AND (auth.jwt() -> 'user_metadata' ->> 'account_type') = 'organizer'
  )
  WITH CHECK (
    auth.role() = 'authenticated'
    AND (auth.jwt() -> 'user_metadata' ->> 'account_type') = 'organizer'
  );

-- -----------------------------------------------------------------------
-- RPC: get_current_tier_price(p_ticket_type_id UUID)
-- Returns: active tier price (or NULL if no tiers → caller falls back to ticket_types.price)
-- Also returns tier_name and remaining count for UI display
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_current_tier_price(p_ticket_type_id UUID)
RETURNS TABLE (
  tier_price      NUMERIC(10, 2),
  tier_name       TEXT,
  tier_remaining  INTEGER,
  tier_id         UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.price,
    t.tier_name,
    GREATEST(0, t.tickets_available - t.tickets_sold) AS tier_remaining,
    t.id
  FROM ticket_type_price_tiers t
  WHERE t.ticket_type_id = p_ticket_type_id
    AND t.is_active = true
  LIMIT 1;
END;
$$;

-- -----------------------------------------------------------------------
-- RPC: advance_price_tier(p_ticket_type_id UUID, p_quantity INTEGER)
-- Called by stripe-webhook after a successful purchase.
-- Increments tickets_sold on the active tier by p_quantity.
-- If the tier is now exhausted (tickets_sold >= tickets_available):
--   • marks it inactive
--   • activates the next tier by sort_order
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION advance_price_tier(
  p_ticket_type_id UUID,
  p_quantity       INTEGER DEFAULT 1
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_tier_id         UUID;
  v_tickets_available      INTEGER;
  v_tickets_sold_after     INTEGER;
  v_current_sort_order     INTEGER;
  v_next_tier_id           UUID;
BEGIN
  -- Lock the active tier row for update to prevent race conditions
  SELECT id, tickets_available, tickets_sold + p_quantity, sort_order
  INTO v_active_tier_id, v_tickets_available, v_tickets_sold_after, v_current_sort_order
  FROM ticket_type_price_tiers
  WHERE ticket_type_id = p_ticket_type_id
    AND is_active = true
  FOR UPDATE;

  -- No active tier → nothing to do (ticket type uses base price)
  IF v_active_tier_id IS NULL THEN
    RETURN;
  END IF;

  -- Increment tickets_sold
  UPDATE ticket_type_price_tiers
  SET
    tickets_sold = v_tickets_sold_after,
    updated_at   = NOW()
  WHERE id = v_active_tier_id;

  -- Check if tier is exhausted
  IF v_tickets_sold_after >= v_tickets_available THEN
    -- Deactivate current tier
    UPDATE ticket_type_price_tiers
    SET is_active  = false,
        updated_at = NOW()
    WHERE id = v_active_tier_id;

    -- Activate the next tier (lowest sort_order greater than current)
    SELECT id INTO v_next_tier_id
    FROM ticket_type_price_tiers
    WHERE ticket_type_id = p_ticket_type_id
      AND sort_order > v_current_sort_order
    ORDER BY sort_order ASC
    LIMIT 1;

    IF v_next_tier_id IS NOT NULL THEN
      UPDATE ticket_type_price_tiers
      SET is_active  = true,
          updated_at = NOW()
      WHERE id = v_next_tier_id;
    END IF;
  END IF;
END;
$$;

-- Grant execute to service role only
GRANT EXECUTE ON FUNCTION get_current_tier_price(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION advance_price_tier(UUID, INTEGER) TO service_role;
