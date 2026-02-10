-- Fix RLS policies for events table to allow owners to create/update events
-- This migration ensures that authenticated users can manage events
-- Note: Adjust these policies based on your actual RLS setup

-- Drop existing restrictive policies if they exist
DROP POLICY IF EXISTS "Owners can insert events" ON events;
DROP POLICY IF EXISTS "Owners can update events" ON events;
DROP POLICY IF EXISTS "Owners can delete events" ON events;
DROP POLICY IF EXISTS "Owners can read events" ON events;
DROP POLICY IF EXISTS "Public can read published events" ON events;

-- Temporarily allow all authenticated users to manage events
-- In production, you should restrict this based on user role metadata
CREATE POLICY "Authenticated users can insert events" ON events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update events" ON events
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete events" ON events
  FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read events" ON events
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow public read access to published events (for the main site and purchase site)
CREATE POLICY "Public can read published events" ON events
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published' AND is_active = true);

