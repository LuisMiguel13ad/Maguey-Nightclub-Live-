-- Migration: ensure tickets table has security-related columns
-- Adds qr_token, qr_signature, status, issued_at, metadata columns if missing

begin;

alter table public.tickets
  add column if not exists qr_token text unique,
  add column if not exists qr_signature text,
  add column if not exists status text not null default 'issued',
  add column if not exists issued_at timestamptz default now(),
  add column if not exists metadata jsonb default '{}'::jsonb;

-- Backfill defaults for existing rows
update public.tickets
set
  status = coalesce(status, 'issued'),
  issued_at = coalesce(issued_at, created_at),
  metadata = coalesce(metadata, '{}'::jsonb)
where status is null
   or issued_at is null
   or metadata is null;

comment on column public.tickets.qr_token is 'Signed token embedded in QR payload';
comment on column public.tickets.qr_signature is 'HMAC signature for validating token';
comment on column public.tickets.status is 'issued | scanned | refunded | void';
comment on column public.tickets.issued_at is 'Timestamp when ticket was issued';
comment on column public.tickets.metadata is 'Additional per-ticket metadata (JSON)';

commit;

