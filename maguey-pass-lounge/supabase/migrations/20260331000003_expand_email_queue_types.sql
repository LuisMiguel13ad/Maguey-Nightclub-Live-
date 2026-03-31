-- Expand email_queue.email_type CHECK constraint to support ticket transfer emails.
-- Previous constraint only allowed 'ga_ticket' and 'vip_confirmation'.

BEGIN;

ALTER TABLE public.email_queue
  DROP CONSTRAINT IF EXISTS email_queue_email_type_check;

ALTER TABLE public.email_queue
  ADD CONSTRAINT email_queue_email_type_check
  CHECK (email_type IN (
    'ga_ticket',
    'vip_confirmation',
    'ticket_transfer_received',
    'ticket_transfer_sent'
  ));

COMMIT;
