-- Migration: Fix RLS policies to allow public ticket purchases
-- Critical fix to enable anonymous users to purchase tickets
-- Run this migration ASAP!

BEGIN;

-- ============================================
-- ALLOW PUBLIC TICKET PURCHASES
-- ============================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Promoters insert orders" ON public.orders;
DROP POLICY IF EXISTS "Promoters insert tickets" ON public.tickets;

-- Allow anyone (anonymous and authenticated) to create orders
CREATE POLICY "Public can create orders"
  ON public.orders
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow anyone (anonymous and authenticated) to create tickets
CREATE POLICY "Public can create tickets"
  ON public.tickets
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow users to view their own orders (by email)
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
CREATE POLICY "Users can view own orders"
  ON public.orders
  FOR SELECT
  TO anon, authenticated
  USING (
    purchaser_email = current_setting('request.jwt.claims', true)::json->>'email'
    OR current_setting('request.jwt.claims', true)::json->>'role' IN ('promoter', 'admin')
  );

-- Allow users to view their own tickets (by email)
DROP POLICY IF EXISTS "Users can view own tickets" ON public.tickets;
CREATE POLICY "Users can view own tickets"
  ON public.tickets
  FOR SELECT
  TO anon, authenticated
  USING (
    attendee_email = current_setting('request.jwt.claims', true)::json->>'email'
    OR current_setting('request.jwt.claims', true)::json->>'role' IN ('promoter', 'scanner', 'admin')
  );

-- Keep existing promoter/scanner policies for management
-- (They already exist from previous migration)

COMMIT;

