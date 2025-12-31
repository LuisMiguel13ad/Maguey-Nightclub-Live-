-- Migration: Add Waitlist Table
-- This migration creates the waitlist table for sold-out event management

CREATE TABLE IF NOT EXISTS public.waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  ticket_type text NOT NULL,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text,
  quantity integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'converted', 'cancelled')),
  created_at timestamp with time zone DEFAULT now(),
  notified_at timestamp with time zone,
  converted_at timestamp with time zone,
  metadata jsonb
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_waitlist_event_name ON public.waitlist(event_name);
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON public.waitlist(status);
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON public.waitlist(created_at DESC);

-- Enable RLS
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view waitlist"
  ON public.waitlist
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Owners can manage waitlist"
  ON public.waitlist
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.user_metadata->>'role' = 'owner' OR auth.users.app_metadata->>'role' = 'owner')
    )
  );

-- Allow public to add themselves to waitlist
CREATE POLICY "Public can add to waitlist"
  ON public.waitlist
  FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE public.waitlist IS 'Waitlist entries for sold-out events';


