-- Migration: Ticket Transfer Detection
-- This migration adds ticket transfer tracking and original purchaser information

-- ============================================
-- 1. ADD ORIGINAL PURCHASER FIELDS TO TICKETS
-- ============================================
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS original_purchaser_name text,
  ADD COLUMN IF NOT EXISTS original_purchaser_email text,
  ADD COLUMN IF NOT EXISTS transfer_count integer DEFAULT 0;

-- Backfill original purchaser data from orders if order_id exists
UPDATE public.tickets t
SET 
  original_purchaser_name = o.customer_name,
  original_purchaser_email = o.customer_email
FROM public.orders o
WHERE t.order_id = o.id 
  AND (t.original_purchaser_name IS NULL OR t.original_purchaser_email IS NULL);

-- For tickets without orders, use guest_name/guest_email as original purchaser
UPDATE public.tickets
SET 
  original_purchaser_name = COALESCE(original_purchaser_name, guest_name),
  original_purchaser_email = COALESCE(original_purchaser_email, guest_email)
WHERE original_purchaser_name IS NULL OR original_purchaser_email IS NULL;

-- ============================================
-- 2. CREATE TICKET_TRANSFERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.ticket_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  transferred_from_name text NOT NULL,
  transferred_from_email text,
  transferred_to_name text NOT NULL,
  transferred_to_email text,
  transfer_reason text,
  transferred_by uuid REFERENCES auth.users(id), -- Staff/admin who processed transfer
  transferred_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- ============================================
-- 3. INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_ticket_transfers_ticket_id ON public.ticket_transfers(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_transfers_transferred_at ON public.ticket_transfers(transferred_at);
CREATE INDEX IF NOT EXISTS idx_tickets_original_purchaser_email ON public.tickets(original_purchaser_email);

-- ============================================
-- 4. ROW LEVEL SECURITY POLICIES
-- ============================================
ALTER TABLE public.ticket_transfers ENABLE ROW LEVEL SECURITY;

-- Staff can view all transfers
CREATE POLICY "Staff can view all transfers"
  ON public.ticket_transfers
  FOR SELECT
  TO authenticated
  USING (true);

-- Staff can create transfers
CREATE POLICY "Staff can create transfers"
  ON public.ticket_transfers
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================
-- 5. FUNCTION TO GET TRANSFER HISTORY
-- ============================================
CREATE OR REPLACE FUNCTION public.get_ticket_transfer_history(ticket_id_param uuid)
RETURNS TABLE (
  id uuid,
  transferred_from_name text,
  transferred_from_email text,
  transferred_to_name text,
  transferred_to_email text,
  transfer_reason text,
  transferred_at timestamp with time zone
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tt.id,
    tt.transferred_from_name,
    tt.transferred_from_email,
    tt.transferred_to_name,
    tt.transferred_to_email,
    tt.transfer_reason,
    tt.transferred_at
  FROM public.ticket_transfers tt
  WHERE tt.ticket_id = ticket_id_param
  ORDER BY tt.transferred_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. FUNCTION TO CHECK IF TICKET WAS TRANSFERRED
-- ============================================
CREATE OR REPLACE FUNCTION public.is_ticket_transferred(ticket_id_param uuid)
RETURNS boolean AS $$
DECLARE
  transfer_count integer;
BEGIN
  SELECT COUNT(*) INTO transfer_count
  FROM public.ticket_transfers
  WHERE ticket_id = ticket_id_param;
  
  RETURN transfer_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. TRIGGER TO UPDATE TRANSFER COUNT
-- ============================================
CREATE OR REPLACE FUNCTION public.update_ticket_transfer_count()
RETURNS trigger AS $$
BEGIN
  UPDATE public.tickets
  SET transfer_count = (
    SELECT COUNT(*) 
    FROM public.ticket_transfers 
    WHERE ticket_id = NEW.ticket_id
  )
  WHERE id = NEW.ticket_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_ticket_transfer_created ON public.ticket_transfers;
CREATE TRIGGER on_ticket_transfer_created
  AFTER INSERT ON public.ticket_transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ticket_transfer_count();

-- ============================================
-- 8. COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE public.ticket_transfers IS 'Tracks all ticket transfers between customers';
COMMENT ON COLUMN public.tickets.original_purchaser_name IS 'Name of the person who originally purchased the ticket';
COMMENT ON COLUMN public.tickets.original_purchaser_email IS 'Email of the person who originally purchased the ticket';
COMMENT ON COLUMN public.tickets.transfer_count IS 'Number of times this ticket has been transferred';
COMMENT ON FUNCTION public.get_ticket_transfer_history IS 'Returns complete transfer history for a ticket';
COMMENT ON FUNCTION public.is_ticket_transferred IS 'Checks if a ticket has been transferred at least once';




