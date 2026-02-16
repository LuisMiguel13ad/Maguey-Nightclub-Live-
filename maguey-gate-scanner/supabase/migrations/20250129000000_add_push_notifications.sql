-- Migration: Push Notification System
-- This migration adds tables for Firebase Cloud Messaging push notifications

-- ============================================
-- 1. USER DEVICE TOKENS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  platform text NOT NULL CHECK (platform IN ('web', 'ios', 'android')),
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ============================================
-- 2. INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON public.user_device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_active ON public.user_device_tokens(is_active);
CREATE INDEX IF NOT EXISTS idx_device_tokens_platform ON public.user_device_tokens(platform);
CREATE INDEX IF NOT EXISTS idx_device_tokens_token ON public.user_device_tokens(token);

-- ============================================
-- 3. ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.user_device_tokens ENABLE ROW LEVEL SECURITY;

-- Users can manage their own device tokens
CREATE POLICY "Users can view their own device tokens"
  ON public.user_device_tokens
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own device tokens"
  ON public.user_device_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own device tokens"
  ON public.user_device_tokens
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own device tokens"
  ON public.user_device_tokens
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role can manage all tokens (for push notification sending)
CREATE POLICY "Service role can manage all device tokens"
  ON public.user_device_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 4. SMS USAGE LOG TABLE (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS public.sms_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_sid text UNIQUE NOT NULL,
  phone_number text,
  message_body text,
  cost decimal(10,4) NOT NULL,
  status text DEFAULT 'sent',
  error_code text,
  error_message text,
  rule_id uuid,
  notification_id uuid,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb,
  delivered_at timestamp with time zone,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Indexes for SMS usage log
CREATE INDEX IF NOT EXISTS idx_sms_usage_log_sid ON public.sms_usage_log(message_sid);
CREATE INDEX IF NOT EXISTS idx_sms_usage_log_user ON public.sms_usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_sms_usage_log_sent_at ON public.sms_usage_log(sent_at);
CREATE INDEX IF NOT EXISTS idx_sms_usage_log_status ON public.sms_usage_log(status);

-- ============================================
-- 5. TRIGGER TO UPDATE updated_at TIMESTAMP
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_device_tokens_updated_at
  BEFORE UPDATE ON public.user_device_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

