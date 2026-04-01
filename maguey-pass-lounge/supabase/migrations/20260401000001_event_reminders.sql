-- Migration: Event Reminder Emails
-- Creates event_reminder_log table for idempotent reminder tracking,
-- expands email_type CHECK to include reminder types,
-- and documents the pg_cron hourly job setup.

BEGIN;

-- 1. Expand email_type CHECK constraint to include reminder email types
ALTER TABLE public.email_queue
  DROP CONSTRAINT IF EXISTS email_queue_email_type_check;

ALTER TABLE public.email_queue
  ADD CONSTRAINT email_queue_email_type_check
  CHECK (email_type IN (
    'ga_ticket',
    'vip_confirmation',
    'ticket_transfer_received',
    'ticket_transfer_sent',
    'event_reminder_24h',
    'event_reminder_2h'
  ));

-- 2. Create event_reminder_log table
-- Tracks which (ticket, reminder_type) pairs have already been sent,
-- preventing duplicate reminders even if the cron job runs multiple times.
CREATE TABLE IF NOT EXISTS public.event_reminder_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     UUID        NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  event_id      UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  reminder_type TEXT        NOT NULL CHECK (reminder_type IN ('24h', '2h')),
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status        TEXT        NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'skipped')),
  -- Unique constraint prevents double-sending even under concurrent execution
  CONSTRAINT event_reminder_log_ticket_reminder_unique UNIQUE (ticket_id, reminder_type)
);

-- Row Level Security: only the service role (Edge Functions) can read/write
ALTER TABLE public.event_reminder_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on event_reminder_log"
  ON public.event_reminder_log
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Indexes for efficient deduplication and event-based lookups
CREATE INDEX IF NOT EXISTS idx_event_reminder_log_ticket_type
  ON public.event_reminder_log (ticket_id, reminder_type);

CREATE INDEX IF NOT EXISTS idx_event_reminder_log_event_id
  ON public.event_reminder_log (event_id);

COMMIT;

-- =========================================================
-- pg_cron setup — run manually in Supabase Dashboard > SQL Editor
-- =========================================================
--
-- Requires: pg_cron and pg_net extensions enabled
-- Schedule: Every hour on the hour (0 * * * *)
-- This calls send-event-reminders which checks 24h and 2h windows.
--
-- SELECT cron.schedule(
--   'send-event-reminders-hourly',
--   '0 * * * *',
--   $$
--   SELECT net.http_post(
--     url     := current_setting('app.supabase_url') || '/functions/v1/send-event-reminders',
--     headers := jsonb_build_object(
--       'Content-Type',  'application/json',
--       'Authorization', 'Bearer ' || current_setting('app.service_role_key')
--     ),
--     body    := '{}'::jsonb
--   );
--   $$
-- );
--
-- Verify: SELECT jobid, schedule, command, active FROM cron.job;
-- Remove: SELECT cron.unschedule('send-event-reminders-hourly');
-- =========================================================
