-- Migration: customer_stats view + visit count helper
-- Purpose: Replace client-side CRM aggregation in CustomerManagement.tsx with
--          server-side computation. Also adds a SECURITY DEFINER function so
--          scanner employees (who cannot read all orders via RLS) can still
--          look up a single customer's visit count for the "Welcome back!" banner.

-- ============================================================
-- 1. customer_stats VIEW
-- ============================================================
-- Handles schema evolution: some orders use purchaser_email (new RPC path) and
-- some use customer_email (old Stripe webhook path). Both columns coexist.
-- orders.total stores dollar amounts (NUMERIC, NOT cents).
-- ============================================================

CREATE OR REPLACE VIEW customer_stats AS
WITH order_stats AS (
  SELECT
    lower(COALESCE(o.purchaser_email, o.customer_email)) AS email,
    max(COALESCE(
      o.purchaser_name,
      NULLIF(
        TRIM(COALESCE(o.customer_first_name, '') || ' ' || COALESCE(o.customer_last_name, '')),
        ''
      )
    )) AS name,
    max(o.customer_phone) AS phone,
    count(DISTINCT o.id)::int                              AS total_orders,
    round(sum(COALESCE(o.total, 0))::numeric, 2)           AS total_spent,
    count(DISTINCT o.event_id)::int                        AS distinct_events,
    -- Resolve event names from the events table (event_id may be UUID or text)
    array_agg(DISTINCT e.name) FILTER (WHERE e.name IS NOT NULL) AS event_names,
    min(o.created_at)                                      AS first_visit,
    max(o.created_at)                                      AS last_visit
  FROM orders o
  LEFT JOIN events e ON e.id::text = o.event_id::text
  WHERE o.status IN ('paid', 'completed')
    AND COALESCE(o.purchaser_email, o.customer_email) IS NOT NULL
  GROUP BY lower(COALESCE(o.purchaser_email, o.customer_email))
),
ticket_stats AS (
  SELECT
    lower(COALESCE(t.guest_email, t.attendee_email)) AS email,
    count(*)::int AS total_tickets
  FROM tickets t
  WHERE COALESCE(t.guest_email, t.attendee_email) IS NOT NULL
  GROUP BY lower(COALESCE(t.guest_email, t.attendee_email))
)
SELECT
  os.email,
  os.name,
  os.phone,
  os.total_orders,
  os.total_spent,
  COALESCE(ts.total_tickets, 0)::int                      AS total_tickets,
  os.distinct_events,
  COALESCE(os.event_names, ARRAY[]::text[])               AS event_names,
  os.first_visit,
  os.last_visit,
  EXTRACT(DAY FROM (now() - os.last_visit))::int          AS days_since_last_visit
FROM order_stats os
LEFT JOIN ticket_stats ts ON ts.email = os.email;

-- Grant read access to authenticated staff (owner/promoter RLS already enforced
-- on the underlying orders table via the "Users can view own orders or staff can
-- view all" policy in 20250204000001_optimize_rls_policies.sql)
GRANT SELECT ON customer_stats TO authenticated;

-- ============================================================
-- 2. get_customer_visit_count — SECURITY DEFINER helper
-- ============================================================
-- Allows scanner employees (who are blocked from reading all orders by RLS)
-- to look up a single customer's total order count for the "Welcome back!" banner.
-- SECURITY DEFINER runs as the function owner (postgres) and bypasses RLS.
-- Only returns an integer count — no personal data exposure.
-- ============================================================

CREATE OR REPLACE FUNCTION get_customer_visit_count(p_email TEXT)
RETURNS INTEGER
SECURITY DEFINER
SET search_path = public
LANGUAGE sql
STABLE
AS $$
  SELECT count(*)::int
  FROM orders
  WHERE status IN ('paid', 'completed')
    AND p_email IS NOT NULL
    AND p_email != ''
    AND lower(COALESCE(purchaser_email, customer_email)) = lower(p_email);
$$;

GRANT EXECUTE ON FUNCTION get_customer_visit_count(TEXT) TO authenticated;
