-- Migration: SMS Usage Tracking and Opt-Out
-- Adds tables for tracking SMS costs, usage, and opt-out management

-- ============================================
-- 1. SMS_USAGE_LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.sms_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_sid text UNIQUE, -- Twilio message SID
  phone_number text NOT NULL,
  message_body text NOT NULL,
  cost decimal(10,4) NOT NULL DEFAULT 0.0075, -- Default US SMS cost
  status text NOT NULL DEFAULT 'sent', -- sent, delivered, failed, undelivered
  error_code text,
  error_message text,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  delivered_at timestamp with time zone,
  rule_id uuid REFERENCES public.notification_rules(id) ON DELETE SET NULL,
  notification_id uuid REFERENCES public.notifications(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb
);

-- ============================================
-- 2. SMS_OPT_OUT TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.sms_opt_out (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL UNIQUE,
  opted_out_at timestamp with time zone NOT NULL DEFAULT now(),
  opt_out_keyword text, -- STOP, UNSUBSCRIBE, etc.
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb
);

-- ============================================
-- 3. SMS_MONTHLY_BUDGET TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.sms_monthly_budget (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month_year text NOT NULL UNIQUE, -- Format: 'YYYY-MM'
  budget_limit decimal(10,2) NOT NULL DEFAULT 100.00,
  current_spend decimal(10,2) NOT NULL DEFAULT 0.00,
  alert_threshold decimal(10,2) NOT NULL DEFAULT 80.00, -- Alert at 80% of budget
  alert_sent boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- ============================================
-- 4. INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_sms_usage_log_phone_number 
  ON public.sms_usage_log(phone_number);

CREATE INDEX IF NOT EXISTS idx_sms_usage_log_sent_at 
  ON public.sms_usage_log(sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_sms_usage_log_month_year 
  ON public.sms_usage_log(date_trunc('month', sent_at));

CREATE INDEX IF NOT EXISTS idx_sms_usage_log_status 
  ON public.sms_usage_log(status);

CREATE INDEX IF NOT EXISTS idx_sms_opt_out_phone_number 
  ON public.sms_opt_out(phone_number);

CREATE INDEX IF NOT EXISTS idx_sms_monthly_budget_month_year 
  ON public.sms_monthly_budget(month_year);

-- ============================================
-- 5. ROW LEVEL SECURITY POLICIES
-- ============================================
ALTER TABLE public.sms_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_opt_out ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_monthly_budget ENABLE ROW LEVEL SECURITY;

-- SMS usage log: authenticated users can view
CREATE POLICY "Users can view SMS usage log"
  ON public.sms_usage_log FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND (u.raw_user_meta_data->>'role' = 'admin' OR u.raw_user_meta_data->>'role' = 'manager')
    )
  );

CREATE POLICY "System can insert SMS usage log"
  ON public.sms_usage_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "System can update SMS usage log"
  ON public.sms_usage_log FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- SMS opt-out: users can view and manage
CREATE POLICY "Users can view SMS opt-out"
  ON public.sms_opt_out FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND (u.raw_user_meta_data->>'role' = 'admin' OR u.raw_user_meta_data->>'role' = 'manager')
    )
  );

CREATE POLICY "System can manage SMS opt-out"
  ON public.sms_opt_out FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- SMS monthly budget: admins only
CREATE POLICY "Admins can view SMS monthly budget"
  ON public.sms_monthly_budget FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
      AND (u.raw_user_meta_data->>'role' = 'admin' OR u.raw_user_meta_data->>'role' = 'manager')
    )
  );

CREATE POLICY "System can manage SMS monthly budget"
  ON public.sms_monthly_budget FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================
-- 6. FUNCTION: Check if phone number is opted out
-- ============================================
CREATE OR REPLACE FUNCTION public.is_phone_opted_out(
  phone_number_param text
)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.sms_opt_out
    WHERE phone_number = phone_number_param
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. FUNCTION: Get current month SMS spend
-- ============================================
CREATE OR REPLACE FUNCTION public.get_current_month_sms_spend()
RETURNS decimal AS $$
DECLARE
  current_spend decimal;
BEGIN
  SELECT COALESCE(SUM(cost), 0) INTO current_spend
  FROM public.sms_usage_log
  WHERE date_trunc('month', sent_at) = date_trunc('month', CURRENT_DATE)
    AND status IN ('sent', 'delivered');
  
  RETURN current_spend;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. FUNCTION: Update monthly budget
-- ============================================
CREATE OR REPLACE FUNCTION public.update_monthly_sms_budget(
  cost_amount decimal
)
RETURNS void AS $$
DECLARE
  current_month text;
  budget_record public.sms_monthly_budget%ROWTYPE;
BEGIN
  current_month := to_char(CURRENT_DATE, 'YYYY-MM');
  
  -- Get or create budget record for current month
  SELECT * INTO budget_record
  FROM public.sms_monthly_budget
  WHERE month_year = current_month;
  
  IF NOT FOUND THEN
    INSERT INTO public.sms_monthly_budget (month_year, current_spend)
    VALUES (current_month, cost_amount)
    ON CONFLICT (month_year) DO UPDATE
    SET current_spend = sms_monthly_budget.current_spend + cost_amount,
        updated_at = now();
  ELSE
    UPDATE public.sms_monthly_budget
    SET current_spend = current_spend + cost_amount,
        updated_at = now()
    WHERE month_year = current_month;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE public.sms_usage_log IS 'Log of all SMS messages sent with cost tracking';
COMMENT ON TABLE public.sms_opt_out IS 'Phone numbers that have opted out of SMS notifications';
COMMENT ON TABLE public.sms_monthly_budget IS 'Monthly SMS budget tracking and alerts';
COMMENT ON FUNCTION public.is_phone_opted_out IS 'Checks if a phone number has opted out of SMS';
COMMENT ON FUNCTION public.get_current_month_sms_spend IS 'Gets total SMS spend for current month';
COMMENT ON FUNCTION public.update_monthly_sms_budget IS 'Updates monthly SMS budget with new cost';

