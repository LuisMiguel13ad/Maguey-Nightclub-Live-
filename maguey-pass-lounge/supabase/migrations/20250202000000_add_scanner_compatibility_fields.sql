-- Migration: Add scanner compatibility fields to tickets table
-- Adds fields needed for scanner to work with tickets

begin;

-- Add ticket_id (human-readable ID) if it doesn't exist
alter table public.tickets
  add column if not exists ticket_id text unique;

-- Add event_name (denormalized for faster scanning)
alter table public.tickets
  add column if not exists event_name text;

-- Add ticket_type (type code string) if it doesn't exist
alter table public.tickets
  add column if not exists ticket_type text;

-- Add guest_name (same as attendee_name, for scanner compatibility)
alter table public.tickets
  add column if not exists guest_name text;

-- Add guest_email (same as attendee_email, for scanner compatibility)
alter table public.tickets
  add column if not exists guest_email text;

-- Add qr_code_data (same as qr_code_value, for scanner compatibility)
alter table public.tickets
  add column if not exists qr_code_data text;

-- Add is_used (boolean flag for ticket usage)
alter table public.tickets
  add column if not exists is_used boolean default false;

-- Add purchase_date (timestamp of purchase)
alter table public.tickets
  add column if not exists purchase_date timestamptz;

-- Backfill existing tickets with data from related tables
update public.tickets t
set
  ticket_id = coalesce(t.ticket_id, t.qr_code_value),
  event_name = coalesce(t.event_name, e.name),
  guest_name = coalesce(t.guest_name, t.attendee_name),
  guest_email = coalesce(t.guest_email, t.attendee_email),
  qr_code_data = coalesce(t.qr_code_data, t.qr_code_value),
  is_used = coalesce(t.is_used, (t.status = 'scanned')),
  purchase_date = coalesce(t.purchase_date, t.issued_at)
from public.events e
where t.event_id = e.id
  and (
    t.ticket_id is null
    or t.event_name is null
    or t.guest_name is null
    or t.guest_email is null
    or t.qr_code_data is null
    or t.is_used is null
    or t.purchase_date is null
  );

-- Create index on ticket_id for faster lookups
create index if not exists idx_tickets_ticket_id_lookup on public.tickets(ticket_id);

-- Create index on qr_code_data for scanner lookups
create index if not exists idx_tickets_qr_code_data on public.tickets(qr_code_data);

comment on column public.tickets.ticket_id is 'Human-readable ticket ID for scanner (e.g., MGY-PF-20250115-ABC123)';
comment on column public.tickets.event_name is 'Denormalized event name for faster scanning without JOINs';
comment on column public.tickets.ticket_type is 'Ticket type code (e.g., vip, general_admission)';
comment on column public.tickets.guest_name is 'Guest name (same as attendee_name, for scanner compatibility)';
comment on column public.tickets.guest_email is 'Guest email (same as attendee_email, for scanner compatibility)';
comment on column public.tickets.qr_code_data is 'QR code data string (same as qr_code_value, for scanner compatibility)';
comment on column public.tickets.is_used is 'Boolean flag indicating if ticket has been used/scanned';
comment on column public.tickets.purchase_date is 'Timestamp when ticket was purchased';

commit;

