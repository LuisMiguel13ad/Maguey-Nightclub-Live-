-- Migration: Add Scanner-Required Columns to Tickets Table
-- This migration adds all columns needed for the scanner app to work with
-- tickets created by the purchase site

-- Add missing columns to tickets table
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS ticket_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS event_name text,
  ADD COLUMN IF NOT EXISTS ticket_type text,
  ADD COLUMN IF NOT EXISTS guest_name text,
  ADD COLUMN IF NOT EXISTS guest_email text,
  ADD COLUMN IF NOT EXISTS guest_phone text,
  ADD COLUMN IF NOT EXISTS price_paid numeric(10,2),
  ADD COLUMN IF NOT EXISTS qr_code_data text,
  ADD COLUMN IF NOT EXISTS is_used boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'issued',
  ADD COLUMN IF NOT EXISTS scanned_at timestamptz,
  ADD COLUMN IF NOT EXISTS scanned_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS purchase_date timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS stripe_payment_id text,
  ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Create indexes on ticket_id and qr_code_data for faster lookups
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_id ON public.tickets(ticket_id);
CREATE INDEX IF NOT EXISTS idx_tickets_qr_code_data ON public.tickets(qr_code_data);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_event_name ON public.tickets(event_name);

-- Optional: Generate ticket_ids for existing tickets (if any exist without ticket_id)
UPDATE public.tickets
SET ticket_id = 'MGY-' || substr(id::text, 1, 8)
WHERE ticket_id IS NULL;

-- Add comment to explain the schema
COMMENT ON COLUMN public.tickets.ticket_id IS 'Human-readable ticket identifier (e.g., MGY-PF-20250115-ABC123)';
COMMENT ON COLUMN public.tickets.qr_code_data IS 'QR code content - typically same as ticket_id';
COMMENT ON COLUMN public.tickets.event_name IS 'Event name for filtering and display';
COMMENT ON COLUMN public.tickets.ticket_type IS 'Ticket type name (e.g., VIP, General Admission)';

