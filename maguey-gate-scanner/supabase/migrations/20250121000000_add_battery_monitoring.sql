-- Migration: Battery Monitoring and Device Management
-- Adds device tracking, battery monitoring, and device management features

-- ============================================
-- 1. CREATE scanner_devices TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.scanner_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text UNIQUE NOT NULL, -- Unique device identifier (generated client-side)
  device_name text,
  device_model text,
  os_version text,
  app_version text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_seen timestamp with time zone DEFAULT now(),
  battery_level integer CHECK (battery_level >= 0 AND battery_level <= 100),
  is_charging boolean DEFAULT false,
  is_online boolean DEFAULT true,
  storage_used_mb integer,
  storage_total_mb integer,
  network_type text, -- 'wifi', 'cellular', 'offline'
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ============================================
-- 2. CREATE device_battery_logs TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.device_battery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid REFERENCES public.scanner_devices(id) ON DELETE CASCADE,
  battery_level integer CHECK (battery_level >= 0 AND battery_level <= 100),
  is_charging boolean DEFAULT false,
  estimated_time_remaining_minutes integer, -- Estimated minutes until battery empty
  timestamp timestamp with time zone DEFAULT now()
);

-- ============================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_scanner_devices_device_id 
  ON public.scanner_devices(device_id);

CREATE INDEX IF NOT EXISTS idx_scanner_devices_user_id 
  ON public.scanner_devices(user_id);

CREATE INDEX IF NOT EXISTS idx_scanner_devices_last_seen 
  ON public.scanner_devices(last_seen);

CREATE INDEX IF NOT EXISTS idx_scanner_devices_battery_level 
  ON public.scanner_devices(battery_level) 
  WHERE battery_level IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scanner_devices_is_online 
  ON public.scanner_devices(is_online);

CREATE INDEX IF NOT EXISTS idx_device_battery_logs_device_id 
  ON public.device_battery_logs(device_id);

CREATE INDEX IF NOT EXISTS idx_device_battery_logs_timestamp 
  ON public.device_battery_logs(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_device_battery_logs_device_timestamp 
  ON public.device_battery_logs(device_id, timestamp DESC);

-- ============================================
-- 4. ROW LEVEL SECURITY POLICIES
-- ============================================
ALTER TABLE public.scanner_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_battery_logs ENABLE ROW LEVEL SECURITY;

-- Scanner devices: Users can view their own devices, owners can view all
CREATE POLICY "Users can view their own devices"
  ON public.scanner_devices FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() 
      AND raw_user_meta_data->>'role' = 'owner'
    )
  );

-- Users can insert their own device
CREATE POLICY "Users can insert their own device"
  ON public.scanner_devices FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Users can update their own device
CREATE POLICY "Users can update their own device"
  ON public.scanner_devices FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR user_id IS NULL)
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Battery logs: Users can view logs for their devices, owners can view all
CREATE POLICY "Users can view their device battery logs"
  ON public.device_battery_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.scanner_devices sd
      WHERE sd.id = device_battery_logs.device_id
      AND (sd.user_id = auth.uid() OR 
           EXISTS (
             SELECT 1 FROM auth.users 
             WHERE id = auth.uid() 
             AND raw_user_meta_data->>'role' = 'owner'
           ))
    )
  );

-- Users can insert battery logs for their devices
CREATE POLICY "Users can insert battery logs"
  ON public.device_battery_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.scanner_devices sd
      WHERE sd.id = device_battery_logs.device_id
      AND (sd.user_id = auth.uid() OR sd.user_id IS NULL)
    )
  );

