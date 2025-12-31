-- Migration: add row-level security policies for promoter & scanner workflows
-- TODO: run this migration in Supabase dashboard or via supabase CLI

begin;

-- Ensure RLS is enabled on sensitive tables
alter table public.orders enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_scan_logs enable row level security;
alter table public.events enable row level security;
alter table public.ticket_types enable row level security;

-- Helper function to read JWT role claim
create or replace function public.jwt_role()
returns text
language sql
stable
as $$
  select coalesce(current_setting('request.jwt.claims', true)::json->>'role', 'anon');
$$;

-- Public read access for storefront data
drop policy if exists "Public can read events" on public.events;
create policy "Public can read events"
  on public.events
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can read ticket types" on public.ticket_types;
create policy "Public can read ticket types"
  on public.ticket_types
  for select
  to anon, authenticated
  using (true);

-- Orders policies
drop policy if exists "Promoters select orders" on public.orders;
create policy "Promoters select orders"
  on public.orders
  for select
  to authenticated
  using (public.jwt_role() = 'promoter');

drop policy if exists "Promoters insert orders" on public.orders;
create policy "Promoters insert orders"
  on public.orders
  for insert
  to authenticated
  with check (public.jwt_role() = 'promoter');

drop policy if exists "Promoters update orders" on public.orders;
create policy "Promoters update orders"
  on public.orders
  for update
  to authenticated
  using (public.jwt_role() = 'promoter')
  with check (public.jwt_role() = 'promoter');

drop policy if exists "Promoters delete orders" on public.orders;
create policy "Promoters delete orders"
  on public.orders
  for delete
  to authenticated
  using (public.jwt_role() = 'promoter');

drop policy if exists "Scanners select orders" on public.orders;
create policy "Scanners select orders"
  on public.orders
  for select
  to authenticated
  using (public.jwt_role() = 'scanner');

-- Tickets policies
drop policy if exists "Promoters select tickets" on public.tickets;
create policy "Promoters select tickets"
  on public.tickets
  for select
  to authenticated
  using (public.jwt_role() = 'promoter');

drop policy if exists "Promoters insert tickets" on public.tickets;
create policy "Promoters insert tickets"
  on public.tickets
  for insert
  to authenticated
  with check (public.jwt_role() = 'promoter');

drop policy if exists "Promoters update tickets" on public.tickets;
create policy "Promoters update tickets"
  on public.tickets
  for update
  to authenticated
  using (public.jwt_role() = 'promoter')
  with check (public.jwt_role() = 'promoter');

drop policy if exists "Promoters delete tickets" on public.tickets;
create policy "Promoters delete tickets"
  on public.tickets
  for delete
  to authenticated
  using (public.jwt_role() = 'promoter');

drop policy if exists "Scanners select tickets" on public.tickets;
create policy "Scanners select tickets"
  on public.tickets
  for select
  to authenticated
  using (public.jwt_role() = 'scanner');

drop policy if exists "Scanners update ticket status" on public.tickets;
create policy "Scanners update ticket status"
  on public.tickets
  for update
  to authenticated
  using (public.jwt_role() = 'scanner')
  with check (
    public.jwt_role() = 'scanner'
    and status in ('scanned', 'refunded', 'void')
  );

-- Ticket scan logs policies
drop policy if exists "Scanners insert scan logs" on public.ticket_scan_logs;
create policy "Scanners insert scan logs"
  on public.ticket_scan_logs
  for insert
  to authenticated
  with check (public.jwt_role() = 'scanner');

drop policy if exists "Scanners select scan logs" on public.ticket_scan_logs;
create policy "Scanners select scan logs"
  on public.ticket_scan_logs
  for select
  to authenticated
  using (public.jwt_role() = 'scanner');

drop policy if exists "Promoters select scan logs" on public.ticket_scan_logs;
create policy "Promoters select scan logs"
  on public.ticket_scan_logs
  for select
  to authenticated
  using (public.jwt_role() = 'promoter');

commit;


