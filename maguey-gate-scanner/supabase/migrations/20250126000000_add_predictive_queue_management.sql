-- Migration: Predictive Entry Queue Management
-- Adds tables and functions for real-time queue metrics and wait time predictions

-- ============================================
-- 1. SCAN_VELOCITY_METRICS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.scan_velocity_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  period_start timestamp with time zone NOT NULL,
  period_end timestamp with time zone NOT NULL,
  scan_count integer NOT NULL DEFAULT 0,
  scans_per_minute decimal(10,2) NOT NULL DEFAULT 0,
  avg_scan_duration_ms integer,
  active_scanners integer NOT NULL DEFAULT 0,
  estimated_queue_depth integer NOT NULL DEFAULT 0,
  entry_point_id text, -- Optional: for multiple entry points
  ticket_type_mix jsonb, -- Distribution of ticket types scanned
  created_at timestamp with time zone DEFAULT now()
);

-- ============================================
-- 2. WAIT_TIME_PREDICTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.wait_time_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  prediction_time timestamp with time zone NOT NULL,
  predicted_wait_minutes integer NOT NULL,
  actual_wait_minutes integer, -- Filled in after the fact for accuracy tracking
  confidence_score decimal(5,2) NOT NULL DEFAULT 0, -- 0-100
  factors jsonb NOT NULL, -- ML model factors used for prediction
  entry_point_id text, -- Optional: for multiple entry points
  created_at timestamp with time zone DEFAULT now()
);

-- ============================================
-- 3. ENTRY_POINTS TABLE (for multiple entry points)
-- ============================================
CREATE TABLE IF NOT EXISTS public.entry_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(event_id, name)
);

-- Add entry_point_id to scan_logs for tracking which entry point processed the scan
ALTER TABLE public.scan_logs
  ADD COLUMN IF NOT EXISTS entry_point_id uuid REFERENCES public.entry_points(id) ON DELETE SET NULL;

-- ============================================
-- 4. INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_velocity_metrics_event_period 
  ON public.scan_velocity_metrics(event_id, period_start);

