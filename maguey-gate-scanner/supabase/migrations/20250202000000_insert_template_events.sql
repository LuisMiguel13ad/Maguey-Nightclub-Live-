-- Migration: Insert 20 Template Events for Maguey Club
-- Events structured for your actual database schema
-- Structure: Reggaeton Fridays, Regional Mexicano Saturdays, Cumbia Sundays

-- Insert Events (20 events total)
INSERT INTO public.events (name, description, event_date, event_time, venue_name, venue_address, city, artist_name, event_category, genre)
VALUES 
    -- Week 1 Events (Nov 21-23, 2025)
    (
      'Reggaeton Fridays - November 21',
      'Weekly Friday night party with Latin music and reggaeton',
      '2025-11-21',
      '21:00:00',
      'Maguey Delaware',
      '3320 Old Capitol Trail',
      'Wilmington',
      'DJ TBA',
      'reggaeton',
      'Reggaeton'
    ),
    (
      'GRUPO EXTERMINADOR Y LOS TERRIBLES DEL NORTE',
      'Live Regional Mexicano with Grupo Exterminador and Los Terribles del Norte',
      '2025-11-22',
      '20:00:00',
      'Maguey Delaware',
      '3320 Old Capitol Trail',
      'Wilmington',
      'Grupo Exterminador y Los Terribles del Norte',
      'regional_mexicano',
      'Regional Mexicano'
    ),
    (
      'Cumbia Nights - November 23',
      'Sunday night cumbia dance party',
      '2025-11-23',
      '20:00:00',
      'Maguey Delaware',
      '3320 Old Capitol Trail',
      'Wilmington',
      'DJ TBA',
      'cumbia',
      'Cumbia'
    ),
    
    -- Week 2 Events (Nov 28-30, 2025)
    (
      'Reggaeton Fridays - November 28',
      'Thanksgiving weekend reggaeton party',
      '2025-11-28',
      '21:00:00',
      'Maguey Delaware',
      '3320 Old Capitol Trail',
      'Wilmington',
      'DJ TBA',
      'reggaeton',
      'Reggaeton'
    ),
    (
      'Regional Mexicano Saturdays - November 29',
      'Saturday night with regional Mexican music',
      '2025-11-29',
      '21:00:00',
      'Maguey Delaware',
      '3320 Old Capitol Trail',
      'Wilmington',
      'Artist TBA',
      'regional_mexicano',
      'Regional Mexicano'
    ),
    (
      'Cumbia Nights - November 30',
      'Sunday night cumbia dance party',
      '2025-11-30',
      '20:00:00',
      'Maguey Delaware',
      '3320 Old Capitol Trail',
      'Wilmington',
      'DJ TBA',
      'cumbia',
      'Cumbia'
    ),
    
    -- Week 3 Events (Dec 5-7, 2025)
    (
      'Reggaeton Fridays - December 5',
      'Weekly Friday night party with Latin music and reggaeton',
      '2025-12-05',
      '21:00:00',
      'Maguey Delaware',
      '3320 Old Capitol Trail',
      'Wilmington',
      'DJ TBA',
      'reggaeton',
      'Reggaeton'
    ),
    (
      'Regional Mexicano Saturdays - December 6',
      'Saturday night with regional Mexican music',
      '2025-12-06',
      '21:00:00',
      'Maguey Delaware',
      '3320 Old Capitol Trail',
      'Wilmington',
      'Artist TBA',
      'regional_mexicano',
      'Regional Mexicano'
    ),
    (
      'Cumbia Nights - December 7',
      'Sunday night cumbia dance party',
      '2025-12-07',
      '20:00:00',
      'Maguey Delaware',
      '3320 Old Capitol Trail',
      'Wilmington',
      'DJ TBA',
      'cumbia',
      'Cumbia'
    ),
    
    -- Week 4 Events (Dec 12-14, 2025)
    (
      'Reggaeton Fridays - December 12',
      'Weekly Friday night party with Latin music and reggaeton',
      '2025-12-12',
      '21:00:00',
      'Maguey Delaware',
      '3320 Old Capitol Trail',
      'Wilmington',
      'DJ TBA',
      'reggaeton',
      'Reggaeton'
    ),
    (
      'Regional Mexicano Saturdays - December 13',
      'Saturday night with regional Mexican music',
      '2025-12-13',
      '21:00:00',
      'Maguey Delaware',
      '3320 Old Capitol Trail',
      'Wilmington',
      'Artist TBA',
      'regional_mexicano',
      'Regional Mexicano'
    ),
    (
      'Cumbia Nights - December 14',
      'Sunday night cumbia dance party',
      '2025-12-14',
      '20:00:00',
      'Maguey Delaware',
      '3320 Old Capitol Trail',
      'Wilmington',
      'DJ TBA',
      'cumbia',
      'Cumbia'
    ),
    
    -- Week 5 Events (Dec 19-21, 2025)
    (
      'Reggaeton Fridays - December 19',
      'Friday night reggaeton and Latin trap',
      '2025-12-19',
      '21:00:00',
      'Maguey Delaware',
      '3320 Old Capitol Trail',
      'Wilmington',
      'DJ TBA',
      'reggaeton',
      'Reggaeton'
    ),
    (
      'Regional Mexicano Saturdays - December 20',
      'Saturday night regional Mexican hits',
      '2025-12-20',
      '21:00:00',
      'Maguey Delaware',
      '3320 Old Capitol Trail',
      'Wilmington',
      'Artist TBA',
      'regional_mexicano',
      'Regional Mexicano'
    ),
    (
      'Cumbia Nights - December 21',
      'Sunday cumbia party',
      '2025-12-21',
      '20:00:00',
      'Maguey Delaware',
      '3320 Old Capitol Trail',
      'Wilmington',
      'DJ TBA',
      'cumbia',
      'Cumbia'
    ),
    
    -- Special Events
    (
      'Holiday Party Spectacular',
      'Special holiday celebration with top DJs and performers',
      '2025-12-18',
      '22:00:00',
      'Maguey Delaware',
      '3320 Old Capitol Trail',
      'Wilmington',
      'Special Guest DJs',
      'special',
      'Party'
    ),
    (
      'Christmas Eve Latin Party',
      'Christmas Eve celebration with Latin music all night',
      '2025-12-24',
      '21:00:00',
      'Maguey Delaware',
      '3320 Old Capitol Trail',
      'Wilmington',
      'Holiday Special Artists',
      'special',
      'Party'
    ),
    (
      'Throwback Reggaeton Night',
      'Classic reggaeton hits from the 2000s',
      '2025-12-26',
      '21:00:00',
      'Maguey Delaware',
      '3320 Old Capitol Trail',
      'Wilmington',
      'DJ TBA',
      'reggaeton',
      'Reggaeton'
    ),
    (
      'Banda Night',
      'Live banda music and dancing',
      '2025-12-27',
      '21:00:00',
      'Maguey Delaware',
      '3320 Old Capitol Trail',
      'Wilmington',
      'Live Banda TBA',
      'regional_mexicano',
      'Banda'
    ),
    (
      'New Year''s Eve Countdown 2026',
      'Ring in the new year with the biggest party of the year',
      '2025-12-31',
      '21:00:00',
      'Maguey Delaware',
      '3320 Old Capitol Trail',
      'Wilmington',
      'NYE All-Star Lineup',
      'special',
      'Party'
    )
