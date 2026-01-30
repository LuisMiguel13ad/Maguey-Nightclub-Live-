-- ============================================
-- Email Queue Cron Job Setup
-- Migration: 20260130100001_email_queue_cron.sql
-- ============================================
--
-- This migration documents the pg_cron setup needed for email queue processing.
--
-- The email queue processor is an Edge Function that runs every minute to:
-- 1. Fetch pending emails ready for retry (max 10 per batch)
-- 2. Send emails via Resend API
-- 3. Handle failures with exponential backoff retry
-- 4. Mark permanently failed emails after max attempts
--
-- SETUP INSTRUCTIONS:
-- -------------------
-- The cron job must be configured via Supabase Dashboard because it requires
-- secret values (project URL and service role key) that cannot be stored in
-- migration files.
--
-- Option 1: Supabase Dashboard (Recommended for Production)
-- ---------------------------------------------------------
-- 1. Go to Supabase Dashboard -> Database -> Extensions
-- 2. Enable pg_cron if not already enabled
-- 3. Go to Database -> Cron Jobs
-- 4. Create new job with:
--    - Name: process-email-queue
--    - Schedule: * * * * * (every minute)
--    - Command: (see SQL below)
--
-- Option 2: SQL with Vault Secrets
-- --------------------------------
-- If you prefer SQL-based setup, first store secrets in vault:
--
--   SELECT vault.create_secret('https://your-project-ref.supabase.co', 'project_url');
--   SELECT vault.create_secret('your-service-role-key', 'service_role_key');
--
-- Then create the cron job:
--
--   SELECT cron.schedule(
--     'process-email-queue',
--     '* * * * *',
--     $$
--     SELECT net.http_post(
--       url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
--              || '/functions/v1/process-email-queue',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
--       ),
--       body := '{}'::jsonb
--     ) AS request_id;
--     $$
--   );
--
-- VERIFICATION:
-- -------------
-- After setup, verify the job is running:
--
--   SELECT * FROM cron.job WHERE jobname = 'process-email-queue';
--   SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-email-queue') ORDER BY start_time DESC LIMIT 10;
--
-- MANUAL TRIGGER (for testing):
-- -----------------------------
-- You can manually invoke the edge function to test:
--
--   curl -X POST 'https://your-project-ref.supabase.co/functions/v1/process-email-queue' \
--     -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
--     -H 'Content-Type: application/json'
--
-- ============================================

-- This is a documentation-only migration.
-- The actual cron job setup requires Supabase Dashboard configuration.

-- Add a comment to the email_queue table documenting the cron dependency
COMMENT ON TABLE email_queue IS 'Email queue for reliable delivery with retry logic. Processed by process-email-queue Edge Function every minute via pg_cron.';

-- Ensure pg_cron and pg_net extensions are available (they are typically enabled by default in Supabase)
-- Note: These may require superuser privileges if not already enabled
DO $$
BEGIN
  -- Check if pg_cron exists (don't error if it doesn't, just log)
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron extension is not enabled. Enable it via Supabase Dashboard -> Database -> Extensions';
  ELSE
    RAISE NOTICE 'pg_cron extension is available';
  END IF;

  -- Check if pg_net exists
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'pg_net extension is not enabled. Enable it via Supabase Dashboard -> Database -> Extensions';
  ELSE
    RAISE NOTICE 'pg_net extension is available';
  END IF;
END
$$;

-- Output setup reminder
SELECT 'EMAIL QUEUE CRON JOB SETUP REQUIRED' AS action,
       'Configure process-email-queue cron job via Supabase Dashboard' AS instruction,
       '* * * * *' AS schedule,
       'POST /functions/v1/process-email-queue' AS endpoint;
