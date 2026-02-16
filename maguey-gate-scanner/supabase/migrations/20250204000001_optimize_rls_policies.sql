-- Migration: Optimize RLS Policies for Performance
-- Date: 2025-02-04
-- Purpose: Fix RLS policy performance by using (select auth.uid()) instead of auth.uid()
-- 
-- Changes:
-- 1. Replace auth.uid() with (select auth.uid()) in policies
-- 2. Replace auth.role() with (select auth.role()) in policies
-- 3. Consolidate duplicate permissive policies where possible

-- ============================================
-- 1. OPTIMIZE SITES TABLE POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Owners can view sites" ON public.sites;
DROP POLICY IF EXISTS "Owners can manage sites" ON public.sites;

-- Create optimized consolidated policy
CREATE POLICY "Owners can manage sites"
ON public.sites
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM auth.users
    WHERE users.id = (SELECT auth.uid())
    AND (
      (users.raw_user_meta_data->>'role' = 'owner')
      OR (users.raw_app_meta_data->>'role' = 'owner')
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM auth.users
    WHERE users.id = (SELECT auth.uid())
    AND (
      (users.raw_user_meta_data->>'role' = 'owner')
      OR (users.raw_app_meta_data->>'role' = 'owner')
    )
  )
);

-- ============================================
-- 2. OPTIMIZE SITE_CONTENT TABLE POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can view published content" ON public.site_content;
DROP POLICY IF EXISTS "Owners can manage content" ON public.site_content;

-- Create optimized policies
CREATE POLICY "Users can view published content or own content"
ON public.site_content
FOR SELECT
USING (
  is_published = true
  OR (
    EXISTS (
      SELECT 1
      FROM auth.users
      WHERE users.id = (SELECT auth.uid())
      AND (
        (users.raw_user_meta_data->>'role' = 'owner')
        OR (users.raw_app_meta_data->>'role' = 'owner')
      )
    )
  )
);

CREATE POLICY "Owners can manage content"
ON public.site_content
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM auth.users
    WHERE users.id = (SELECT auth.uid())
    AND (
      (users.raw_user_meta_data->>'role' = 'owner')
      OR (users.raw_app_meta_data->>'role' = 'owner')
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM auth.users
    WHERE users.id = (SELECT auth.uid())
    AND (
      (users.raw_user_meta_data->>'role' = 'owner')
      OR (users.raw_app_meta_data->>'role' = 'owner')
    )
  )
);

-- ============================================
-- 3. OPTIMIZE BRANDING_SYNC TABLE POLICIES
-- ============================================

-- Drop existing policy
DROP POLICY IF EXISTS "Owners can manage branding sync" ON public.branding_sync;

-- Create optimized policy
CREATE POLICY "Owners can manage branding sync"
ON public.branding_sync
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM auth.users
    WHERE users.id = (SELECT auth.uid())
    AND (
      (users.raw_user_meta_data->>'role' = 'owner')
      OR (users.raw_app_meta_data->>'role' = 'owner')
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM auth.users
    WHERE users.id = (SELECT auth.uid())
    AND (
      (users.raw_user_meta_data->>'role' = 'owner')
      OR (users.raw_app_meta_data->>'role' = 'owner')
    )
  )
);

-- ============================================
-- 4. OPTIMIZE CROSS_SITE_SYNC_LOG TABLE POLICIES
-- ============================================

-- Drop existing policy
DROP POLICY IF EXISTS "Owners can view sync logs" ON public.cross_site_sync_log;

-- Create optimized policy
CREATE POLICY "Owners can view sync logs"
ON public.cross_site_sync_log
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM auth.users
    WHERE users.id = (SELECT auth.uid())
    AND (
      (users.raw_user_meta_data->>'role' = 'owner')
      OR (users.raw_app_meta_data->>'role' = 'owner')
    )
  )
);

-- ============================================
-- 5. OPTIMIZE SITE_ENVIRONMENT_CONFIG TABLE POLICIES
-- ============================================

