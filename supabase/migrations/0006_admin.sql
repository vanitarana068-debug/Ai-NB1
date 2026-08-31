-- Northbridge storefront — admin roles and merchant operations.
-- Run this AFTER 0001–0005, in the Supabase SQL editor.
-- Idempotent: re-running is safe and does not touch live data.
--
-- What this adds:
--   * a `role` column on profiles ('customer' | 'admin')
--   * is_admin() — the single source of truth for "is the caller staff?"
--   * admin-only SELECT policies so an admin can see every order
--   * definer RPCs an admin calls to run the shop: advance an order's status,
--     set a product's stock (ledgered), and edit a product's price/flags.
--
-- The catalogue invariant from 0002 still holds: stock only ever moves through
-- a definer function that writes the stock_movements ledger — the admin RPCs
-- below included. There is deliberately no broad UPDATE policy on products.

-- ---------------------------------------------------------------------------
-- profiles.role
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists role text not null default 'customer'
    check (role in ('customer', 'admin'));

-- Staff can read every customer profile (for support look-ups). Customers keep
-- the owner-only policy from 0001; policies are OR-ed, so this only widens
-- access for admins.
drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin on public.profiles
  for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- is_admin(): true when the caller's profile is an admin. security definer so
-- it can read profiles regardless of the caller's own RLS, and stable so the
-- planner can cache it within a statement. Referenced by the policies above and
-- below, so it is created first with a guard for the forward reference.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- Admin visibility over orders. These are additional (permissive) policies, so
-- customers still see only their own orders and admins see everything.
-- ---------------------------------------------------------------------------
drop policy if exists orders_select_admin on public.orders;
create policy orders_select_admin on public.orders
  for select using (public.is_admin());

drop policy if exists order_items_select_admin on public.order_items;
create policy order_items_select_admin on public.order_items
  for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- set_order_status: advance an order through the fulfilment states. Admin only.
-- ---------------------------------------------------------------------------
create or replace function public.set_order_status(
  p_order_id uuid,
  p_status   text
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  if p_status not in ('confirmed', 'packing', 'shipped', 'delivered', 'cancelled') then
    raise exception 'Unknown status: %', p_status using errcode = '22023';
  end if;

  update public.orders
  set status = p_status
  where id = p_order_id
  returning * into v_order;

  if not found then
    raise exception 'No such order' using errcode = '22023';
  end if;

  return v_order;
end;
$$;

revoke all on function public.set_order_status(uuid, text) from public;
grant execute on function public.set_order_status(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_set_stock: set a product's stock to an absolute figure from the admin
-- UI, recording the difference in the ledger so the "why is stock N?" trail
-- stays complete. Admin only.
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_stock(
  p_slug  text,
  p_stock integer,
  p_note  text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old   integer;
  v_delta integer;
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  if p_stock is null or p_stock < 0 then
    raise exception 'Stock must be zero or more' using errcode = '22023';
  end if;

  select stock into v_old from public.products where slug = p_slug for update;
  if not found then
    raise exception 'No such product: %', p_slug using errcode = '22023';
  end if;

  v_delta := p_stock - v_old;
  update public.products set stock = p_stock where slug = p_slug;

  if v_delta <> 0 then
    insert into public.stock_movements (product_slug, delta, reason, note)
    values (
      p_slug,
      v_delta,
      case when v_delta > 0 then 'restock' else 'adjustment' end,
      coalesce(p_note, 'Set from admin')
    );
  end if;

  return p_stock;
end;
$$;

revoke all on function public.admin_set_stock(text, integer, text) from public;
grant execute on function public.admin_set_stock(text, integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_update_product: edit the catalogue numbers the database owns — price,
-- the struck-through "was" price, the low-stock threshold, and whether the
-- product is listed at all. Copy/images/specs still live in the front end.
-- Admin only.
-- ---------------------------------------------------------------------------
create or replace function public.admin_update_product(
  p_slug            text,
  p_price_pence     integer,
  p_was_price_pence integer,
  p_low_stock_at    integer,
  p_active          boolean
)
returns public.products
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;

  if p_price_pence is null or p_price_pence < 0
     or (p_was_price_pence is not null and p_was_price_pence < 0)
     or p_low_stock_at is null or p_low_stock_at < 0 then
    raise exception 'Prices and thresholds cannot be negative' using errcode = '22023';
  end if;

  update public.products
  set price_pence     = p_price_pence,
      was_price_pence = p_was_price_pence,
      low_stock_at    = p_low_stock_at,
      active          = p_active
  where slug = p_slug
  returning * into v_product;

  if not found then
    raise exception 'No such product: %', p_slug using errcode = '22023';
  end if;

  return v_product;
end;
$$;

revoke all on function public.admin_update_product(text, integer, integer, integer, boolean) from public;
grant execute on function public.admin_update_product(text, integer, integer, integer, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Make yourself an admin. Run this once, with your own email, after signing up:
--
--   update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'you@example.com');
-- ---------------------------------------------------------------------------
