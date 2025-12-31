-- Migration: Add Event Status, Rich Fields, and Publishing System
-- Adds draft/publish/archived status, categories, tags, and published_at timestamp

-- ============================================
-- 1. ADD STATUS FIELD TO EVENTS TABLE
-- ============================================
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  ADD COLUMN IF NOT EXISTS published_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS categories jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb;

-- ============================================
-- 2. UPDATE EXISTING EVENTS TO PUBLISHED
-- ============================================
-- Set all existing active events to published status
UPDATE public.events
SET status = 'published',
    published_at = created_at
WHERE status IS NULL OR status = 'draft'
  AND is_active = true;

-- ============================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_events_status ON public.events(status);
CREATE INDEX IF NOT EXISTS idx_events_published_at ON public.events(published_at);
CREATE INDEX IF NOT EXISTS idx_events_categories ON public.events USING gin(categories);
CREATE INDEX IF NOT EXISTS idx_events_tags ON public.events USING gin(tags);

-- ============================================
-- 4. UPDATE RLS POLICIES
-- ============================================
-- Ensure public can only see published events
-- (This assumes RLS is already enabled on events table)

-- Drop existing public read policy if it exists and create new one
DROP POLICY IF EXISTS "Public can view published events" ON public.events;

CREATE POLICY "Public can view published events"
  ON public.events FOR SELECT
  USING (status = 'published');

-- Staff/authenticated users can view all events
DROP POLICY IF EXISTS "Authenticated users can view all events" ON public.events;

CREATE POLICY "Authenticated users can view all events"
  ON public.events FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- 5. COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON COLUMN public.events.status IS 'Event publication status: draft (not visible to public), published (visible), archived (hidden but preserved)';
COMMENT ON COLUMN public.events.published_at IS 'Timestamp when event was first published';
COMMENT ON COLUMN public.events.categories IS 'JSON array of category strings (e.g., ["Music", "Nightlife", "Latin"])';
COMMENT ON COLUMN public.events.tags IS 'JSON array of tag strings for filtering and search (e.g., ["reggaeton", "friday", "vip"])';