;

-- Insert VIP tickets for all new events
INSERT INTO public.ticket_types (event_id, code, name, price, total_inventory)
SELECT 
  e.id,
  'VIP',
  'VIP',
  CASE 
    WHEN e.event_category = 'special' THEN 60.00
    WHEN e.event_category = 'regional_mexicano' THEN 55.00
    WHEN e.event_category = 'cumbia' THEN 45.00
    ELSE 50.00
  END,
  CASE 
    WHEN e.event_category = 'special' THEN 150
    WHEN e.event_category = 'regional_mexicano' THEN 120
    WHEN e.event_category = 'cumbia' THEN 80
    ELSE 100
  END
FROM public.events e
WHERE e.event_date >= '2025-11-21' 
  AND e.event_date < '2026-01-01'
  AND NOT EXISTS (
    SELECT 1 FROM public.ticket_types tt WHERE tt.event_id = e.id
  );

-- Insert General Admission tickets
INSERT INTO public.ticket_types (event_id, code, name, price, total_inventory)
SELECT 
  e.id,
  'GA',
  'General Admission',
  CASE 
    WHEN e.event_category = 'special' THEN 35.00
    WHEN e.event_category = 'regional_mexicano' THEN 30.00
    WHEN e.event_category = 'cumbia' THEN 20.00
    ELSE 25.00
  END,
  CASE 
    WHEN e.event_category = 'special' THEN 550
    WHEN e.event_category = 'regional_mexicano' THEN 480
    WHEN e.event_category = 'cumbia' THEN 370
    ELSE 400
  END
FROM public.events e
WHERE e.event_date >= '2025-11-21' 
  AND e.event_date < '2026-01-01'
  AND EXISTS (
    SELECT 1 FROM public.ticket_types tt WHERE tt.event_id = e.id AND tt.code = 'VIP'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.ticket_types tt WHERE tt.event_id = e.id AND tt.code = 'GA'
  );

-- Insert VIP Table tickets for special events
INSERT INTO public.ticket_types (event_id, code, name, price, total_inventory)
SELECT 
  e.id,
  'VIPTABLE',
  'VIP Table for 4',
  CASE 
    WHEN e.name LIKE '%New Year%' THEN 400.00
    WHEN e.name LIKE '%Holiday%' THEN 200.00
    WHEN e.name LIKE '%Christmas%' THEN 150.00
    ELSE 200.00
  END,
  CASE 
    WHEN e.name LIKE '%New Year%' THEN 50
    ELSE 30
  END
FROM public.events e
WHERE e.event_category = 'special'
  AND e.event_date >= '2025-11-21'
  AND e.event_date < '2026-01-01'
  AND EXISTS (
    SELECT 1 FROM public.ticket_types tt WHERE tt.event_id = e.id AND tt.code = 'VIP'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.ticket_types tt WHERE tt.event_id = e.id AND tt.code = 'VIPTABLE'
  );

