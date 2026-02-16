-- Migration: Create promotions table for promo code support
begin;

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_type text not null check (discount_type in ('amount', 'percent')),
  amount numeric(10,2) not null,
  usage_limit integer,
  active boolean not null default true,
  valid_from timestamptz,
  valid_to timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists promotions_code_idx on public.promotions (code);
create index if not exists promotions_active_idx on public.promotions (active, valid_from, valid_to);

create or replace function public.promotions_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists promotions_updated_at on public.promotions;
create trigger promotions_updated_at
before update on public.promotions
for each row
execute function public.promotions_set_updated_at();

commit;