-- ============================================
-- 5. FUNCTION: Update device last seen and battery
-- ============================================
CREATE OR REPLACE FUNCTION public.update_device_status(
  p_device_id text,
  p_battery_level integer DEFAULT NULL,
  p_is_charging boolean DEFAULT NULL,
  p_is_online boolean DEFAULT true,
  p_network_type text DEFAULT NULL,
  p_storage_used_mb integer DEFAULT NULL,
  p_storage_total_mb integer DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_device_uuid uuid;
BEGIN
  -- Upsert device record
  INSERT INTO public.scanner_devices (
    device_id,
    battery_level,
    is_charging,
    is_online,
    network_type,
    storage_used_mb,
    storage_total_mb,
    last_seen,
    updated_at
  )
  VALUES (
    p_device_id,
    p_battery_level,
    COALESCE(p_is_charging, false),
    p_is_online,
    p_network_type,
    p_storage_used_mb,
    p_storage_total_mb,
    now(),
    now()
  )
  ON CONFLICT (device_id) 
  DO UPDATE SET
    battery_level = COALESCE(EXCLUDED.battery_level, scanner_devices.battery_level),
    is_charging = COALESCE(EXCLUDED.is_charging, scanner_devices.is_charging),
    is_online = COALESCE(EXCLUDED.is_online, scanner_devices.is_online),
    network_type = COALESCE(EXCLUDED.network_type, scanner_devices.network_type),
    storage_used_mb = COALESCE(EXCLUDED.storage_used_mb, scanner_devices.storage_used_mb),
    storage_total_mb = COALESCE(EXCLUDED.storage_total_mb, scanner_devices.storage_total_mb),
    last_seen = now(),
    updated_at = now()
  RETURNING id INTO v_device_uuid;

  -- Log battery level if provided
  IF p_battery_level IS NOT NULL THEN
    INSERT INTO public.device_battery_logs (
      device_id,
      battery_level,
      is_charging
    )
    VALUES (
      v_device_uuid,
      p_battery_level,
      COALESCE(p_is_charging, false)
    );
  END IF;

  RETURN v_device_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. FUNCTION: Get devices with low battery
-- ============================================
CREATE OR REPLACE FUNCTION public.get_devices_with_low_battery(
  p_threshold integer DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  device_id text,
  device_name text,
  device_model text,
  user_id uuid,
  battery_level integer,
  is_charging boolean,
  last_seen timestamp with time zone,
  is_online boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sd.id,
    sd.device_id,
    sd.device_name,
    sd.device_model,
    sd.user_id,
    sd.battery_level,
    sd.is_charging,
    sd.last_seen,
    sd.is_online
  FROM public.scanner_devices sd
  WHERE sd.battery_level IS NOT NULL
    AND sd.battery_level <= p_threshold
    AND sd.is_charging = false
    AND sd.is_online = true
  ORDER BY sd.battery_level ASC, sd.last_seen DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. FUNCTION: Get offline devices
-- ============================================
CREATE OR REPLACE FUNCTION public.get_offline_devices(
  p_minutes_offline integer DEFAULT 30
)
RETURNS TABLE (
  id uuid,
  device_id text,
  device_name text,
  device_model text,
  user_id uuid,
  last_seen timestamp with time zone,
  minutes_offline numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sd.id,
    sd.device_id,
    sd.device_name,
    sd.device_model,
    sd.user_id,
    sd.last_seen,
    EXTRACT(EPOCH FROM (now() - sd.last_seen)) / 60.0 as minutes_offline
  FROM public.scanner_devices sd
  WHERE sd.is_online = false 
     OR sd.last_seen < now() - (p_minutes_offline || ' minutes')::interval
  ORDER BY sd.last_seen ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. FUNCTION: Get battery history for device
-- ============================================
CREATE OR REPLACE FUNCTION public.get_device_battery_history(
  p_device_id uuid,
  p_hours integer DEFAULT 24
)
RETURNS TABLE (
  timestamp timestamp with time zone,
  battery_level integer,
  is_charging boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dbl.timestamp,
    dbl.battery_level,
    dbl.is_charging
  FROM public.device_battery_logs dbl
  WHERE dbl.device_id = p_device_id
    AND dbl.timestamp >= now() - (p_hours || ' hours')::interval
  ORDER BY dbl.timestamp ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. TRIGGER: Update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION public.update_scanner_devices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_scanner_devices_updated_at
  BEFORE UPDATE ON public.scanner_devices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_scanner_devices_updated_at();

-- ============================================
-- 10. COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE public.scanner_devices IS 'Tracks scanner devices, battery levels, and device status';
COMMENT ON TABLE public.device_battery_logs IS 'Historical battery level logs for analytics and monitoring';
COMMENT ON FUNCTION public.update_device_status IS 'Updates device status and logs battery level';
COMMENT ON FUNCTION public.get_devices_with_low_battery IS 'Returns devices with battery below threshold';
COMMENT ON FUNCTION public.get_offline_devices IS 'Returns devices that have been offline for specified minutes';
COMMENT ON FUNCTION public.get_device_battery_history IS 'Returns battery history for a device over specified hours';

