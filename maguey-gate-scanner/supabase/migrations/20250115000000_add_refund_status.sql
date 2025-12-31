-- Migration: Refund/Void Status
-- This migration adds refund tracking to tickets and links to order/payment status

-- ============================================
-- 1. ADD REFUND FIELDS TO TICKETS TABLE
-- ============================================
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS refund_status text DEFAULT 'none', -- none, refunded, voided, partial_refund
  ADD COLUMN IF NOT EXISTS refunded_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS refunded_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS refund_reason text,
  ADD COLUMN IF NOT EXISTS refund_amount decimal(10,2);

-- ============================================
-- 2. ADD REFUNDED_AT TO ORDERS TABLE
-- ============================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS refunded_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS refund_reason text;

-- ============================================
-- 3. INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_tickets_refund_status ON public.tickets(refund_status);
CREATE INDEX IF NOT EXISTS idx_tickets_refunded_at ON public.tickets(refunded_at);
CREATE INDEX IF NOT EXISTS idx_orders_refunded_at ON public.orders(refunded_at);

-- ============================================
-- 4. FUNCTION TO CHECK IF TICKET IS REFUNDED
-- ============================================
CREATE OR REPLACE FUNCTION public.is_ticket_refunded(ticket_id_param uuid)
RETURNS boolean AS $$
DECLARE
  ticket_refund_status text;
  order_status text;
BEGIN
  -- Check ticket refund status
  SELECT refund_status INTO ticket_refund_status
  FROM public.tickets
  WHERE id = ticket_id_param;
  
  IF ticket_refund_status IN ('refunded', 'voided') THEN
    RETURN true;
  END IF;
  
  -- Check order status if ticket has order_id
  SELECT o.status INTO order_status
  FROM public.tickets t
  LEFT JOIN public.orders o ON t.order_id = o.id
  WHERE t.id = ticket_id_param;
  
  IF order_status = 'refunded' THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. FUNCTION TO GET REFUND INFO FOR TICKET
-- ============================================
CREATE OR REPLACE FUNCTION public.get_ticket_refund_info(ticket_id_param uuid)
RETURNS TABLE (
  ticket_refund_status text,
  ticket_refunded_at timestamp with time zone,
  ticket_refund_amount decimal,
  order_status text,
  order_refunded_at timestamp with time zone,
  payment_status text,
  payment_refund_amount decimal
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.refund_status,
    t.refunded_at,
    t.refund_amount,
    o.status as order_status,
    o.refunded_at as order_refunded_at,
    p.status as payment_status,
    p.refund_amount as payment_refund_amount
  FROM public.tickets t
  LEFT JOIN public.orders o ON t.order_id = o.id
  LEFT JOIN public.payments p ON o.id = p.order_id
  WHERE t.id = ticket_id_param
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. TRIGGER TO SYNC REFUND STATUS FROM ORDER
-- ============================================
CREATE OR REPLACE FUNCTION public.sync_ticket_refund_from_order()
RETURNS trigger AS $$
BEGIN
  -- When order is marked as refunded, update all associated tickets
  IF NEW.status = 'refunded' AND (OLD.status IS NULL OR OLD.status != 'refunded') THEN
    UPDATE public.tickets
    SET 
      refund_status = 'refunded',
      refunded_at = COALESCE(NEW.refunded_at, now())
    WHERE order_id = NEW.id
      AND refund_status = 'none';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_order_refunded ON public.orders;
CREATE TRIGGER on_order_refunded
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_ticket_refund_from_order();

-- ============================================
-- 7. COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON COLUMN public.tickets.refund_status IS 'Refund status: none, refunded, voided, partial_refund';
COMMENT ON COLUMN public.tickets.refunded_at IS 'Timestamp when ticket was refunded';
COMMENT ON COLUMN public.tickets.refund_amount IS 'Amount refunded for this specific ticket';
COMMENT ON FUNCTION public.is_ticket_refunded IS 'Checks if a ticket has been refunded or voided';
COMMENT ON FUNCTION public.get_ticket_refund_info IS 'Returns complete refund information for a ticket including order and payment status';




