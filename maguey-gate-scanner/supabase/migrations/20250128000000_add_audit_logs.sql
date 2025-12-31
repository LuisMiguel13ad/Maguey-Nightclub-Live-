-- Migration: Add Audit Logs Table
-- This migration creates the audit_logs table for comprehensive activity logging

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  description text NOT NULL,
  metadata jsonb,
  ip_address text,
  user_agent text,
  created_at timestamp with time zone DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON public.audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id ON public.audit_logs(resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON public.audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only authenticated users can view audit logs
CREATE POLICY "Authenticated users can view audit logs"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: System can insert audit logs (via service role)
CREATE POLICY "Service role can insert audit logs"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Only owners can delete audit logs
CREATE POLICY "Owners can delete audit logs"
  ON public.audit_logs
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.user_metadata->>'role' = 'owner' OR auth.users.app_metadata->>'role' = 'owner')
    )
  );

-- Add comments for documentation
COMMENT ON TABLE public.audit_logs IS 'Comprehensive audit trail of all user actions and system changes';
COMMENT ON COLUMN public.audit_logs.action IS 'Type of action performed (ticket_scanned, event_created, etc.)';
COMMENT ON COLUMN public.audit_logs.resource_type IS 'Type of resource affected (ticket, event, user, etc.)';
COMMENT ON COLUMN public.audit_logs.severity IS 'Severity level: info, warning, error, critical';
COMMENT ON COLUMN public.audit_logs.metadata IS 'Additional context data in JSON format';


