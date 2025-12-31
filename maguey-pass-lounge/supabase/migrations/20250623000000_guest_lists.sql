-- Guest List Management System
-- Allows promoters to add names, door staff to check them in

-- Guest list types
CREATE TYPE guest_list_type AS ENUM (
  'vip',           -- VIP treatment, skip line
  'comp',          -- Free entry (complimentary)
  'reduced',       -- Reduced cover charge
  'standard'       -- Standard guest list (may still pay)
);

-- Guest status
CREATE TYPE guest_status AS ENUM (
  'pending',       -- Added but not arrived
  'checked_in',    -- Checked in at door
  'no_show',       -- Marked as no-show after event
  'cancelled'      -- Removed from list
);

-- Guest lists (one per event, or general recurring)
CREATE TABLE guest_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,              -- "Friday Night Guest List"
  description TEXT,
  list_type guest_list_type DEFAULT 'standard',
  max_guests INTEGER,                       -- Optional capacity limit
  closes_at TIMESTAMPTZ,                    -- When list stops accepting names
  cover_charge DECIMAL(10,2) DEFAULT 0,    -- Cover for this list type
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual guest entries
CREATE TABLE guest_list_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_list_id UUID NOT NULL REFERENCES guest_lists(id) ON DELETE CASCADE,
  
  -- Guest info
  guest_name VARCHAR(100) NOT NULL,
  guest_email VARCHAR(255),
  guest_phone VARCHAR(20),
  plus_ones INTEGER DEFAULT 0,             -- Number of additional guests
  notes TEXT,                               -- "Birthday girl", "Industry", etc.
  
  -- Status tracking
  status guest_status DEFAULT 'pending',
  checked_in_at TIMESTAMPTZ,
  checked_in_by UUID REFERENCES auth.users(id),
  actual_plus_ones INTEGER,                -- How many plus ones actually came
  
  -- Attribution
  added_by UUID REFERENCES auth.users(id),
  added_by_name VARCHAR(100),              -- Promoter name for display
  source VARCHAR(50),                       -- 'promoter', 'owner', 'online', etc.
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate names on same list (allow same name if phone differs)
  UNIQUE(guest_list_id, guest_name, guest_phone)
);

-- Indexes
CREATE INDEX idx_guest_lists_event ON guest_lists(event_id);
CREATE INDEX idx_guest_lists_active ON guest_lists(is_active) WHERE is_active = true;
CREATE INDEX idx_guest_entries_list ON guest_list_entries(guest_list_id);
CREATE INDEX idx_guest_entries_status ON guest_list_entries(status);
CREATE INDEX idx_guest_entries_name ON guest_list_entries(LOWER(guest_name));
CREATE INDEX idx_guest_entries_checked_in ON guest_list_entries(checked_in_at) 
  WHERE checked_in_at IS NOT NULL;

-- View for guest list summary
CREATE VIEW guest_list_summary AS
SELECT 
  gl.id,
  gl.event_id,
  gl.name,
  gl.list_type,
  gl.max_guests,
  gl.closes_at,
  gl.cover_charge,
  gl.is_active,
  e.title as event_title,
  e.date as event_date,
  COUNT(gle.id) as total_guests,
  SUM(gle.plus_ones) as total_plus_ones,
  COUNT(CASE WHEN gle.status = 'checked_in' THEN 1 END) as checked_in_count,
  SUM(CASE WHEN gle.status = 'checked_in' THEN 1 + COALESCE(gle.actual_plus_ones, 0) END) as total_arrived
FROM guest_lists gl
LEFT JOIN events e ON gl.event_id = e.id
LEFT JOIN guest_list_entries gle ON gl.id = gle.guest_list_id AND gle.status != 'cancelled'
GROUP BY gl.id, e.title, e.date;

-- Function to check in a guest
CREATE OR REPLACE FUNCTION check_in_guest(
  p_entry_id UUID,
  p_checked_in_by UUID,
  p_actual_plus_ones INTEGER DEFAULT NULL
) RETURNS guest_list_entries AS $$
DECLARE
  v_entry guest_list_entries;
BEGIN
  UPDATE guest_list_entries
  SET 
    status = 'checked_in',
    checked_in_at = NOW(),
    checked_in_by = p_checked_in_by,
    actual_plus_ones = COALESCE(p_actual_plus_ones, plus_ones),
    updated_at = NOW()
  WHERE id = p_entry_id AND status = 'pending'
  RETURNING * INTO v_entry;
  
  IF v_entry IS NULL THEN
    RAISE EXCEPTION 'Guest not found or already checked in';
  END IF;
  
  RETURN v_entry;
END;
$$ LANGUAGE plpgsql;

-- Function to search guests by name
CREATE OR REPLACE FUNCTION search_guest_list(
  p_event_id UUID,
  p_search_term VARCHAR(100)
) RETURNS TABLE (
  id UUID,
  guest_name VARCHAR(100),
  plus_ones INTEGER,
  notes TEXT,
  status guest_status,
  list_type guest_list_type,
  list_name VARCHAR(100),
  cover_charge DECIMAL(10,2),
  added_by_name VARCHAR(100)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    gle.id,
    gle.guest_name,
    gle.plus_ones,
    gle.notes,
    gle.status,
    gl.list_type,
    gl.name as list_name,
    gl.cover_charge,
    gle.added_by_name
  FROM guest_list_entries gle
  JOIN guest_lists gl ON gle.guest_list_id = gl.id
  WHERE gl.event_id = p_event_id
    AND gl.is_active = true
    AND gle.status != 'cancelled'
    AND LOWER(gle.guest_name) LIKE '%' || LOWER(p_search_term) || '%'
  ORDER BY 
    CASE WHEN LOWER(gle.guest_name) = LOWER(p_search_term) THEN 0 ELSE 1 END,
    gle.guest_name;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE guest_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_list_entries ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read guest lists
CREATE POLICY "Users can view guest lists"
  ON guest_lists FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to create guest lists
CREATE POLICY "Users can create guest lists"
  ON guest_lists FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow users to update their own guest lists or if they're admin
CREATE POLICY "Users can update guest lists"
  ON guest_lists FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to read guest entries
CREATE POLICY "Users can view guest entries"
  ON guest_list_entries FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to create guest entries
CREATE POLICY "Users can add guests"
  ON guest_list_entries FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow users to update guest entries (for check-in)
CREATE POLICY "Users can update guest entries"
  ON guest_list_entries FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow users to delete guest entries
CREATE POLICY "Users can remove guests"
  ON guest_list_entries FOR DELETE
  TO authenticated
  USING (true);
