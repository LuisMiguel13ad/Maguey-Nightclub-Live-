-- Migration: backfill price_cents for legacy event_vip_tables rows
-- Bug 1 (HIGH): price_cents = NULL on rows inserted before the price_cents column was added
-- allows Edge Function fallback to client-supplied price — a price tamperability vector.

-- Step 1: Backfill price_cents from the legacy price DECIMAL(10,2) column
UPDATE event_vip_tables
SET price_cents = ROUND(price * 100)::INTEGER
WHERE price_cents IS NULL
  AND price IS NOT NULL;

-- Step 2: Enforce NOT NULL going forward so no future row can have price_cents = NULL
ALTER TABLE event_vip_tables
  ALTER COLUMN price_cents SET NOT NULL;
