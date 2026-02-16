-- ============================================
-- FRAUD DETECTION SYSTEM MIGRATION
-- ============================================
-- This migration adds tables and indexes for AI-powered fraud detection

-- ============================================
-- 1. SCAN_METADATA TABLE
-- ============================================
-- Stores device fingerprinting and network metadata for each scan
CREATE TABLE IF NOT EXISTS public.scan_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_log_id uuid REFERENCES public.scan_logs(id) ON DELETE CASCADE UNIQUE,
  ip_address inet NOT NULL,
  user_agent text,
  device_fingerprint text,
  geolocation jsonb,
  network_type text,
  is_vpn boolean DEFAULT false,
  screen_resolution text,
  timezone text,
  language text,
  created_at timestamp with time zone DEFAULT now()
);

-- ============================================
-- 2. FRAUD_DETECTION_LOGS TABLE
-- ============================================
-- Stores fraud detection analysis results and risk scores
CREATE TABLE IF NOT EXISTS public.fraud_detection_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_log_id uuid REFERENCES public.scan_logs(id) ON DELETE CASCADE,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE,
  risk_score integer NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  fraud_indicators jsonb NOT NULL,
  ip_address inet,
  device_fingerprint text,
  geolocation jsonb,
  is_confirmed_fraud boolean DEFAULT false,
  investigated_by uuid REFERENCES auth.users(id),
  investigation_notes text,
  is_whitelisted boolean DEFAULT false,
  whitelisted_by uuid REFERENCES auth.users(id),
  whitelisted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- ============================================
-- 3. INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_fraud_logs_risk_score ON public.fraud_detection_logs(risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_logs_ticket_id ON public.fraud_detection_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_fraud_logs_scan_log_id ON public.fraud_detection_logs(scan_log_id);
CREATE INDEX IF NOT EXISTS idx_fraud_logs_confirmed_fraud ON public.fraud_detection_logs(is_confirmed_fraud) WHERE is_confirmed_fraud = true;
CREATE INDEX IF NOT EXISTS idx_fraud_logs_created_at ON public.fraud_detection_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_metadata_ip ON public.scan_metadata(ip_address);
CREATE INDEX IF NOT EXISTS idx_scan_metadata_device_fingerprint ON public.scan_metadata(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_scan_metadata_scan_log_id ON public.scan_metadata(scan_log_id);

-- ============================================
-- 4. ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.scan_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_detection_logs ENABLE ROW LEVEL SECURITY;

-- Policies for scan_metadata
CREATE POLICY "Staff can view all scan metadata"
  ON public.scan_metadata
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can insert scan metadata"
  ON public.scan_metadata
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policies for fraud_detection_logs
CREATE POLICY "Staff can view all fraud detection logs"
  ON public.fraud_detection_logs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can insert fraud detection logs"
  ON public.fraud_detection_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Staff can update fraud detection logs"
  ON public.fraud_detection_logs
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 5. HELPER FUNCTIONS
-- ============================================
-- Function to get recent scans from same IP
CREATE OR REPLACE FUNCTION get_recent_scans_by_ip(
  p_ip_address inet,
  p_minutes integer DEFAULT 30
)
RETURNS TABLE (
  scan_log_id uuid,
  ticket_id uuid,
  scanned_at timestamp with time zone
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sm.scan_log_id,
    sl.ticket_id,
    sl.scanned_at
  FROM public.scan_metadata sm
  JOIN public.scan_logs sl ON sm.scan_log_id = sl.id
  WHERE sm.ip_address = p_ip_address
    AND sl.scanned_at >= NOW() - (p_minutes || ' minutes')::interval
  ORDER BY sl.scanned_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get recent scans from same device fingerprint
CREATE OR REPLACE FUNCTION get_recent_scans_by_device(
  p_device_fingerprint text,
  p_minutes integer DEFAULT 30
)
RETURNS TABLE (
  scan_log_id uuid,
  ticket_id uuid,
  scanned_at timestamp with time zone
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sm.scan_log_id,
    sl.ticket_id,
    sl.scanned_at
  FROM public.scan_metadata sm
  JOIN public.scan_logs sl ON sm.scan_log_id = sl.id
  WHERE sm.device_fingerprint = p_device_fingerprint
    AND sl.scanned_at >= NOW() - (p_minutes || ' minutes')::interval
  ORDER BY sl.scanned_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

