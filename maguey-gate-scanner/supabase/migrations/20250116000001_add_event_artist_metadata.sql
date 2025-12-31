-- Migration: Add artist/DJ and metadata fields to events table

-- This allows events to specify featured artists/DJs

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS artist_name text,
  ADD COLUMN IF NOT EXISTS artist_description text,
  ADD COLUMN IF NOT EXISTS event_category text, -- 'reggaeton', 'regional_mexicano', 'cumbia', 'special'
  ADD COLUMN IF NOT EXISTS metadata jsonb; -- Additional flexible data

-- Add index for event category filtering
CREATE INDEX IF NOT EXISTS idx_events_category ON public.events(event_category);
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(event_date);

-- Add comments
COMMENT ON COLUMN public.events.artist_name IS 'Featured artist or DJ name for the event';
COMMENT ON COLUMN public.events.event_category IS 'Event category: reggaeton, regional_mexicano, cumbia, special, etc.';
COMMENT ON COLUMN public.events.metadata IS 'Additional event metadata (social media, special requirements, etc.)';

