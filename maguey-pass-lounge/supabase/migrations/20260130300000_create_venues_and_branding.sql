-- =============================================================================
-- Create venues and venue_branding tables for white-label support
-- Fixes: "venue_branding table does not exist" error blocking scanner
-- =============================================================================

-- Create venues table for white-label branding support
CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Maguey Nightclub',
  slug TEXT UNIQUE DEFAULT 'default',
  subdomain TEXT UNIQUE,
  custom_domain TEXT UNIQUE,
  organization_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default venue
INSERT INTO venues (id, name, slug, is_active)
VALUES ('00000000-0000-0000-0000-000000000001', 'Maguey Nightclub', 'default', true)
ON CONFLICT (slug) DO NOTHING;

-- Create venue_branding table
CREATE TABLE IF NOT EXISTS venue_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  logo_url TEXT,
  logo_square_url TEXT,
  favicon_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#9333ea',
  secondary_color TEXT NOT NULL DEFAULT '#1f2937',
  accent_color TEXT NOT NULL DEFAULT '#22c55e',
  font_family TEXT NOT NULL DEFAULT 'Inter',
  custom_css TEXT,
  theme_preset TEXT NOT NULL DEFAULT 'default',
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_venue_branding UNIQUE (venue_id)
);

-- Insert default branding (Maguey purple theme)
INSERT INTO venue_branding (venue_id, primary_color, secondary_color, accent_color)
VALUES ('00000000-0000-0000-0000-000000000001', '#9333ea', '#1f2937', '#22c55e')
ON CONFLICT (venue_id) DO NOTHING;

-- Enable RLS
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_branding ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Authenticated users can read venues" ON venues;
DROP POLICY IF EXISTS "Authenticated users can read venue branding" ON venue_branding;

-- RLS Policies: Allow authenticated users to read
CREATE POLICY "Authenticated users can read venues"
  ON venues FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read venue branding"
  ON venue_branding FOR SELECT TO authenticated USING (true);

-- Index for slug lookup
CREATE INDEX IF NOT EXISTS idx_venues_slug ON venues(slug);

-- =============================================================================
-- Verification query (run after migration):
-- SELECT EXISTS (SELECT 1 FROM venues WHERE slug = 'default');
-- SELECT EXISTS (SELECT 1 FROM venue_branding WHERE venue_id = '00000000-0000-0000-0000-000000000001');
-- =============================================================================