-- Drop existing policy
DROP POLICY IF EXISTS "Owners can manage environment config" ON public.site_environment_config;

-- Create optimized policy
CREATE POLICY "Owners can manage environment config"
ON public.site_environment_config
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM auth.users
    WHERE users.id = (SELECT auth.uid())
    AND (
      (users.raw_user_meta_data->>'role' = 'owner')
      OR (users.raw_app_meta_data->>'role' = 'owner')
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM auth.users
    WHERE users.id = (SELECT auth.uid())
    AND (
      (users.raw_user_meta_data->>'role' = 'owner')
      OR (users.raw_app_meta_data->>'role' = 'owner')
    )
  )
);

-- ============================================
-- 6. OPTIMIZE ORDERS TABLE POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Allow public insert on orders" ON public.orders;
DROP POLICY IF EXISTS "Public can create orders" ON public.orders;

-- Create optimized consolidated policies
CREATE POLICY "Users can view own orders or staff can view all"
ON public.orders
FOR SELECT
USING (
  purchaser_email = ((current_setting('request.jwt.claims', true))::json->>'email')
  OR (
    EXISTS (
      SELECT 1
      FROM auth.users
      WHERE users.id = (SELECT auth.uid())
      AND (
        (users.raw_user_meta_data->>'role' IN ('promoter', 'admin', 'owner'))
        OR (users.raw_app_meta_data->>'role' IN ('promoter', 'admin', 'owner'))
      )
    )
  )
);

CREATE POLICY "Public can create orders"
ON public.orders
FOR INSERT
WITH CHECK (true);

-- ============================================
-- 7. OPTIMIZE TICKETS TABLE POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own tickets" ON public.tickets;
DROP POLICY IF EXISTS "Allow public insert on tickets" ON public.tickets;
DROP POLICY IF EXISTS "Public can create tickets" ON public.tickets;
DROP POLICY IF EXISTS "Allow public read on tickets" ON public.tickets;
DROP POLICY IF EXISTS "Authenticated users can update tickets" ON public.tickets;

-- Create optimized consolidated policies
CREATE POLICY "Users can view own tickets or staff can view all"
ON public.tickets
FOR SELECT
USING (
  attendee_email = ((current_setting('request.jwt.claims', true))::json->>'email')
  OR (
    EXISTS (
      SELECT 1
      FROM auth.users
      WHERE users.id = (SELECT auth.uid())
      AND (
        (users.raw_user_meta_data->>'role' IN ('promoter', 'scanner', 'admin', 'owner'))
        OR (users.raw_app_meta_data->>'role' IN ('promoter', 'scanner', 'admin', 'owner'))
      )
    )
  )
);

CREATE POLICY "Public can create tickets"
ON public.tickets
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Staff can update tickets"
ON public.tickets
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM auth.users
    WHERE users.id = (SELECT auth.uid())
    AND (
      (users.raw_user_meta_data->>'role' IN ('owner', 'employee', 'scanner', 'admin'))
      OR (users.raw_app_meta_data->>'role' IN ('owner', 'employee', 'scanner', 'admin'))
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM auth.users
    WHERE users.id = (SELECT auth.uid())
    AND (
      (users.raw_user_meta_data->>'role' IN ('owner', 'employee', 'scanner', 'admin'))
      OR (users.raw_app_meta_data->>'role' IN ('owner', 'employee', 'scanner', 'admin'))
    )
  )
);

-- ============================================
-- 8. OPTIMIZE EVENTS TABLE POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Allow public read on events" ON public.events;
DROP POLICY IF EXISTS "Public can view published events" ON public.events;
DROP POLICY IF EXISTS "Authenticated users can view all events" ON public.events;

-- Create optimized consolidated policy
CREATE POLICY "Public can view published events, authenticated can view all"
ON public.events
FOR SELECT
USING (
  status = 'published'
  OR (
    EXISTS (
      SELECT 1
      FROM auth.users
      WHERE users.id = (SELECT auth.uid())
    )
  )
);

