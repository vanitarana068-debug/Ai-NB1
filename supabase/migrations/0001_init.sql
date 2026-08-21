-- Northbridge storefront — accounts and orders.
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
-- Everything below is idempotent, so re-running it is safe.

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, created automatically on signup.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  full_name  text,
  address1   text,
  address2   text,
  city       text,
  postcode   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Keep updated_at honest.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- A new auth user gets a profile row immediately, so the account page never
-- has to cope with a missing record.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- orders + order_items
-- Money is stored in pence as integers, matching the front end.
-- ---------------------------------------------------------------------------
create sequence if not exists public.order_reference_seq start with 100000;

create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  reference       text not null unique
                    default 'NB-' || nextval('public.order_reference_seq'),
  status          text not null default 'confirmed'
                    check (status in ('confirmed', 'packing', 'shipped', 'delivered', 'cancelled')),
  full_name       text not null,
  email           text not null,
  address1        text not null,
  address2        text,
  city            text not null,
  postcode        text not null,
  delivery_speed  text not null default 'standard'
                    check (delivery_speed in ('standard', 'express')),
  subtotal_pence  integer not null check (subtotal_pence >= 0),
  shipping_pence  integer not null check (shipping_pence >= 0),
  total_pence     integer not null check (total_pence >= 0),
  created_at      timestamptz not null default now()
);

create index if not exists orders_user_id_created_at_idx
  on public.orders (user_id, created_at desc);

alter table public.orders enable row level security;

drop policy if exists orders_select_own on public.orders;
create policy orders_select_own on public.orders
  for select using (auth.uid() = user_id);

drop policy if exists orders_insert_own on public.orders;
create policy orders_insert_own on public.orders
  for insert with check (auth.uid() = user_id);

create table if not exists public.order_items (
  id               bigint generated always as identity primary key,
  order_id         uuid not null references public.orders (id) on delete cascade,
  product_slug     text not null,
  product_name     text not null,
  unit_price_pence integer not null check (unit_price_pence >= 0),
  quantity         integer not null check (quantity > 0),
  line_total_pence integer generated always as (unit_price_pence * quantity) stored
);

create index if not exists order_items_order_id_idx on public.order_items (order_id);

alter table public.order_items enable row level security;

-- An item is visible/insertable only through an order the caller owns.
drop policy if exists order_items_select_own on public.order_items;
create policy order_items_select_own on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = auth.uid()
    )
  );

drop policy if exists order_items_insert_own on public.order_items;
create policy order_items_insert_own on public.order_items
  for insert with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = auth.uid()
    )
  );
