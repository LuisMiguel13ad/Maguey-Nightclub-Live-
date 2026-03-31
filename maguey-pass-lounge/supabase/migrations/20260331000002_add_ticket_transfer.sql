-- Migration: Add ticket transfer support
-- Adds transfer tracking columns to tickets, creates ticket_transfers audit table,
-- and creates the transfer_ticket_atomic RPC function.

BEGIN;

-- ============================================
-- 1. ADD COLUMNS TO TICKETS TABLE
-- ============================================

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS transfer_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS original_attendee_email TEXT,
  ADD COLUMN IF NOT EXISTS original_attendee_name TEXT;

COMMENT ON COLUMN public.tickets.transfer_count IS
  'Number of times this ticket has been transferred. 0 = never transferred.';
COMMENT ON COLUMN public.tickets.original_attendee_email IS
  'Email of the original ticket holder before any transfer. NULL = never transferred.';
COMMENT ON COLUMN public.tickets.original_attendee_name IS
  'Name of the original ticket holder before any transfer. NULL = never transferred.';

-- ============================================
-- 2. CREATE TICKET_TRANSFERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.ticket_transfers (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id       UUID        NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  from_email      TEXT        NOT NULL,
  from_name       TEXT,
  to_email        TEXT        NOT NULL,
  to_name         TEXT        NOT NULL,
  event_id        TEXT        NOT NULL,
  event_name      TEXT,
  ticket_type_name TEXT,
  transferred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for sender email lookups (Account page "Transferred Tickets" section)
CREATE INDEX IF NOT EXISTS idx_ticket_transfers_from_email
  ON public.ticket_transfers(from_email);

-- Index for ticket lookups (e.g. admin audit trail)
CREATE INDEX IF NOT EXISTS idx_ticket_transfers_ticket_id
  ON public.ticket_transfers(ticket_id);

COMMENT ON TABLE public.ticket_transfers IS
  'Audit log of all ticket transfers. Allows the sender to see tickets they transferred '
  'even after attendee_email on the ticket has changed to the new holder.';

-- ============================================
-- 3. RLS ON TICKET_TRANSFERS
-- ============================================

ALTER TABLE public.ticket_transfers ENABLE ROW LEVEL SECURITY;

-- Senders can view transfers they initiated (for Account page "Transferred Tickets" section)
CREATE POLICY "Senders can view their sent transfers"
  ON public.ticket_transfers
  FOR SELECT
  USING (from_email = (auth.jwt() ->> 'email'));

-- No direct INSERT/UPDATE/DELETE for normal users — only via transfer_ticket_atomic (SECURITY DEFINER)

-- ============================================
-- 4. GRANT TABLE ACCESS
-- ============================================

GRANT SELECT ON public.ticket_transfers TO authenticated, anon;

-- ============================================
-- 5. TRANSFER_TICKET_ATOMIC RPC
-- ============================================

CREATE OR REPLACE FUNCTION public.transfer_ticket_atomic(
  p_ticket_id            UUID,
  p_current_holder_email TEXT,
  p_new_holder_email     TEXT,
  p_new_holder_name      TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id             TEXT;
  v_event_name           TEXT;
  v_event_date           DATE;
  v_event_time           TEXT;
  v_ticket_type_name     TEXT;
  v_current_attendee_name TEXT;
  v_transfer_count       INTEGER;
  v_new_token            UUID;
  v_signing_secret       TEXT;
  v_new_signature        TEXT;
  v_transfer_id          UUID;
BEGIN
  -- Lock the ticket row and fetch event info in one query
  SELECT
    t.event_id,
    t.attendee_name,
    t.transfer_count,
    e.name,
    e.event_date::DATE,
    e.event_time::TEXT,
    tt.name
  INTO
    v_event_id,
    v_current_attendee_name,
    v_transfer_count,
    v_event_name,
    v_event_date,
    v_event_time,
    v_ticket_type_name
  FROM public.tickets t
  JOIN public.events e ON t.event_id = e.id
  LEFT JOIN public.ticket_types tt ON t.ticket_type_id = tt.id
  WHERE t.id = p_ticket_id
    AND t.attendee_email = p_current_holder_email
    AND t.status IN ('issued', 'valid', 'confirmed')
  FOR UPDATE OF t;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found, already used, or not owned by you'
      USING ERRCODE = 'P0002';
  END IF;

  -- Check self-transfer
  IF LOWER(p_new_holder_email) = LOWER(p_current_holder_email) THEN
    RAISE EXCEPTION 'Cannot transfer to yourself'
      USING ERRCODE = 'P0003';
  END IF;

  -- Check event has not started (event_date + event_time must be in the future)
  IF (v_event_date + COALESCE(v_event_time::TIME, '00:00:00'::TIME)) < NOW() THEN
    RAISE EXCEPTION 'Cannot transfer after event has started'
      USING ERRCODE = 'P0004';
  END IF;

  -- Generate new QR token
  v_new_token := gen_random_uuid();

  -- Get QR signing secret from database config
  v_signing_secret := current_setting('app.qr_signing_secret', true);
  IF v_signing_secret IS NULL OR v_signing_secret = '' THEN
    RAISE EXCEPTION 'QR signing secret not configured'
      USING ERRCODE = 'P0005';
  END IF;

  v_new_signature := generate_qr_signature(v_new_token::TEXT, v_signing_secret);

  -- Insert transfer audit record (sender can query this for "Transferred Tickets" section)
  INSERT INTO public.ticket_transfers (
    ticket_id, from_email, from_name, to_email, to_name,
    event_id, event_name, ticket_type_name
  ) VALUES (
    p_ticket_id,
    p_current_holder_email,
    v_current_attendee_name,
    p_new_holder_email,
    p_new_holder_name,
    v_event_id,
    v_event_name,
    v_ticket_type_name
  )
  RETURNING id INTO v_transfer_id;

  -- Update ticket: new holder, new QR, increment transfer count, preserve original owner
  UPDATE public.tickets SET
    attendee_email          = p_new_holder_email,
    attendee_name           = p_new_holder_name,
    guest_email             = p_new_holder_email,
    guest_name              = p_new_holder_name,
    qr_token                = v_new_token,
    qr_signature            = v_new_signature,
    qr_code_data            = v_new_token::TEXT,
    qr_code_value           = v_new_token::TEXT,
    transfer_count          = transfer_count + 1,
    original_attendee_email = CASE
      WHEN transfer_count = 0 THEN p_current_holder_email
      ELSE original_attendee_email
    END,
    original_attendee_name  = CASE
      WHEN transfer_count = 0 THEN v_current_attendee_name
      ELSE original_attendee_name
    END
  WHERE id = p_ticket_id;

  RETURN json_build_object(
    'ticket_id',        p_ticket_id,
    'new_qr_token',     v_new_token,
    'new_qr_signature', v_new_signature,
    'event_name',       v_event_name,
    'event_date',       v_event_date,
    'ticket_type_name', COALESCE(v_ticket_type_name, 'General Admission'),
    'previous_email',   p_current_holder_email,
    'previous_name',    v_current_attendee_name,
    'transfer_id',      v_transfer_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_ticket_atomic TO authenticated, anon;

COMMIT;
