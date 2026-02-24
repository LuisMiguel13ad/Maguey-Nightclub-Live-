-- Migration: Add table positioning for drag-and-drop floor plan
-- Adds position_x and position_y columns to event_vip_tables with logical coordinate system

-- Add position columns (nullable for existing tables)
ALTER TABLE event_vip_tables
ADD COLUMN IF NOT EXISTS position_x INTEGER,
ADD COLUMN IF NOT EXISTS position_y INTEGER;

-- Backfill existing tables with default grid positions
-- Coordinate system: 1000x700 logical units (not pixels)
-- This matches percentage-based CSS layout

-- Tables 1, 2, 3 (left wing - premium)
UPDATE event_vip_tables
SET position_x = 50, position_y = 100
WHERE table_number = 1 AND (position_x IS NULL OR position_y IS NULL);

UPDATE event_vip_tables
SET position_x = 50, position_y = 250
WHERE table_number = 2 AND (position_x IS NULL OR position_y IS NULL);

UPDATE event_vip_tables
SET position_x = 50, position_y = 400
WHERE table_number = 3 AND (position_x IS NULL OR position_y IS NULL);

-- Tables 4, 5, 6, 7 (front row)
UPDATE event_vip_tables
SET position_x = 250, position_y = 100
WHERE table_number = 4 AND (position_x IS NULL OR position_y IS NULL);

UPDATE event_vip_tables
SET position_x = 400, position_y = 100
WHERE table_number = 5 AND (position_x IS NULL OR position_y IS NULL);

UPDATE event_vip_tables
SET position_x = 550, position_y = 100
WHERE table_number = 6 AND (position_x IS NULL OR position_y IS NULL);

UPDATE event_vip_tables
SET position_x = 700, position_y = 100
WHERE table_number = 7 AND (position_x IS NULL OR position_y IS NULL);

-- Table 8 (right wing - premium)
UPDATE event_vip_tables
SET position_x = 900, position_y = 100
WHERE table_number = 8 AND (position_x IS NULL OR position_y IS NULL);

-- Tables 9-14 (standard top row)
UPDATE event_vip_tables
SET position_x = 200, position_y = 350
WHERE table_number = 9 AND (position_x IS NULL OR position_y IS NULL);

UPDATE event_vip_tables
SET position_x = 350, position_y = 350
WHERE table_number = 10 AND (position_x IS NULL OR position_y IS NULL);

UPDATE event_vip_tables
SET position_x = 500, position_y = 350
WHERE table_number = 11 AND (position_x IS NULL OR position_y IS NULL);

UPDATE event_vip_tables
SET position_x = 650, position_y = 350
WHERE table_number = 12 AND (position_x IS NULL OR position_y IS NULL);

UPDATE event_vip_tables
SET position_x = 800, position_y = 350
WHERE table_number = 13 AND (position_x IS NULL OR position_y IS NULL);

UPDATE event_vip_tables
SET position_x = 950, position_y = 350
WHERE table_number = 14 AND (position_x IS NULL OR position_y IS NULL);

-- Tables 15-20 (standard bottom row)
UPDATE event_vip_tables
SET position_x = 200, position_y = 500
WHERE table_number = 15 AND (position_x IS NULL OR position_y IS NULL);

UPDATE event_vip_tables
SET position_x = 350, position_y = 500
WHERE table_number = 16 AND (position_x IS NULL OR position_y IS NULL);

UPDATE event_vip_tables
SET position_x = 500, position_y = 500
WHERE table_number = 17 AND (position_x IS NULL OR position_y IS NULL);

UPDATE event_vip_tables
SET position_x = 650, position_y = 500
WHERE table_number = 18 AND (position_x IS NULL OR position_y IS NULL);

UPDATE event_vip_tables
SET position_x = 800, position_y = 500
WHERE table_number = 19 AND (position_x IS NULL OR position_y IS NULL);

UPDATE event_vip_tables
SET position_x = 950, position_y = 500
WHERE table_number = 20 AND (position_x IS NULL OR position_y IS NULL);

-- Tables 21-26 (standard bottom row 4)
UPDATE event_vip_tables
SET position_x = 200, position_y = 600
WHERE table_number = 21 AND (position_x IS NULL OR position_y IS NULL);

UPDATE event_vip_tables
SET position_x = 350, position_y = 600
WHERE table_number = 22 AND (position_x IS NULL OR position_y IS NULL);

UPDATE event_vip_tables
SET position_x = 500, position_y = 600
WHERE table_number = 23 AND (position_x IS NULL OR position_y IS NULL);

UPDATE event_vip_tables
SET position_x = 650, position_y = 600
WHERE table_number = 24 AND (position_x IS NULL OR position_y IS NULL);

UPDATE event_vip_tables
SET position_x = 800, position_y = 600
WHERE table_number = 25 AND (position_x IS NULL OR position_y IS NULL);

UPDATE event_vip_tables
SET position_x = 950, position_y = 600
WHERE table_number = 26 AND (position_x IS NULL OR position_y IS NULL);

-- Add comment for documentation
COMMENT ON COLUMN event_vip_tables.position_x IS 'Logical X coordinate (0-1000) for floor plan positioning';
COMMENT ON COLUMN event_vip_tables.position_y IS 'Logical Y coordinate (0-700) for floor plan positioning';