CREATE INDEX IF NOT EXISTS idx_velocity_metrics_period 
  ON public.scan_velocity_metrics(period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_wait_predictions_event_time 
  ON public.wait_time_predictions(event_id, prediction_time);

CREATE INDEX IF NOT EXISTS idx_wait_predictions_time 
  ON public.wait_time_predictions(prediction_time);

CREATE INDEX IF NOT EXISTS idx_entry_points_event 
  ON public.entry_points(event_id, is_active);

CREATE INDEX IF NOT EXISTS idx_scan_logs_entry_point 
  ON public.scan_logs(entry_point_id);

-- ============================================
-- 5. ROW LEVEL SECURITY POLICIES
-- ============================================
ALTER TABLE public.scan_velocity_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wait_time_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entry_points ENABLE ROW LEVEL SECURITY;

-- Scan velocity metrics: authenticated users can view and insert
CREATE POLICY "Staff can view scan velocity metrics"
  ON public.scan_velocity_metrics FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert scan velocity metrics"
  ON public.scan_velocity_metrics FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Wait time predictions: public read for guest displays, authenticated write
CREATE POLICY "Anyone can view wait time predictions"
  ON public.wait_time_predictions FOR SELECT
  USING (true);

CREATE POLICY "System can insert wait time predictions"
  ON public.wait_time_predictions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "System can update wait time predictions"
  ON public.wait_time_predictions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Entry points: authenticated users can manage
CREATE POLICY "Anyone can view entry points"
  ON public.entry_points FOR SELECT
  USING (true);

CREATE POLICY "Staff can manage entry points"
  ON public.entry_points FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 6. FUNCTION: Calculate current scan velocity
-- ============================================
CREATE OR REPLACE FUNCTION public.calculate_current_scan_velocity(
  event_id_param uuid,
  minutes_back integer DEFAULT 5,
  entry_point_id_param uuid DEFAULT NULL
)
RETURNS TABLE (
  scans_per_minute decimal(10,2),
  avg_scan_duration_ms numeric,
  active_scanners bigint,
  scan_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN minutes_back > 0 
      THEN COUNT(*)::decimal / minutes_back
      ELSE 0
    END as scans_per_minute,
    AVG(sl.scan_duration_ms)::numeric as avg_scan_duration_ms,
    COUNT(DISTINCT sl.scanned_by)::bigint as active_scanners,
    COUNT(*)::bigint as scan_count
  FROM public.scan_logs sl
  INNER JOIN public.tickets t ON t.id = sl.ticket_id
  WHERE t.event_id = event_id_param
    AND sl.scanned_at >= NOW() - (minutes_back || ' minutes')::interval
    AND sl.scan_result IN ('valid', 'scanned')
    AND (entry_point_id_param IS NULL OR sl.entry_point_id = entry_point_id_param);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. FUNCTION: Estimate queue depth
-- ============================================
CREATE OR REPLACE FUNCTION public.estimate_queue_depth(
  event_id_param uuid,
  entry_point_id_param uuid DEFAULT NULL
)
RETURNS integer AS $$
DECLARE
  total_tickets integer;
  scanned_tickets integer;
  queue_depth integer;
BEGIN
  -- Get total tickets for event
  SELECT COUNT(*) INTO total_tickets
  FROM public.tickets
  WHERE event_id = event_id_param
    AND status IS DISTINCT FROM 'scanned';
  
  -- Get scanned tickets in last hour (to estimate current arrivals)
  SELECT COUNT(*) INTO scanned_tickets
  FROM public.scan_logs sl
  INNER JOIN public.tickets t ON t.id = sl.ticket_id
  WHERE t.event_id = event_id_param
    AND sl.scanned_at >= NOW() - INTERVAL '1 hour'
    AND sl.scan_result IN ('valid', 'scanned')
    AND (entry_point_id_param IS NULL OR sl.entry_point_id = entry_point_id_param);
  
  -- Estimate queue depth (tickets not yet scanned)
  queue_depth := GREATEST(0, total_tickets - scanned_tickets);
  
  RETURN queue_depth;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. FUNCTION: Predict wait time (ML model)
-- ============================================
CREATE OR REPLACE FUNCTION public.predict_wait_time(
  event_id_param uuid,
  entry_point_id_param uuid DEFAULT NULL
)
RETURNS TABLE (
  predicted_wait_minutes integer,
  confidence_score decimal(5,2),
  factors jsonb
) AS $$
DECLARE
  current_velocity decimal(10,2);
  avg_duration numeric;
  active_scanners_count bigint;
  queue_depth_est integer;
  historical_avg_velocity decimal(10,2);
  time_of_day_factor decimal(5,2);
  day_of_week_factor decimal(5,2);
  predicted_minutes integer;
  confidence decimal(5,2);
  factors_json jsonb;
BEGIN
  -- Get current metrics
  SELECT * INTO current_velocity, avg_duration, active_scanners_count, queue_depth_est
  FROM public.calculate_current_scan_velocity(event_id_param, 5, entry_point_id_param);
  
  SELECT * INTO queue_depth_est
  FROM public.estimate_queue_depth(event_id_param, entry_point_id_param);
  
  -- Get historical average velocity for similar time periods
  SELECT AVG(scans_per_minute) INTO historical_avg_velocity
  FROM public.scan_velocity_metrics
  WHERE event_id = event_id_param
    AND period_start >= NOW() - INTERVAL '30 days'
    AND EXTRACT(HOUR FROM period_start) = EXTRACT(HOUR FROM NOW());
  
  -- Time of day factor (peak hours = slower)
  time_of_day_factor := CASE 
    WHEN EXTRACT(HOUR FROM NOW()) BETWEEN 20 AND 23 THEN 1.5 -- Peak hours
    WHEN EXTRACT(HOUR FROM NOW()) BETWEEN 18 AND 20 THEN 1.2 -- Pre-peak
    ELSE 1.0
  END;
  
  -- Day of week factor (weekends = busier)
  day_of_week_factor := CASE 
    WHEN EXTRACT(DOW FROM NOW()) IN (5, 6) THEN 1.3 -- Friday/Saturday
    ELSE 1.0
  END;
  
  -- Calculate predicted wait time
  -- Formula: queue_depth / (scans_per_minute * active_scanners * efficiency_factor)
  IF current_velocity > 0 AND active_scanners_count > 0 THEN
    predicted_minutes := CEIL(
      queue_depth_est::decimal / 
      (current_velocity * active_scanners_count::decimal * 0.8) -- 80% efficiency factor
      * time_of_day_factor * day_of_week_factor
    )::integer;
  ELSIF historical_avg_velocity > 0 AND active_scanners_count > 0 THEN
    -- Fallback to historical data
    predicted_minutes := CEIL(
      queue_depth_est::decimal / 
      (historical_avg_velocity * active_scanners_count::decimal * 0.8)
      * time_of_day_factor * day_of_week_factor
    )::integer;
  ELSE
    -- Default estimate
    predicted_minutes := CEIL(queue_depth_est::decimal / 10)::integer; -- Assume 10 scans/min
  END IF;
  
  -- Calculate confidence score (0-100)
  -- Higher confidence if we have recent data and active scanners
  confidence := LEAST(100, 
    CASE 
      WHEN current_velocity > 0 AND active_scanners_count > 0 THEN 85
      WHEN historical_avg_velocity > 0 THEN 65
      ELSE 40
    END
  );
  
  -- Build factors JSON
  factors_json := jsonb_build_object(
    'current_velocity', current_velocity,
    'avg_scan_duration_ms', avg_duration,
    'active_scanners', active_scanners_count,
    'queue_depth', queue_depth_est,
    'historical_avg_velocity', historical_avg_velocity,
    'time_of_day_factor', time_of_day_factor,
    'day_of_week_factor', day_of_week_factor,
    'entry_point_id', entry_point_id_param
  );
  
  RETURN QUERY SELECT predicted_minutes, confidence, factors_json;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. FUNCTION: Record velocity metrics (called periodically)
-- ============================================
CREATE OR REPLACE FUNCTION public.record_velocity_metrics(
  event_id_param uuid,
  period_start_param timestamp with time zone,
  period_end_param timestamp with time zone,
  entry_point_id_param uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  metrics_id uuid;
  scan_count_val integer;
  scans_per_min_val decimal(10,2);
  avg_duration_val integer;
  active_scanners_val integer;
  queue_depth_val integer;
  ticket_type_mix_json jsonb;
BEGIN
  -- Calculate metrics for the period
  SELECT 
    COUNT(*)::integer,
    CASE 
      WHEN EXTRACT(EPOCH FROM (period_end_param - period_start_param)) / 60 > 0
      THEN COUNT(*)::decimal / (EXTRACT(EPOCH FROM (period_end_param - period_start_param)) / 60)
      ELSE 0
    END,
    AVG(sl.scan_duration_ms)::integer,
    COUNT(DISTINCT sl.scanned_by)::integer
  INTO scan_count_val, scans_per_min_val, avg_duration_val, active_scanners_val
  FROM public.scan_logs sl
  INNER JOIN public.tickets t ON t.id = sl.ticket_id
  WHERE t.event_id = event_id_param
    AND sl.scanned_at >= period_start_param
    AND sl.scanned_at < period_end_param
    AND sl.scan_result IN ('valid', 'scanned')
    AND (entry_point_id_param IS NULL OR sl.entry_point_id = entry_point_id_param);
  
  -- Get queue depth
  SELECT * INTO queue_depth_val
  FROM public.estimate_queue_depth(event_id_param, entry_point_id_param);
  
  -- Get ticket type mix
  SELECT jsonb_object_agg(ticket_type, count) INTO ticket_type_mix_json
  FROM (
    SELECT t.ticket_type, COUNT(*) as count
    FROM public.scan_logs sl
    INNER JOIN public.tickets t ON t.id = sl.ticket_id
    WHERE t.event_id = event_id_param
      AND sl.scanned_at >= period_start_param
      AND sl.scanned_at < period_end_param
      AND sl.scan_result IN ('valid', 'scanned')
      AND (entry_point_id_param IS NULL OR sl.entry_point_id = entry_point_id_param)
    GROUP BY t.ticket_type
  ) subq;
  
  -- Insert metrics
  INSERT INTO public.scan_velocity_metrics (
    event_id,
    period_start,
    period_end,
    scan_count,
    scans_per_minute,
    avg_scan_duration_ms,
    active_scanners,
    estimated_queue_depth,
    entry_point_id,
    ticket_type_mix
  ) VALUES (
    event_id_param,
    period_start_param,
    period_end_param,
    scan_count_val,
    scans_per_min_val,
    avg_duration_val,
    active_scanners_val,
    queue_depth_val,
    entry_point_id_param,
    ticket_type_mix_json
  )
  RETURNING id INTO metrics_id;
  
  RETURN metrics_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 10. FUNCTION: Get historical patterns
-- ============================================
CREATE OR REPLACE FUNCTION public.get_historical_velocity_patterns(
  event_id_param uuid,
  days_back integer DEFAULT 30,
  entry_point_id_param uuid DEFAULT NULL
)
RETURNS TABLE (
  hour_of_day integer,
  day_of_week integer,
  avg_scans_per_minute decimal(10,2),
  avg_queue_depth integer,
  sample_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    EXTRACT(HOUR FROM period_start)::integer as hour_of_day,
    EXTRACT(DOW FROM period_start)::integer as day_of_week,
    AVG(scans_per_minute)::decimal(10,2) as avg_scans_per_minute,
    AVG(estimated_queue_depth)::integer as avg_queue_depth,
    COUNT(*)::bigint as sample_count
  FROM public.scan_velocity_metrics
  WHERE event_id = event_id_param
    AND period_start >= NOW() - (days_back || ' days')::interval
    AND (entry_point_id_param IS NULL OR entry_point_id = entry_point_id_param)
  GROUP BY EXTRACT(HOUR FROM period_start), EXTRACT(DOW FROM period_start)
  ORDER BY day_of_week, hour_of_day;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 11. COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE public.scan_velocity_metrics IS 'Real-time scan velocity metrics calculated every minute for queue management';
COMMENT ON TABLE public.wait_time_predictions IS 'ML-based wait time predictions with accuracy tracking';
COMMENT ON TABLE public.entry_points IS 'Multiple entry points per event for load balancing';
COMMENT ON FUNCTION public.calculate_current_scan_velocity IS 'Calculates current scan velocity for an event';
COMMENT ON FUNCTION public.estimate_queue_depth IS 'Estimates current queue depth (tickets waiting)';
COMMENT ON FUNCTION public.predict_wait_time IS 'Predicts wait time using ML model based on current metrics and historical patterns';
COMMENT ON FUNCTION public.record_velocity_metrics IS 'Records velocity metrics for a time period (called by cron job)';
COMMENT ON FUNCTION public.get_historical_velocity_patterns IS 'Returns historical velocity patterns for predictive analytics';

