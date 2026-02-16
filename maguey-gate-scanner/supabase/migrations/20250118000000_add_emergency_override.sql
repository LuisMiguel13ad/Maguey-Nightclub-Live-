-- Migration: Emergency Override System
-- This migration adds emergency override functionality for edge case handling

-- ============================================
-- 1. CREATE EMERGENCY_OVERRIDE_LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.emergency_override_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  override_type text NOT NULL, -- 'capacity', 'refund', 'transfer', 'id_verification', 'duplicate'
  reason text NOT NULL,
  notes text,
  scan_log_id uuid REFERENCES public.scan_logs(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- ============================================
-- 2. UPDATE SCAN_LOGS TABLE
-- ============================================
ALTER TABLE public.scan_logs
  ADD COLUMN IF NOT EXISTS override_used boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS override_reason text;

-- ============================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_emergency_override_logs_ticket_id ON public.emergency_override_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_emergency_override_logs_user_id ON public.emergency_override_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_emergency_override_logs_created_at ON public.emergency_override_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_emergency_override_logs_override_type ON public.emergency_override_logs(override_type);
CREATE INDEX IF NOT EXISTS idx_scan_logs_override_used ON public.scan_logs(override_used);

-- ============================================
-- 4. ROW LEVEL SECURITY FOR EMERGENCY_OVERRIDE_LOGS
-- ============================================
ALTER TABLE public.emergency_override_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view override logs
CREATE POLICY "Override logs are viewable by authenticated users"
  ON public.emergency_override_logs FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert override logs
CREATE POLICY "Override logs can be created by authenticated users"
  ON public.emergency_override_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================
-- 5. HELPER FUNCTION TO GET OVERRIDE STATISTICS
-- ============================================
CREATE OR REPLACE FUNCTION public.get_override_stats(
  start_date timestamp with time zone DEFAULT (now() - interval '30 days'),
  end_date timestamp with time zone DEFAULT now()
)
RETURNS TABLE (
  total_overrides bigint,
  capacity_overrides bigint,
  refund_overrides bigint,
  transfer_overrides bigint,
  id_verification_overrides bigint,
  duplicate_overrides bigint,
  unique_users bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint as total_overrides,
    COUNT(*) FILTER (WHERE override_type = 'capacity')::bigint as capacity_overrides,
    COUNT(*) FILTER (WHERE override_type = 'refund')::bigint as refund_overrides,
    COUNT(*) FILTER (WHERE override_type = 'transfer')::bigint as transfer_overrides,
    COUNT(*) FILTER (WHERE override_type = 'id_verification')::bigint as id_verification_overrides,
    COUNT(*) FILTER (WHERE override_type = 'duplicate')::bigint as duplicate_overrides,
    COUNT(DISTINCT user_id)::bigint as unique_users
  FROM public.emergency_override_logs
  WHERE created_at >= start_date AND created_at <= end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE public.emergency_override_logs IS 'Audit log of all emergency override actions';
COMMENT ON COLUMN public.emergency_override_logs.override_type IS 'Type of override: capacity, refund, transfer, id_verification, duplicate';
COMMENT ON COLUMN public.scan_logs.override_used IS 'Indicates if this scan used emergency override';
COMMENT ON COLUMN public.scan_logs.override_reason IS 'Reason for override if override_used is true';
COMMENT ON FUNCTION public.get_override_stats IS 'Returns statistics about override usage within a date range';

