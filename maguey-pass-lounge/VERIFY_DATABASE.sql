-- Database Verification Queries
-- Run these in Supabase SQL Editor after running migrations

-- 1. Verify tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('events', 'orders', 'tickets', 'payments')
ORDER BY table_name;

-- 2. Verify events have image_url
SELECT id, name, image_url, date, time 
FROM events 
ORDER BY date;

-- 3. Verify tickets table has event_id column
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'tickets' 
AND column_name IN ('event_id', 'ticket_id', 'order_id')
ORDER BY column_name;

-- 4. Verify scanner view exists and works
SELECT * FROM ticket_scan_view LIMIT 1;

-- 5. Check event count (should be 3)
SELECT COUNT(*) as event_count FROM events;

-- 6. Verify all events have images
SELECT id, name, 
       CASE 
         WHEN image_url IS NULL OR image_url = '' THEN '❌ Missing'
         ELSE '✅ Present'
       END as image_status
FROM events;

-- 7. Verify foreign key relationship
SELECT 
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name = 'tickets';

