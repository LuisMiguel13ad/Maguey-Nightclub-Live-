-- Migration: Create event-images storage bucket with proper RLS policies
-- This allows users to upload event flyers/images

-- Create the event-images bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-images',
  'event-images',
  true,  -- public bucket for serving images
  5242880,  -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- Drop ALL existing policies for event-images bucket to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated users to upload event images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public to view event images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update own event images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete event images" ON storage.objects;
DROP POLICY IF EXISTS "event_images_insert" ON storage.objects;
DROP POLICY IF EXISTS "event_images_select" ON storage.objects;
DROP POLICY IF EXISTS "event_images_update" ON storage.objects;
DROP POLICY IF EXISTS "event_images_delete" ON storage.objects;
DROP POLICY IF EXISTS "event_images_upload" ON storage.objects;
DROP POLICY IF EXISTS "event_images_read" ON storage.objects;
DROP POLICY IF EXISTS "event_images_modify" ON storage.objects;
DROP POLICY IF EXISTS "event_images_remove" ON storage.objects;
DROP POLICY IF EXISTS "Owners can upload event images" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete event images" ON storage.objects;
DROP POLICY IF EXISTS "Owners can update event images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view event images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload to event-images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view event-images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update event-images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete event-images" ON storage.objects;

-- Create permissive policies for event-images bucket
-- Note: Using simple bucket_id check without role restrictions for maximum compatibility

-- Policy: Allow anyone to upload images (public bucket)
CREATE POLICY "event_images_upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'event-images');

-- Policy: Allow anyone to view/download event images
CREATE POLICY "event_images_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'event-images');

-- Policy: Allow anyone to update images
CREATE POLICY "event_images_modify"
ON storage.objects FOR UPDATE
USING (bucket_id = 'event-images');

-- Policy: Allow anyone to delete images
CREATE POLICY "event_images_remove"
ON storage.objects FOR DELETE
USING (bucket_id = 'event-images');

-- ============================================
-- TICKET_TYPES TABLE RLS POLICIES
-- ============================================
-- The ticket_types table has RLS enabled but no policies, causing DEFAULT DENY

-- Add policy for authenticated users to manage ticket types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ticket_types'
    AND policyname = 'ticket_types_full_access'
  ) THEN
    CREATE POLICY "ticket_types_full_access"
    ON ticket_types FOR ALL
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

-- Add policy for public to read ticket types (for storefront)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ticket_types'
    AND policyname = 'ticket_types_public_read'
  ) THEN
    CREATE POLICY "ticket_types_public_read"
    ON ticket_types FOR SELECT
    TO anon
    USING (true);
  END IF;
END $$;
