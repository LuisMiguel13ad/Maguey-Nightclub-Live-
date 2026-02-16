-- Migration: Intelligent Notification System
-- Adds tables and functions for intelligent notification management

-- ============================================
-- 1. NOTIFICATION_RULES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.notification_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trigger_type text NOT NULL, -- entry_rate_drop, capacity_threshold, battery_low, device_offline, wait_time_unusual, fraud_alert, revenue_milestone, vip_ticket, emergency
  conditions jsonb NOT NULL, -- Flexible conditions for the trigger
  channels text[] NOT NULL, -- ['email', 'sms', 'push', 'webhook', 'slack', 'discord', 'browser']
  recipients uuid[] NOT NULL, -- Array of user IDs who should receive notifications
  severity text DEFAULT 'medium', -- low, medium, high, critical
  is_active boolean DEFAULT true,
  throttle_minutes integer DEFAULT 0, -- Minimum minutes between notifications for this rule
  quiet_hours_start time, -- Optional: start of quiet hours
  quiet_hours_end time, -- Optional: end of quiet hours
  escalation_chain jsonb, -- Optional: escalation rules
  template_title text, -- Optional: custom title template
  template_message text, -- Optional: custom message template
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ============================================
-- 2. NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid REFERENCES public.notification_rules(id) ON DELETE SET NULL,
  trigger_event_id text, -- ID of the event that triggered this notification (e.g., ticket_id, device_id)
  severity text NOT NULL, -- low, medium, high, critical
  title text NOT NULL,
  message text NOT NULL,
  channels_used text[] NOT NULL, -- Which channels were actually used
  recipients uuid[] NOT NULL, -- Who received this notification
  metadata jsonb, -- Additional context about the notification
  status text DEFAULT 'pending', -- pending, sent, failed, acknowledged
  sent_at timestamp with time zone,
  acknowledged_at timestamp with time zone,
  acknowledged_by uuid REFERENCES auth.users(id),
  delivery_status jsonb, -- Status per channel: {'email': 'sent', 'sms': 'failed', ...}
  created_at timestamp with time zone DEFAULT now()
);

-- ============================================
-- 3. USER_NOTIFICATION_PREFERENCES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) UNIQUE NOT NULL,
  email_enabled boolean DEFAULT true,
  sms_enabled boolean DEFAULT false,
  push_enabled boolean DEFAULT true,
  browser_enabled boolean DEFAULT true,
  quiet_hours_start time,
  quiet_hours_end time,
  min_severity text DEFAULT 'medium', -- Only notify for this severity and above
  preferences jsonb, -- Additional preferences: {'slack_webhook': '...', 'discord_webhook': '...', 'phone_number': '...'}
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ============================================
-- 4. NOTIFICATION_THROTTLE_LOG TABLE (for throttling)
-- ============================================
CREATE TABLE IF NOT EXISTS public.notification_throttle_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid REFERENCES public.notification_rules(id) ON DELETE CASCADE,
  last_sent_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- ============================================
-- 5. INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_notifications_status_created 
  ON public.notifications(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_severity 
  ON public.notifications(severity);

CREATE INDEX IF NOT EXISTS idx_notifications_rule_id 
  ON public.notifications(rule_id);

CREATE INDEX IF NOT EXISTS idx_notifications_recipients 
  ON public.notifications USING GIN(recipients);

CREATE INDEX IF NOT EXISTS idx_notification_rules_trigger_type 
  ON public.notification_rules(trigger_type, is_active);

CREATE INDEX IF NOT EXISTS idx_notification_rules_active 
  ON public.notification_rules(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_user_notification_preferences_user_id 
  ON public.user_notification_preferences(user_id);

CREATE INDEX IF NOT EXISTS idx_notification_throttle_log_rule 
  ON public.notification_throttle_log(rule_id, last_sent_at DESC);

-- ============================================
-- 6. ROW LEVEL SECURITY POLICIES
-- ============================================
ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_throttle_log ENABLE ROW LEVEL SECURITY;

-- Notification rules: authenticated users can view, admins can manage
CREATE POLICY "Users can view notification rules"
  ON public.notification_rules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage notification rules"
  ON public.notification_rules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND (u.raw_user_meta_data->>'role' = 'admin' OR u.raw_user_meta_data->>'role' = 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND (u.raw_user_meta_data->>'role' = 'admin' OR u.raw_user_meta_data->>'role' = 'manager')
    )
  );

-- Notifications: users can view their own notifications
CREATE POLICY "Users can view their notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (
    auth.uid() = ANY(recipients) OR
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND (u.raw_user_meta_data->>'role' = 'admin' OR u.raw_user_meta_data->>'role' = 'manager')
    )
  );

CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can acknowledge their notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = ANY(recipients))
  WITH CHECK (
    acknowledged_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND (u.raw_user_meta_data->>'role' = 'admin' OR u.raw_user_meta_data->>'role' = 'manager')
    )
  );

-- User notification preferences: users can manage their own preferences
CREATE POLICY "Users can view their notification preferences"
  ON public.user_notification_preferences FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND (u.raw_user_meta_data->>'role' = 'admin' OR u.raw_user_meta_data->>'role' = 'manager')
    )
  );

