-- Migration: Scan Speed Metrics
-- Adds scan duration tracking and metrics tables for operational insight

-- ============================================
-- 1. ADD scan_duration_ms TO scan_logs
-- ============================================
ALTER TABLE public.scan_logs
  ADD COLUMN IF NOT EXISTS scan_duration_ms INTEGER;

-- ============================================
-- 2. CREATE scan_metrics TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.scan_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  scans_count INTEGER NOT NULL DEFAULT 0,
  avg_duration_ms INTEGER,
  peak_rate DECIMAL(10,2), -- scans per minute
  period_start timestamp with time zone NOT NULL,
  period_end timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb -- Additional metrics data
);

-- ============================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_scan_logs_user_scanned_at 
  ON public.scan_logs(scanned_by, scanned_at);

CREATE INDEX IF NOT EXISTS idx_scan_logs_scanned_at 
  ON public.scan_logs(scanned_at);

CREATE INDEX IF NOT EXISTS idx_scan_logs_duration 
  ON public.scan_logs(scan_duration_ms) 
  WHERE scan_duration_ms IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scan_metrics_user_id 
  ON public.scan_metrics(user_id);

CREATE INDEX IF NOT EXISTS idx_scan_metrics_event_id 
  ON public.scan_metrics(event_id);

CREATE INDEX IF NOT EXISTS idx_scan_metrics_period 
  ON public.scan_metrics(period_start, period_end);

-- ============================================
-- 4. ROW LEVEL SECURITY POLICIES
-- ============================================
ALTER TABLE public.scan_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all scan metrics"
  ON public.scan_metrics FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can insert scan metrics"
  ON public.scan_metrics FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Staff can update scan metrics"
  ON public.scan_metrics FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 5. FUNCTION: Calculate scan rate (scans per minute)
-- ============================================
CREATE OR REPLACE FUNCTION public.calculate_scan_rate(
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  user_id_param uuid DEFAULT NULL,
  event_id_param uuid DEFAULT NULL
)
RETURNS DECIMAL(10,2) AS $$
DECLARE
  scan_count INTEGER;
  time_diff_minutes DECIMAL;
  rate DECIMAL(10,2);
BEGIN
  -- Calculate time difference in minutes
  time_diff_minutes := EXTRACT(EPOCH FROM (end_time - start_time)) / 60.0;
  
  IF time_diff_minutes <= 0 THEN
    RETURN 0;
  END IF;
  
  -- Count scans in the time period
  SELECT COUNT(*) INTO scan_count
  FROM public.scan_logs
  WHERE scanned_at >= start_time 
    AND scanned_at <= end_time
    AND (user_id_param IS NULL OR scanned_by = user_id_param)
    AND scan_result IN ('valid', 'scanned');
  
  -- Calculate rate (scans per minute)
  rate := scan_count / time_diff_minutes;
  
  RETURN rate;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. FUNCTION: Get scanner performance stats
-- ============================================
CREATE OR REPLACE FUNCTION public.get_scanner_performance(
  user_id_param uuid DEFAULT NULL,
  event_id_param uuid DEFAULT NULL,
  start_time timestamp with time zone DEFAULT NULL,
  end_time timestamp with time zone DEFAULT NULL
)
RETURNS TABLE (
  user_id uuid,
  user_email text,
  total_scans bigint,
  valid_scans bigint,
  invalid_scans bigint,
  avg_duration_ms numeric,
  fastest_scan_ms integer,
  slowest_scan_ms integer,
  scans_per_minute numeric,
  error_rate numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sl.scanned_by as user_id,
    au.email::text as user_email,
    COUNT(*)::bigint as total_scans,
    COUNT(*) FILTER (WHERE sl.scan_result IN ('valid', 'scanned'))::bigint as valid_scans,
    COUNT(*) FILTER (WHERE sl.scan_result = 'invalid')::bigint as invalid_scans,
    AVG(sl.scan_duration_ms)::numeric as avg_duration_ms,
    MIN(sl.scan_duration_ms)::integer as fastest_scan_ms,
    MAX(sl.scan_duration_ms)::integer as slowest_scan_ms,
    CASE 
      WHEN (COALESCE(end_time, NOW()) - COALESCE(start_time, MIN(sl.scanned_at))) > INTERVAL '0' 
      THEN COUNT(*)::numeric / EXTRACT(EPOCH FROM (COALESCE(end_time, NOW()) - COALESCE(start_time, MIN(sl.scanned_at)))) * 60
      ELSE 0
    END as scans_per_minute,
    CASE 
      WHEN COUNT(*) > 0 
      THEN (COUNT(*) FILTER (WHERE sl.scan_result = 'invalid')::numeric / COUNT(*)::numeric) * 100
      ELSE 0
    END as error_rate
  FROM public.scan_logs sl
  LEFT JOIN auth.users au ON au.id = sl.scanned_by
  WHERE 
    (user_id_param IS NULL OR sl.scanned_by = user_id_param)
    AND (event_id_param IS NULL OR EXISTS (
      SELECT 1 FROM public.tickets t 
      WHERE t.id = sl.ticket_id 
      AND t.event_id = event_id_param
    ))
    AND (start_time IS NULL OR sl.scanned_at >= start_time)
    AND (end_time IS NULL OR sl.scanned_at <= end_time)
  GROUP BY sl.scanned_by, au.email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. FUNCTION: Get scan rate over time (for charts)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_scan_rate_over_time(
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  interval_minutes INTEGER DEFAULT 15,
  user_id_param uuid DEFAULT NULL,
  event_id_param uuid DEFAULT NULL
)
RETURNS TABLE (
  period_start timestamp with time zone,
  period_end timestamp with time zone,
  scans_count bigint,
  scans_per_minute numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH time_buckets AS (
    SELECT 
      generate_series(
        date_trunc('minute', start_time),
        end_time,
        (interval_minutes || ' minutes')::interval
      ) AS bucket_start
  )
  SELECT 
    tb.bucket_start as period_start,
    tb.bucket_start + (interval_minutes || ' minutes')::interval as period_end,
    COUNT(sl.id)::bigint as scans_count,
    CASE 
      WHEN interval_minutes > 0 
      THEN COUNT(sl.id)::numeric / interval_minutes
      ELSE 0
    END as scans_per_minute
  FROM time_buckets tb
  LEFT JOIN public.scan_logs sl ON 
    sl.scanned_at >= tb.bucket_start 
    AND sl.scanned_at < tb.bucket_start + (interval_minutes || ' minutes')::interval
    AND sl.scan_result IN ('valid', 'scanned')
    AND (user_id_param IS NULL OR sl.scanned_by = user_id_param)
    AND (event_id_param IS NULL OR EXISTS (
      SELECT 1 FROM public.tickets t 
      WHERE t.id = sl.ticket_id 
      AND t.event_id = event_id_param
    ))
  GROUP BY tb.bucket_start
  ORDER BY tb.bucket_start;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON COLUMN public.scan_logs.scan_duration_ms IS 'Time in milliseconds from scan start to completion';
COMMENT ON TABLE public.scan_metrics IS 'Aggregated scan performance metrics by user and time period';
COMMENT ON FUNCTION public.calculate_scan_rate IS 'Calculates scans per minute for a given time period';
COMMENT ON FUNCTION public.get_scanner_performance IS 'Returns performance statistics for scanners';
COMMENT ON FUNCTION public.get_scan_rate_over_time IS 'Returns scan rate data over time for charting';

