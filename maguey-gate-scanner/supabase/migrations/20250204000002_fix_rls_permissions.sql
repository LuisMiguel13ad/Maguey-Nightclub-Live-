-- Migration: Fix RLS Policy Permission Error
-- Purpose: Avoid querying auth.users directly in RLS policies as it causes permission errors for anon users

-- ============================================
-- 1. FIX EVENTS TABLE POLICY
-- ============================================

DROP POLICY IF EXISTS "Public can view published events, authenticated can view all" ON public.events;

CREATE POLICY "Public can view published events, authenticated can view all"
ON public.events
FOR SELECT
USING (
  status = 'published'
  OR (
    -- Safer check for authenticated users
    auth.role() = 'authenticated'
  )
);

-- ============================================
-- 2. FIX TICKETS TABLE POLICY
-- ============================================

-- Check if the problematic policy exists and replace it
-- The previous policy likely queried auth.users for role checks

DROP POLICY IF EXISTS "Users can view own tickets or staff can view all" ON public.tickets;
DROP POLICY IF EXISTS "Staff can update tickets" ON public.tickets;

-- Re-create "Users can view own tickets or staff can view all" safely
CREATE POLICY "Users can view own tickets or staff can view all"
ON public.tickets
FOR SELECT
USING (
  -- User can see their own tickets (by email)
  attendee_email = ((current_setting('request.jwt.claims', true))::json->>'email')
  OR 
  -- Authenticated users with specific roles can view all
  (
    auth.role() = 'authenticated' AND (
      (current_setting('request.jwt.claims', true)::json->'app_metadata'->>'role' IN ('promoter', 'scanner', 'admin', 'owner'))
      OR 
      (current_setting('request.jwt.claims', true)::json->'user_metadata'->>'role' IN ('promoter', 'scanner', 'admin', 'owner'))
    )
  )
);

-- Re-create "Staff can update tickets" safely
CREATE POLICY "Staff can update tickets"
ON public.tickets
FOR UPDATE
USING (
  auth.role() = 'authenticated' AND (
    (current_setting('request.jwt.claims', true)::json->'app_metadata'->>'role' IN ('owner', 'employee', 'scanner', 'admin'))
    OR 
    (current_setting('request.jwt.claims', true)::json->'user_metadata'->>'role' IN ('owner', 'employee', 'scanner', 'admin'))
  )
)
WITH CHECK (
  auth.role() = 'authenticated' AND (
    (current_setting('request.jwt.claims', true)::json->'app_metadata'->>'role' IN ('owner', 'employee', 'scanner', 'admin'))
    OR 
    (current_setting('request.jwt.claims', true)::json->'user_metadata'->>'role' IN ('owner', 'employee', 'scanner', 'admin'))
  )
);

