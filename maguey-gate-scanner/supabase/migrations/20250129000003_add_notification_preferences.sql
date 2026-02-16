-- Migration: Add Notification Preferences Table
-- This migration creates the notification_preferences table for user notification settings

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  email_enabled boolean DEFAULT true,
  sms_enabled boolean DEFAULT false,
  push_enabled boolean DEFAULT true,
  capacity_alerts boolean DEFAULT true,
  sales_alerts boolean DEFAULT true,
  fraud_alerts boolean DEFAULT true,
  shift_reminders boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON public.notification_preferences(user_id);

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own preferences"
  ON public.notification_preferences
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
  ON public.notification_preferences
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences"
  ON public.notification_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.notification_preferences IS 'User notification preferences and settings';

