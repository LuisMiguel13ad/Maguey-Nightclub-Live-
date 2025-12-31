-- Migration: Ticket Tier System
-- This migration adds ticket tier functionality for revenue differentiation
-- and VIP/premium ticket display

-- ============================================
-- 1. CREATE TICKET_TIERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.ticket_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#6b7280', -- Default gray for general
  sound_profile text NOT NULL DEFAULT 'general', -- general, vip, premium, backstage, custom
  perks_description text,
  priority_level integer NOT NULL DEFAULT 0, -- Higher number = higher priority (VIP = 10, Premium = 5, General = 0)
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ============================================
-- 2. ADD TIER COLUMN TO TICKETS TABLE
-- ============================================
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS tier text DEFAULT 'general';

-- ============================================
-- 3. INSERT DEFAULT TIERS
-- ============================================
INSERT INTO public.ticket_tiers (name, color, sound_profile, perks_description, priority_level, is_active)
VALUES 
  ('general', '#6b7280', 'general', 'Standard entry ticket', 0, true),
  ('vip', '#fbbf24', 'vip', 'VIP access with priority entry and free drink voucher', 10, true),
  ('premium', '#a855f7', 'premium', 'Premium access with reserved seating', 5, true),
  ('backstage', '#ef4444', 'backstage', 'Backstage access with meet & greet', 15, true)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 4. CREATE INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_tickets_tier ON public.tickets(tier);
CREATE INDEX IF NOT EXISTS idx_ticket_tiers_name ON public.ticket_tiers(name);
CREATE INDEX IF NOT EXISTS idx_ticket_tiers_active ON public.ticket_tiers(is_active);

-- ============================================
-- 5. UPDATE EXISTING TICKETS WITH TIER BASED ON TICKET_TYPE
-- ============================================
-- Map existing ticket types to tiers
UPDATE public.tickets
SET tier = CASE
  WHEN LOWER(ticket_type) LIKE '%vip%' THEN 'vip'
  WHEN LOWER(ticket_type) LIKE '%premium%' THEN 'premium'
  WHEN LOWER(ticket_type) LIKE '%backstage%' THEN 'backstage'
  ELSE 'general'
END
WHERE tier IS NULL OR tier = 'general';

-- ============================================
-- 6. ROW LEVEL SECURITY FOR TICKET_TIERS
-- ============================================
ALTER TABLE public.ticket_tiers ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read tiers
CREATE POLICY "Tiers are viewable by authenticated users"
  ON public.ticket_tiers FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to manage tiers (owners/admins only in app logic)
CREATE POLICY "Tiers can be managed by authenticated users"
  ON public.ticket_tiers FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 7. HELPER FUNCTION TO GET TIER INFO
-- ============================================
CREATE OR REPLACE FUNCTION public.get_tier_info(tier_name text)
RETURNS TABLE (
  id uuid,
  name text,
  color text,
  sound_profile text,
  perks_description text,
  priority_level integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tt.id,
    tt.name,
    tt.color,
    tt.sound_profile,
    tt.perks_description,
    tt.priority_level
  FROM public.ticket_tiers tt
  WHERE tt.name = tier_name AND tt.is_active = true
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE public.ticket_tiers IS 'Ticket tier definitions with colors, sounds, and perks';
COMMENT ON COLUMN public.tickets.tier IS 'Ticket tier (general, vip, premium, backstage, or custom)';
COMMENT ON COLUMN public.ticket_tiers.priority_level IS 'Higher number = higher priority for re-entry (VIP=10, Premium=5, General=0)';
COMMENT ON COLUMN public.ticket_tiers.sound_profile IS 'Sound profile type (general, vip, premium, backstage, custom)';
COMMENT ON FUNCTION public.get_tier_info IS 'Returns tier information for a given tier name';

