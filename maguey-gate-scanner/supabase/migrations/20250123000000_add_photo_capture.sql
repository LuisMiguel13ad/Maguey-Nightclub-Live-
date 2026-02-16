-- Migration: Add Photo Capture for Fraud Prevention and Verification
-- This migration adds photo capture functionality to tickets

-- ============================================
-- 1. ADD PHOTO COLUMNS TO TICKETS TABLE
-- ============================================
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS photo_captured_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS photo_captured_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS photo_consent boolean DEFAULT false;

-- Create index for photo queries
CREATE INDEX IF NOT EXISTS idx_tickets_photo_captured_at ON public.tickets(photo_captured_at);
CREATE INDEX IF NOT EXISTS idx_tickets_photo_captured_by ON public.tickets(photo_captured_by);

-- ============================================
-- 2. CREATE TICKET_PHOTOS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.ticket_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  thumbnail_url text,
  photo_metadata jsonb DEFAULT '{}'::jsonb, -- {width, height, size, format, location, blur_score, etc.}
  captured_by uuid REFERENCES auth.users(id),
  captured_at timestamp with time zone DEFAULT now(),
  is_deleted boolean DEFAULT false,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ticket_photos_ticket_id ON public.ticket_photos(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_photos_captured_at ON public.ticket_photos(captured_at);
CREATE INDEX IF NOT EXISTS idx_ticket_photos_captured_by ON public.ticket_photos(captured_by);
CREATE INDEX IF NOT EXISTS idx_ticket_photos_is_deleted ON public.ticket_photos(is_deleted);

-- ============================================
-- 3. ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.ticket_photos ENABLE ROW LEVEL SECURITY;

-- Policy: Staff can view all ticket photos
CREATE POLICY "Staff can view ticket photos"
  ON public.ticket_photos
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Staff can insert ticket photos
CREATE POLICY "Staff can insert ticket photos"
  ON public.ticket_photos
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Staff can update ticket photos (for soft delete)
CREATE POLICY "Staff can update ticket photos"
  ON public.ticket_photos
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Staff can delete ticket photos (hard delete)
CREATE POLICY "Staff can delete ticket photos"
  ON public.ticket_photos
  FOR DELETE
  TO authenticated
  USING (true);

-- ============================================
-- 4. ADD COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON COLUMN public.tickets.photo_url IS 'URL to the primary photo for this ticket';
COMMENT ON COLUMN public.tickets.photo_captured_at IS 'Timestamp when the photo was captured';
COMMENT ON COLUMN public.tickets.photo_captured_by IS 'User ID who captured the photo';
COMMENT ON COLUMN public.tickets.photo_consent IS 'Whether the attendee consented to photo capture';
COMMENT ON TABLE public.ticket_photos IS 'Stores photos captured during ticket scanning for fraud prevention';
COMMENT ON COLUMN public.ticket_photos.photo_metadata IS 'JSON metadata: width, height, size (bytes), format, location (lat/lng), blur_score, etc.';

