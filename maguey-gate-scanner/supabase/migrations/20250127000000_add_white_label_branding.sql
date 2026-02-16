-- Migration: White-Label Branding System
-- This migration adds tables and functionality for multi-tenant branding

-- ============================================
-- 1. VENUES TABLE (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS public.venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  subdomain text UNIQUE,
  custom_domain text UNIQUE,
  organization_id uuid,
  is_active boolean DEFAULT true,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ============================================
-- 2. VENUE_BRANDING TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.venue_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid REFERENCES public.venues(id) ON DELETE CASCADE UNIQUE,
  logo_url text,
  logo_square_url text,
  favicon_url text,
  primary_color text DEFAULT '#8B5CF6',
  secondary_color text DEFAULT '#EC4899',
  accent_color text DEFAULT '#10B981',
  font_family text DEFAULT 'Inter',
  custom_css text,
  theme_preset text DEFAULT 'default',
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ============================================
-- 3. VENUE_ASSETS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.venue_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid REFERENCES public.venues(id) ON DELETE CASCADE,
  asset_type text NOT NULL, -- 'logo', 'logo_square', 'favicon', 'email_header', 'pdf_template', etc.
  original_filename text NOT NULL,
  storage_url text NOT NULL,
  cdn_url text,
  file_size_bytes integer,
  mime_type text,
  width integer,
  height integer,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now()
);

-- ============================================
-- 4. BRANDING_TEMPLATES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.branding_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  preview_image_url text,
  configuration jsonb NOT NULL,
  is_public boolean DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now()
);

-- ============================================
-- 5. INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_venue_branding_venue ON public.venue_branding(venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_assets_venue_type ON public.venue_assets(venue_id, asset_type);
CREATE INDEX IF NOT EXISTS idx_venue_assets_asset_type ON public.venue_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_venues_slug ON public.venues(slug);
CREATE INDEX IF NOT EXISTS idx_venues_subdomain ON public.venues(subdomain);
CREATE INDEX IF NOT EXISTS idx_venues_custom_domain ON public.venues(custom_domain);
CREATE INDEX IF NOT EXISTS idx_branding_templates_public ON public.branding_templates(is_public) WHERE is_public = true;

-- ============================================
-- 6. ROW LEVEL SECURITY POLICIES
-- ============================================
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branding_templates ENABLE ROW LEVEL SECURITY;

-- Venues: Authenticated users can view, owners can manage
CREATE POLICY "Users can view venues"
  ON public.venues
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Owners can manage venues"
  ON public.venues
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'owner'
    )
  );

-- Venue Branding: Authenticated users can view, owners can manage
CREATE POLICY "Users can view venue branding"
  ON public.venue_branding
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Owners can manage venue branding"
  ON public.venue_branding
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'owner'
    )
  );

-- Venue Assets: Authenticated users can view, owners can manage
CREATE POLICY "Users can view venue assets"
  ON public.venue_assets
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Owners can manage venue assets"
  ON public.venue_assets
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'owner'
    )
  );

-- Branding Templates: Public templates visible to all, private templates to owners
CREATE POLICY "Users can view public templates"
  ON public.branding_templates
  FOR SELECT
  TO authenticated
  USING (is_public = true OR created_by = auth.uid());

CREATE POLICY "Owners can create templates"
  ON public.branding_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'owner'
    )
  );

CREATE POLICY "Template creators can update their templates"
  ON public.branding_templates
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- ============================================
-- 7. FUNCTIONS FOR UPDATED_AT TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_venues_updated_at
  BEFORE UPDATE ON public.venues
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_venue_branding_updated_at
  BEFORE UPDATE ON public.venue_branding
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 8. DEFAULT VENUE (for existing system)
-- ============================================
-- Create a default venue if none exists
INSERT INTO public.venues (id, name, slug, is_active)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Venue', 'default', true)
ON CONFLICT (id) DO NOTHING;

-- Create default branding for default venue
INSERT INTO public.venue_branding (venue_id, primary_color, secondary_color, accent_color, font_family, theme_preset)
VALUES ('00000000-0000-0000-0000-000000000001', '#8B5CF6', '#EC4899', '#10B981', 'Inter', 'default')
ON CONFLICT (venue_id) DO NOTHING;

