-- Migration: Add ID Verification Support
-- Creates id_verifications table and adds ID verification columns to tickets and ticket_types

-- ============================================
-- 1. Add ID verification columns to ticket_types table
-- ============================================
-- Note: If ticket_types table doesn't exist, this will be skipped
-- You may need to create ticket_types table first or add to events.ticket_types JSONB
ALTER TABLE ticket_types 
  ADD COLUMN IF NOT EXISTS id_verification_required BOOLEAN DEFAULT false;

-- ============================================
-- 2. Add ID verification columns to tickets table
-- ============================================
ALTER TABLE tickets 
  ADD COLUMN IF NOT EXISTS id_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS id_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS id_verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS id_verification_type TEXT CHECK (id_verification_type IN ('18+', '21+', 'custom', 'none')),
  ADD COLUMN IF NOT EXISTS id_verification_notes TEXT;

-- ============================================
-- 3. Create id_verifications table for detailed verification logs
-- ============================================
CREATE TABLE IF NOT EXISTS id_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  verification_type TEXT NOT NULL CHECK (verification_type IN ('18+', '21+', 'custom', 'none')),
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  id_number TEXT,
  photo_url TEXT,
  notes TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT true,
  skipped BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 4. Add indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_id_verifications_ticket_id ON id_verifications(ticket_id);
CREATE INDEX IF NOT EXISTS idx_id_verifications_verified_at ON id_verifications(verified_at DESC);
CREATE INDEX IF NOT EXISTS idx_id_verifications_verified_by ON id_verifications(verified_by);
CREATE INDEX IF NOT EXISTS idx_tickets_id_verified ON tickets(id_verified);
CREATE INDEX IF NOT EXISTS idx_tickets_id_verification_type ON tickets(id_verification_type);

-- ============================================
-- 5. Enable RLS on id_verifications table
-- ============================================
ALTER TABLE id_verifications ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. RLS Policies for id_verifications
-- ============================================
-- Allow authenticated users to read verification history
CREATE POLICY "Allow authenticated users to read id_verifications"
  ON id_verifications
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert verifications
CREATE POLICY "Allow authenticated users to insert id_verifications"
  ON id_verifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow service role full access
CREATE POLICY "Allow service role full access to id_verifications"
  ON id_verifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 7. Add comments for documentation
-- ============================================
COMMENT ON TABLE id_verifications IS 'Tracks ID verification records for compliance and audit purposes';
COMMENT ON COLUMN tickets.id_verified IS 'Whether the ticket holder has been ID verified';
COMMENT ON COLUMN tickets.id_verification_type IS 'Type of ID verification required: 18+, 21+, custom, or none';
COMMENT ON COLUMN id_verifications.verification_type IS 'Type of verification performed';
COMMENT ON COLUMN id_verifications.skipped IS 'Whether ID verification was skipped (with notes)';

