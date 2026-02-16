-- Migration: Site Management & Cross-Site Sync
-- Adds tables for managing all three websites from one portal

-- ============================================
-- 1. SITES TABLE (Configuration for each site)
-- ============================================
CREATE TABLE IF NOT EXISTS public.sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_type text NOT NULL UNIQUE, -- 'main', 'purchase', 'scanner'
  name text NOT NULL,
  url text NOT NULL,
  environment text NOT NULL DEFAULT 'production', -- 'development', 'staging', 'production'
  is_active boolean DEFAULT true,
  description text,
  metadata jsonb, -- Additional site-specific settings
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ============================================
-- 2. SITE_CONTENT TABLE (Content management for main site)
-- ============================================
CREATE TABLE IF NOT EXISTS public.site_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_type text NOT NULL DEFAULT 'main', -- 'main', 'purchase', 'scanner'
  content_type text NOT NULL, -- 'hero', 'footer', 'about', 'contact', 'announcement', etc.
  content_key text NOT NULL, -- Unique key for the content piece
  title text,
  content text NOT NULL, -- HTML or markdown content
  metadata jsonb, -- SEO, images, links, etc.
  is_published boolean DEFAULT false,
  published_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(site_type, content_type, content_key)
);

-- ============================================
-- 3. BRANDING_SYNC TABLE (Branding sync configuration)
-- ============================================
CREATE TABLE IF NOT EXISTS public.branding_sync (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_type text NOT NULL UNIQUE, -- 'main', 'purchase', 'scanner'
  auto_sync boolean DEFAULT false, -- Auto-sync branding changes
  branding_config jsonb NOT NULL, -- Branding configuration
  last_synced_at timestamp with time zone,
  synced_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ============================================
-- 4. CROSS_SITE_SYNC_LOG TABLE (Track sync operations)
-- ============================================
CREATE TABLE IF NOT EXISTS public.cross_site_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type text NOT NULL, -- 'event', 'branding', 'content', 'settings'
  source_site text NOT NULL,
  target_sites text[] NOT NULL, -- Array of site types
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'success', 'failed', 'partial'
  details jsonb, -- Sync details, errors, etc.
  synced_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone
);

-- ============================================
-- 5. SITE_ENVIRONMENT_CONFIG TABLE (Environment variables per site)
-- ============================================
CREATE TABLE IF NOT EXISTS public.site_environment_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_type text NOT NULL,
  environment text NOT NULL DEFAULT 'production', -- 'development', 'staging', 'production'
  config_key text NOT NULL,
  config_value_encrypted text, -- Encrypted value (should be encrypted at application level)
  is_secret boolean DEFAULT false, -- Whether this is a secret (API keys, etc.)
  description text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(site_type, environment, config_key)
);

-- ============================================
-- 6. INSERT DEFAULT SITES
-- ============================================
INSERT INTO public.sites (site_type, name, url, environment, is_active, description)
VALUES 
  ('main', 'Maguey Nights - Main Site', 'https://maguey.club', 'production', true, 'Marketing and event showcase site'),
  ('purchase', 'Ticket Purchase Site', 'https://tickets.maguey.club', 'production', true, 'Customer ticket purchasing platform'),
  ('scanner', 'Ticket Scanner Admin', 'https://admin.maguey.club', 'production', true, 'Admin portal and ticket scanner')
ON CONFLICT (site_type) DO NOTHING;

-- ============================================
-- 7. INSERT DEFAULT BRANDING SYNC CONFIG
-- ============================================
INSERT INTO public.branding_sync (site_type, auto_sync, branding_config)
VALUES 
  ('main', false, '{}'::jsonb),
  ('purchase', false, '{}'::jsonb),
  ('scanner', false, '{}'::jsonb)
ON CONFLICT (site_type) DO NOTHING;

-- ============================================
-- 8. INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_sites_site_type ON public.sites(site_type);
CREATE INDEX IF NOT EXISTS idx_sites_environment ON public.sites(environment);
CREATE INDEX IF NOT EXISTS idx_site_content_site_type ON public.site_content(site_type);
CREATE INDEX IF NOT EXISTS idx_site_content_type_key ON public.site_content(content_type, content_key);
CREATE INDEX IF NOT EXISTS idx_branding_sync_site_type ON public.branding_sync(site_type);
CREATE INDEX IF NOT EXISTS idx_sync_log_type ON public.cross_site_sync_log(sync_type);
CREATE INDEX IF NOT EXISTS idx_sync_log_status ON public.cross_site_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_env_config_site_env ON public.site_environment_config(site_type, environment);

-- ============================================
-- 9. ROW LEVEL SECURITY POLICIES
-- ============================================

-- Sites: Only owners can manage
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view sites"
  ON public.sites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'role' = 'owner' OR auth.users.raw_app_meta_data->>'role' = 'owner')
    )
  );

CREATE POLICY "Owners can manage sites"
  ON public.sites FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'role' = 'owner' OR auth.users.raw_app_meta_data->>'role' = 'owner')
    )
  );

-- Site Content: Owners can manage, employees can view
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view published content"
  ON public.site_content FOR SELECT
  USING (is_published = true OR auth.role() = 'authenticated');

CREATE POLICY "Owners can manage content"
  ON public.site_content FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'role' = 'owner' OR auth.users.raw_app_meta_data->>'role' = 'owner')
    )
  );

-- Branding Sync: Only owners
ALTER TABLE public.branding_sync ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage branding sync"
  ON public.branding_sync FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'role' = 'owner' OR auth.users.raw_app_meta_data->>'role' = 'owner')
    )
  );

-- Sync Log: Only owners
ALTER TABLE public.cross_site_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view sync logs"
  ON public.cross_site_sync_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'role' = 'owner' OR auth.users.raw_app_meta_data->>'role' = 'owner')
    )
  );

-- Environment Config: Only owners, and only view (secrets should be encrypted)
ALTER TABLE public.site_environment_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage environment config"
  ON public.site_environment_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_user_meta_data->>'role' = 'owner' OR auth.users.raw_app_meta_data->>'role' = 'owner')
    )
  );

