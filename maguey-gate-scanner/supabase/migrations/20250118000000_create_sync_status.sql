-- Migration: Create Sync Status Tables
-- This migration creates tables for tracking device sync status and sync history

-- ============================================
-- 1. SYNC_STATUS TABLE (device-level sync health)
-- ============================================
CREATE TABLE IF NOT EXISTS public.sync_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'synced', -- synced, syncing, pending, failed
  pending_count integer DEFAULT 0,
  syncing_count integer DEFAULT 0,
  synced_count integer DEFAULT 0,
  failed_count integer DEFAULT 0,
  total_count integer DEFAULT 0,
  last_synced_at timestamptz,
  last_sync_error text,
  retry_count integer DEFAULT 0,
  sync_health_score numeric(5,2) DEFAULT 100.00, -- Percentage synced
  is_online boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(device_id)
);

-- ============================================
-- 2. SYNC_HISTORY TABLE (sync operation log)
-- ============================================
CREATE TABLE IF NOT EXISTS public.sync_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  sync_type text NOT NULL, -- 'auto', 'manual', 'retry'
  status text NOT NULL, -- 'success', 'partial', 'failed'
  scans_processed integer DEFAULT 0,
  scans_succeeded integer DEFAULT 0,
  scans_failed integer DEFAULT 0,
  duration_ms integer, -- Sync duration in milliseconds
  error_message text,
  sync_speed_scans_per_sec numeric(10,2), -- Calculated sync speed
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- ============================================
-- 3. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_sync_status_device_id ON public.sync_status(device_id);
CREATE INDEX IF NOT EXISTS idx_sync_status_user_id ON public.sync_status(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_status_status ON public.sync_status(status);
CREATE INDEX IF NOT EXISTS idx_sync_history_device_id ON public.sync_history(device_id);
CREATE INDEX IF NOT EXISTS idx_sync_history_user_id ON public.sync_history(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_history_started_at ON public.sync_history(started_at DESC);

-- ============================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE public.sync_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_history ENABLE ROW LEVEL SECURITY;

-- Users can read their own sync status
CREATE POLICY "Users can view their own sync status"
  ON public.sync_status
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own sync status
CREATE POLICY "Users can update their own sync status"
  ON public.sync_status
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can insert their own sync status
CREATE POLICY "Users can insert their own sync status"
  ON public.sync_status
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own sync history
CREATE POLICY "Users can view their own sync history"
  ON public.sync_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own sync history
CREATE POLICY "Users can insert their own sync history"
  ON public.sync_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Owners can view all sync status (for admin dashboard)
CREATE POLICY "Owners can view all sync status"
  ON public.sync_status
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'owner'
    )
  );

-- Owners can view all sync history (for admin dashboard)
CREATE POLICY "Owners can view all sync history"
  ON public.sync_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'owner'
    )
  );

-- ============================================
-- 5. FUNCTIONS
-- ============================================

-- Function to update sync_status updated_at timestamp
CREATE OR REPLACE FUNCTION update_sync_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER sync_status_updated_at
  BEFORE UPDATE ON public.sync_status
  FOR EACH ROW
  EXECUTE FUNCTION update_sync_status_updated_at();

-- Function to calculate sync health score
CREATE OR REPLACE FUNCTION calculate_sync_health_score(
  p_total integer,
  p_synced integer,
  p_failed integer
)
RETURNS numeric AS $$
BEGIN
  IF p_total = 0 THEN
    RETURN 100.00;
  END IF;
  
  RETURN ROUND(
    ((p_synced::numeric / NULLIF(p_total, 0)::numeric) * 100)::numeric,
    2
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. COMMENTS
-- ============================================
COMMENT ON TABLE public.sync_status IS 'Tracks real-time sync status for each device';
COMMENT ON TABLE public.sync_history IS 'Logs all sync operations for audit and debugging';
COMMENT ON COLUMN public.sync_status.sync_health_score IS 'Percentage of scans successfully synced (0-100)';
COMMENT ON COLUMN public.sync_history.sync_speed_scans_per_sec IS 'Calculated sync speed: scans_processed / (duration_ms / 1000)';

