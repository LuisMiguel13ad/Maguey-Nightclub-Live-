-- Migration: Physical Door Counter Integration
-- This migration adds tables and functionality for physical door counter integration
-- Supports IR beam counters, thermal sensors, WiFi/Bluetooth devices

-- ============================================
-- 1. DOOR_COUNTERS TABLE (Device registration)
-- ============================================
CREATE TABLE IF NOT EXISTS public.door_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text UNIQUE NOT NULL,
  device_name text NOT NULL,
  device_type text NOT NULL, -- 'ir_beam', 'thermal', 'wifi', 'bluetooth'
  location text,
  api_endpoint text,
  api_key text,
  is_active boolean DEFAULT true,
  last_heartbeat timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ============================================
-- 2. PHYSICAL_COUNTS TABLE (Count data)
-- ============================================
CREATE TABLE IF NOT EXISTS public.physical_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  counter_id uuid REFERENCES public.door_counters(id) ON DELETE CASCADE,
  count_time timestamp with time zone NOT NULL,
  entry_count integer NOT NULL DEFAULT 0,
  exit_count integer NOT NULL DEFAULT 0,
  net_count integer GENERATED ALWAYS AS (entry_count - exit_count) STORED,
  created_at timestamp with time zone DEFAULT now()
);

-- ============================================
-- 3. COUNT_DISCREPANCIES TABLE (Reconciliation)
-- ============================================
CREATE TABLE IF NOT EXISTS public.count_discrepancies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  check_time timestamp with time zone NOT NULL,
  physical_count integer NOT NULL,
  digital_count integer NOT NULL,
  discrepancy integer GENERATED ALWAYS AS (physical_count - digital_count) STORED,
  status text DEFAULT 'pending', -- 'pending', 'investigating', 'resolved', 'ignored'
  resolution_notes text,
  resolved_by uuid REFERENCES auth.users(id),
  resolved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- ============================================
-- 4. INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_physical_counts_time ON public.physical_counts(count_time DESC);
CREATE INDEX IF NOT EXISTS idx_physical_counts_counter ON public.physical_counts(counter_id, count_time DESC);
CREATE INDEX IF NOT EXISTS idx_discrepancies_event_time ON public.count_discrepancies(event_id, check_time DESC);
CREATE INDEX IF NOT EXISTS idx_discrepancies_status ON public.count_discrepancies(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_door_counters_active ON public.door_counters(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_door_counters_device_id ON public.door_counters(device_id);

-- ============================================
-- 5. ROW LEVEL SECURITY POLICIES
-- ============================================
ALTER TABLE public.door_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.physical_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.count_discrepancies ENABLE ROW LEVEL SECURITY;

-- Staff can view all door counters
CREATE POLICY "Staff can view door counters"
  ON public.door_counters
  FOR SELECT
  TO authenticated
  USING (true);

-- Staff can manage door counters
CREATE POLICY "Staff can manage door counters"
  ON public.door_counters
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Staff can view all physical counts
CREATE POLICY "Staff can view physical counts"
  ON public.physical_counts
  FOR SELECT
  TO authenticated
  USING (true);

-- Service role can insert physical counts (for API ingestion)
CREATE POLICY "Service can insert physical counts"
  ON public.physical_counts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Staff can view all discrepancies
CREATE POLICY "Staff can view discrepancies"
  ON public.count_discrepancies
  FOR SELECT
  TO authenticated
  USING (true);

-- Staff can update discrepancies
CREATE POLICY "Staff can update discrepancies"
  ON public.count_discrepancies
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Staff can insert discrepancies
CREATE POLICY "Staff can insert discrepancies"
  ON public.count_discrepancies
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================
-- 6. FUNCTIONS FOR DATA RECONCILIATION
-- ============================================

-- Function to get unified capacity (physical + digital)
CREATE OR REPLACE FUNCTION public.get_unified_capacity(
  event_id_param uuid,
  check_time_param timestamp with time zone DEFAULT now()
)
RETURNS TABLE (
  event_id uuid,
  event_name text,
  physical_count integer,
  digital_count integer,
  unified_count integer,
  discrepancy integer,
  last_physical_update timestamp with time zone,
  last_digital_update timestamp with time zone
) AS $$
BEGIN
  RETURN QUERY
  WITH physical_total AS (
    SELECT 
      COALESCE(SUM(pc.net_count), 0)::integer as total
    FROM public.physical_counts pc
    INNER JOIN public.door_counters dc ON pc.counter_id = dc.id
    WHERE dc.is_active = true
      AND pc.count_time <= check_time_param
  ),
  digital_total AS (
    SELECT 
      COUNT(*)::integer as total
    FROM public.tickets t
    WHERE t.is_used = true
      AND t.scanned_at IS NOT NULL
      AND t.scanned_at <= check_time_param
      AND EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = event_id_param
        AND e.name = t.event_name
      )
  ),
  last_physical AS (
    SELECT MAX(pc.count_time) as last_update
    FROM public.physical_counts pc
    INNER JOIN public.door_counters dc ON pc.counter_id = dc.id
    WHERE dc.is_active = true
  ),
  last_digital AS (
    SELECT MAX(t.scanned_at) as last_update
    FROM public.tickets t
    WHERE t.is_used = true
      AND t.scanned_at IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.events e
        WHERE e.id = event_id_param
        AND e.name = t.event_name
      )
  )
  SELECT 
    e.id as event_id,
    e.name as event_name,
    pt.total as physical_count,
    dt.total as digital_count,
    (pt.total + dt.total)::integer as unified_count,
    (pt.total - dt.total)::integer as discrepancy,
    lp.last_update as last_physical_update,
    ld.last_update as last_digital_update
  FROM public.events e
  CROSS JOIN physical_total pt
  CROSS JOIN digital_total dt
  LEFT JOIN last_physical lp ON true
  LEFT JOIN last_digital ld ON true
  WHERE e.id = event_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to detect and log discrepancies