CREATE POLICY "Users can manage their notification preferences"
  ON public.user_notification_preferences FOR ALL
  TO authenticated
  USING (user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND (u.raw_user_meta_data->>'role' = 'admin' OR u.raw_user_meta_data->>'role' = 'manager')
    )
  )
  WITH CHECK (user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND (u.raw_user_meta_data->>'role' = 'admin' OR u.raw_user_meta_data->>'role' = 'manager')
    )
  );

-- Throttle log: system only
CREATE POLICY "System can manage throttle log"
  ON public.notification_throttle_log FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 7. FUNCTION: Check if notification should be throttled
-- ============================================
CREATE OR REPLACE FUNCTION public.should_throttle_notification(
  rule_id_param uuid
)
RETURNS boolean AS $$
DECLARE
  throttle_minutes_val integer;
  last_sent timestamp with time zone;
BEGIN
  -- Get throttle minutes for the rule
  SELECT throttle_minutes INTO throttle_minutes_val
  FROM public.notification_rules
  WHERE id = rule_id_param;
  
  -- If no throttle, allow notification
  IF throttle_minutes_val IS NULL OR throttle_minutes_val = 0 THEN
    RETURN false;
  END IF;
  
  -- Get last sent time
  SELECT MAX(last_sent_at) INTO last_sent
  FROM public.notification_throttle_log
  WHERE rule_id = rule_id_param;
  
  -- If never sent, allow notification
  IF last_sent IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if enough time has passed
  IF last_sent + (throttle_minutes_val || ' minutes')::interval > NOW() THEN
    RETURN true; -- Should throttle
  END IF;
  
  RETURN false; -- Don't throttle
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. FUNCTION: Record notification throttle
-- ============================================
CREATE OR REPLACE FUNCTION public.record_notification_throttle(
  rule_id_param uuid
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.notification_throttle_log (rule_id, last_sent_at)
  VALUES (rule_id_param, NOW())
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. FUNCTION: Get user notification preferences
-- ============================================
CREATE OR REPLACE FUNCTION public.get_user_notification_preferences(
  user_id_param uuid
)
RETURNS TABLE (
  email_enabled boolean,
  sms_enabled boolean,
  push_enabled boolean,
  browser_enabled boolean,
  quiet_hours_start time,
  quiet_hours_end time,
  min_severity text,
  preferences jsonb
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    unp.email_enabled,
    unp.sms_enabled,
    unp.push_enabled,
    unp.browser_enabled,
    unp.quiet_hours_start,
    unp.quiet_hours_end,
    unp.min_severity,
    unp.preferences
  FROM public.user_notification_preferences unp
  WHERE unp.user_id = user_id_param;
  
  -- If no preferences exist, return defaults
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      true::boolean as email_enabled,
      false::boolean as sms_enabled,
      true::boolean as push_enabled,
      true::boolean as browser_enabled,
      NULL::time as quiet_hours_start,
      NULL::time as quiet_hours_end,
      'medium'::text as min_severity,
      '{}'::jsonb as preferences;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 10. FUNCTION: Check if in quiet hours
-- ============================================
CREATE OR REPLACE FUNCTION public.is_in_quiet_hours(
  quiet_start time,
  quiet_end time
)
RETURNS boolean AS $$
DECLARE
  current_time time;
BEGIN
  IF quiet_start IS NULL OR quiet_end IS NULL THEN
    RETURN false;
  END IF;
  
  current_time := CURRENT_TIME;
  
  -- Handle quiet hours that span midnight
  IF quiet_start <= quiet_end THEN
    RETURN current_time >= quiet_start AND current_time < quiet_end;
  ELSE
    RETURN current_time >= quiet_start OR current_time < quiet_end;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 11. FUNCTION: Get active notification rules for trigger
-- ============================================
CREATE OR REPLACE FUNCTION public.get_active_notification_rules(
  trigger_type_param text
)
RETURNS TABLE (
  id uuid,
  name text,
  trigger_type text,
  conditions jsonb,
  channels text[],
  recipients uuid[],
  severity text,
  throttle_minutes integer,
  quiet_hours_start time,
  quiet_hours_end time,
  template_title text,
  template_message text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    nr.id,
    nr.name,
    nr.trigger_type,
    nr.conditions,
    nr.channels,
    nr.recipients,
    nr.severity,
    nr.throttle_minutes,
    nr.quiet_hours_start,
    nr.quiet_hours_end,
    nr.template_title,
    nr.template_message
  FROM public.notification_rules nr
  WHERE nr.trigger_type = trigger_type_param
    AND nr.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 12. COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE public.notification_rules IS 'Rules that define when and how notifications should be sent';
COMMENT ON TABLE public.notifications IS 'Log of all sent notifications with delivery status';
COMMENT ON TABLE public.user_notification_preferences IS 'User preferences for notification channels and quiet hours';
COMMENT ON TABLE public.notification_throttle_log IS 'Log of when notifications were sent for throttling purposes';
COMMENT ON FUNCTION public.should_throttle_notification IS 'Checks if a notification should be throttled based on rule settings';
COMMENT ON FUNCTION public.record_notification_throttle IS 'Records that a notification was sent for throttling';
COMMENT ON FUNCTION public.get_user_notification_preferences IS 'Gets user notification preferences or returns defaults';
COMMENT ON FUNCTION public.is_in_quiet_hours IS 'Checks if current time is within quiet hours';
COMMENT ON FUNCTION public.get_active_notification_rules IS 'Gets all active notification rules for a specific trigger type';

