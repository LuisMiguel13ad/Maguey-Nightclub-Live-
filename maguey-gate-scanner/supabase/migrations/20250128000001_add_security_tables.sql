-- Migration: Add Security Tables
-- This migration creates tables for security features

-- Security Settings Table
CREATE TABLE IF NOT EXISTS public.security_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_whitelist_enabled boolean DEFAULT false,
  ip_whitelist text[] DEFAULT ARRAY[]::text[],
  session_timeout_minutes integer DEFAULT 60,
  password_min_length integer DEFAULT 8,
  password_require_uppercase boolean DEFAULT true,
  password_require_lowercase boolean DEFAULT true,
  password_require_numbers boolean DEFAULT true,
  password_require_special boolean DEFAULT false,
  max_login_attempts integer DEFAULT 5,
  lockout_duration_minutes integer DEFAULT 15,
  two_factor_enabled boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Login Attempts Table
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text NOT NULL,
  ip_address text,
  success boolean NOT NULL,
  timestamp timestamp with time zone DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_login_attempts_user_id ON public.login_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON public.login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_timestamp ON public.login_attempts(timestamp DESC);

-- Enable RLS
ALTER TABLE public.security_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Policies for security_settings
CREATE POLICY "Owners can view security settings"
  ON public.security_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.user_metadata->>'role' = 'owner' OR auth.users.app_metadata->>'role' = 'owner')
    )
  );

CREATE POLICY "Owners can update security settings"
  ON public.security_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.user_metadata->>'role' = 'owner' OR auth.users.app_metadata->>'role' = 'owner')
    )
  );

-- Policies for login_attempts
CREATE POLICY "Users can view their own login attempts"
  ON public.login_attempts
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can insert login attempts"
  ON public.login_attempts
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Insert default security settings
INSERT INTO public.security_settings (id)
VALUES (gen_random_uuid())
ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.security_settings IS 'Security configuration settings';
COMMENT ON TABLE public.login_attempts IS 'Login attempt tracking for security monitoring';


