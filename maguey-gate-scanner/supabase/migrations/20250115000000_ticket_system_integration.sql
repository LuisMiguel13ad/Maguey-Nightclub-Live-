-- Migration: Ticket System Integration
-- This migration adds tables and columns needed to integrate
-- ticket purchase system with Stripe and the scanner

-- ============================================
-- 1. EVENTS TABLE (for capacity management)
-- ============================================
CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  event_date timestamp with time zone NOT NULL,
  venue_capacity integer NOT NULL,
  ticket_types jsonb NOT NULL, -- [{"name": "VIP", "price": 50.00, "capacity": 100}, {"name": "General Admission", "price": 25.00, "capacity": 200}]
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ============================================
-- 2. ORDERS TABLE (Stripe payment tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_payment_intent_id text UNIQUE NOT NULL,
  stripe_customer_id text,
  stripe_checkout_session_id text,
  customer_email text NOT NULL,
  customer_name text,
  customer_phone text,
  total_amount decimal(10,2) NOT NULL,
  currency text DEFAULT 'usd',
  status text NOT NULL DEFAULT 'pending', -- pending, completed, failed, refunded, cancelled
  event_name text NOT NULL,
  ticket_count integer NOT NULL,
  ticket_type text NOT NULL,
  metadata jsonb, -- Additional order metadata
  created_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now()
);

-- ============================================
-- 3. PAYMENTS TABLE (Payment records)
-- ============================================
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  stripe_payment_intent_id text UNIQUE NOT NULL,
  stripe_charge_id text,
  amount decimal(10,2) NOT NULL,
  currency text DEFAULT 'usd',
  status text NOT NULL, -- succeeded, failed, refunded, pending
  refund_amount decimal(10,2) DEFAULT 0,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ============================================
-- 4. UPDATE TICKETS TABLE (add integration fields)
-- ============================================
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS qr_code_data text UNIQUE, -- The actual QR code string (ticket_id or custom)
  ADD COLUMN IF NOT EXISTS price_paid decimal(10,2),
  ADD COLUMN IF NOT EXISTS stripe_payment_id text,
  ADD COLUMN IF NOT EXISTS guest_phone text,
  ADD COLUMN IF NOT EXISTS metadata jsonb;

-- ============================================
-- 5. INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_tickets_order_id ON public.tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_tickets_qr_code_data ON public.tickets(qr_code_data);
CREATE INDEX IF NOT EXISTS idx_tickets_event_name ON public.tickets(event_name);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_payment_intent ON public.orders(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON public.orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_payment_intent ON public.payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_events_name ON public.events(name);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON public.events(event_date);

-- ============================================
-- 6. ROW LEVEL SECURITY POLICIES
-- ============================================

-- Events: Public read access, authenticated write
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Events are viewable by everyone"
  ON public.events FOR SELECT
  USING (true);

CREATE POLICY "Events can be created by authenticated users"
  ON public.events FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Events can be updated by authenticated users"
  ON public.events FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Orders: Customers can view their own orders, staff can view all
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view their own orders"
  ON public.orders FOR SELECT
  USING (
    auth.uid() IS NOT NULL OR 
    customer_email = current_setting('request.jwt.claims', true)::json->>'email'
  );

CREATE POLICY "Orders can be created by anyone (for webhook)"
  ON public.orders FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Orders can be updated by authenticated users"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Payments: Similar to orders
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Payments are viewable by authenticated users"
  ON public.payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Payments can be created by anyone (for webhook)"
  ON public.payments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Payments can be updated by authenticated users"
  ON public.payments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Update tickets policies to allow public read for QR validation
-- (Note: This is already handled, but ensure tickets with order_id are accessible)
CREATE POLICY IF NOT EXISTS "Tickets with order_id are viewable for validation"
  ON public.tickets FOR SELECT
  USING (true); -- Allow read for QR code validation

-- ============================================
-- 7. HELPER FUNCTIONS
-- ============================================

-- Function to check event ticket availability
CREATE OR REPLACE FUNCTION public.get_event_availability(event_name_param text)
RETURNS TABLE (
  event_name text,
  total_capacity integer,
  tickets_sold bigint,
  tickets_available bigint,
  ticket_types jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.name,
    e.venue_capacity as total_capacity,
    COUNT(t.id) as tickets_sold,
    GREATEST(0, e.venue_capacity - COUNT(t.id)) as tickets_available,
    e.ticket_types
  FROM public.events e
  LEFT JOIN public.tickets t ON t.event_name = e.name
  WHERE e.name = event_name_param AND e.is_active = true
  GROUP BY e.id, e.name, e.venue_capacity, e.ticket_types;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get ticket count by type for an event
CREATE OR REPLACE FUNCTION public.get_ticket_count_by_type(event_name_param text, ticket_type_param text)
RETURNS integer AS $$
DECLARE
  count_result integer;
BEGIN
  SELECT COUNT(*) INTO count_result
  FROM public.tickets
  WHERE event_name = event_name_param AND ticket_type = ticket_type_param;
  
  RETURN count_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. INSERT DEFAULT EVENTS
-- ============================================
INSERT INTO public.events (name, description, event_date, venue_capacity, ticket_types, is_active)
VALUES 
  (
    'Perreo Fridays',
    'Weekly Friday night party with Latin music',
    (SELECT date_trunc('week', CURRENT_DATE) + INTERVAL '4 days' + INTERVAL '21 hours'), -- Next Friday at 9 PM
    500,
    '[
      {"name": "VIP", "price": 50.00, "capacity": 100},
      {"name": "General Admission", "price": 25.00, "capacity": 400}
    ]'::jsonb,
    true
  ),
  (
    'Regional Mexicano',
    'Saturday night with regional Mexican music',
    (SELECT date_trunc('week', CURRENT_DATE) + INTERVAL '5 days' + INTERVAL '21 hours'), -- Next Saturday at 9 PM
    600,
    '[
      {"name": "VIP", "price": 55.00, "capacity": 120},
      {"name": "General Admission", "price": 30.00, "capacity": 480}
    ]'::jsonb,
    true
  ),
  (
    'Cumbia Nights',
    'Sunday night cumbia dance party',
    (SELECT date_trunc('week', CURRENT_DATE) + INTERVAL '6 days' + INTERVAL '20 hours'), -- Next Sunday at 8 PM
    450,
    '[
      {"name": "VIP", "price": 45.00, "capacity": 80},
      {"name": "General Admission", "price": 20.00, "capacity": 370}
    ]'::jsonb,
    true
  )
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 9. COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE public.events IS 'Event information with capacity and ticket types';
COMMENT ON TABLE public.orders IS 'Customer orders from Stripe checkout';
COMMENT ON TABLE public.payments IS 'Payment records from Stripe';
COMMENT ON COLUMN public.tickets.order_id IS 'Links ticket to the order that created it';
COMMENT ON COLUMN public.tickets.qr_code_data IS 'The QR code data string (usually the ticket_id)';
COMMENT ON FUNCTION public.get_event_availability IS 'Returns real-time ticket availability for an event';

