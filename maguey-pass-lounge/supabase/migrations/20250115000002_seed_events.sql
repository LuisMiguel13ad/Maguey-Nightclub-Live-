-- Migration: Seed initial events data
-- This seeds the database with the events from src/data/events.ts

INSERT INTO events (id, name, date, time, genre, image_url, venue_name, venue_address, city, description)
VALUES 
  (
    '1',
    'Reggaeton Nights',
    '2025-11-15',
    '22:00:00',
    'Reggaeton',
    'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&h=1200&fit=crop',
    'Maguey Nightclub',
    '123 Main St, Wilmington, DE 19801',
    'Wilmington, DE',
    'The hottest Reggaeton beats with special guest DJs. Experience an unforgettable night of music, dancing, and premium bottle service.'
  ),
  (
    '2',
    'Cumbia Fest',
    '2025-11-22',
    '21:00:00',
    'Cumbia',
    'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&h=1200&fit=crop',
    'Maguey Nightclub',
    '123 Main St, Wilmington, DE 19801',
    'Wilmington, DE',
    'Dance all night to the best Cumbia rhythms. Join us for an authentic Latin music experience with live performers and DJ sets.'
  ),
  (
    '3',
    'Regional Mexican Night',
    '2025-11-29',
    '22:00:00',
    'Regional Mexican',
    'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800&h=1200&fit=crop',
    'Maguey Nightclub',
    '123 Main St, Wilmington, DE 19801',
    'Wilmington, DE',
    'Authentic Regional Mexican music and vibes. Experience traditional sounds with a modern twist in an unforgettable atmosphere.'
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  date = EXCLUDED.date,
  time = EXCLUDED.time,
  genre = EXCLUDED.genre,
  image_url = EXCLUDED.image_url,
  venue_name = EXCLUDED.venue_name,
  venue_address = EXCLUDED.venue_address,
  city = EXCLUDED.city,
  description = EXCLUDED.description,
  updated_at = NOW();