CREATE OR REPLACE FUNCTION public.detect_count_discrepancy(
  event_id_param uuid,
  threshold_param integer DEFAULT 5
)
RETURNS uuid AS $$
DECLARE
  discrepancy_id uuid;
  physical_count_val integer;
  digital_count_val integer;
  discrepancy_val integer;
BEGIN
  -- Get current counts
  SELECT 
    COALESCE(SUM(pc.net_count), 0)::integer,
    (
      SELECT COUNT(*)::integer
      FROM public.tickets t
      WHERE t.is_used = true
        AND t.scanned_at IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.events e
          WHERE e.id = event_id_param
          AND e.name = t.event_name
        )
    )
  INTO physical_count_val, digital_count_val
  FROM public.physical_counts pc
  INNER JOIN public.door_counters dc ON pc.counter_id = dc.id
  WHERE dc.is_active = true;

  discrepancy_val := physical_count_val - digital_count_val;

  -- Only create discrepancy if it exceeds threshold
  IF ABS(discrepancy_val) >= threshold_param THEN
    INSERT INTO public.count_discrepancies (
      event_id,
      check_time,
      physical_count,
      digital_count,
      status
    ) VALUES (
      event_id_param,
      now(),
      physical_count_val,
      digital_count_val,
      'pending'
    )
    RETURNING id INTO discrepancy_id;
    
    RETURN discrepancy_id;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get device health status
CREATE OR REPLACE FUNCTION public.get_counter_health_status(
  counter_id_param uuid
)
RETURNS TABLE (
  counter_id uuid,
  device_name text,
  is_online boolean,
  minutes_since_heartbeat integer,
  health_status text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dc.id as counter_id,
    dc.device_name,
    CASE 
      WHEN dc.last_heartbeat IS NULL THEN false
      WHEN dc.last_heartbeat > now() - INTERVAL '5 minutes' THEN true
      ELSE false
    END as is_online,
    CASE 
      WHEN dc.last_heartbeat IS NULL THEN NULL
      ELSE EXTRACT(EPOCH FROM (now() - dc.last_heartbeat))::integer / 60
    END as minutes_since_heartbeat,
    CASE
      WHEN dc.last_heartbeat IS NULL THEN 'unknown'
      WHEN dc.last_heartbeat > now() - INTERVAL '5 minutes' THEN 'healthy'
      WHEN dc.last_heartbeat > now() - INTERVAL '15 minutes' THEN 'warning'
      ELSE 'critical'
    END as health_status
  FROM public.door_counters dc
  WHERE dc.id = counter_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE public.door_counters IS 'Physical door counter devices (IR beam, thermal, WiFi, Bluetooth)';
COMMENT ON TABLE public.physical_counts IS 'Entry/exit counts from physical door counters';
COMMENT ON TABLE public.count_discrepancies IS 'Discrepancies between physical and digital counts';
COMMENT ON FUNCTION public.get_unified_capacity IS 'Returns unified capacity combining physical and digital counts';
COMMENT ON FUNCTION public.detect_count_discrepancy IS 'Detects and logs discrepancies between physical and digital counts';
COMMENT ON FUNCTION public.get_counter_health_status IS 'Returns health status for a door counter device';

