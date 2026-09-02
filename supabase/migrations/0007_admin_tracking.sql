-- Northbridge storefront — admin inventory & price tracking.
-- Run this AFTER 0006_admin.sql, in the Supabase SQL editor. Idempotent.
--
-- Adds two things the admin panel shows as a product's "History":
--   * read access to the existing stock_movements ledger (inventory tracking)
--   * a product_price_history table that records every price change (price
--     tracking), written automatically by admin_update_product().

-- ---------------------------------------------------------------------------
-- Inventory tracking: 0002 created stock_movements with RLS on and no policies,
-- so it's invisible to everyone. Let admins read it (the ledger is still never
-- written from the client — only definer functions touch it).
-- ---------------------------------------------------------------------------
drop policy if exists stock_movements_select_admin on public.stock_movements;
create policy stock_movements_select_admin on public.stock_movements
  for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Price tracking: one row per price change. Written only by the definer
-- function below; readable only by admins.
-- ---------------------------------------------------------------------------
create table if not exists public.product_price_history (
  id                  bigint generated always as identity primary key,
  product_slug        text not null references public.products (slug) on delete cascade,
  old_price_pence     integer,
  new_price_pence     integer not null,
  old_was_price_pence integer,
  new_was_price_pence integer,
  changed_by          uuid,
  changed_at          timestamptz not null default now()
);

create index if not exists product_price_history_slug_idx
  on public.product_price_history (product_slug, changed_at desc);

alter table public.product_price_history enable row level security;

drop policy if exists price_history_select_admin on public.product_price_history;
create policy price_history_select_admin on public.product_price_history
  for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Redefine admin_update_product (from 0006) so it logs a price-history row
-- whenever the price or the struck-through "was" price actually changes.
-- Everything else is identical.
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
  v_old     public.products%rowtype;
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

  select * into v_old from public.products where slug = p_slug for update;
  if not found then
    raise exception 'No such product: %', p_slug using errcode = '22023';
  end if;

  update public.products
  set price_pence     = p_price_pence,
      was_price_pence = p_was_price_pence,
      low_stock_at    = p_low_stock_at,
      active          = p_active
  where slug = p_slug
  returning * into v_product;

  -- Only record a row when a price genuinely moved.
  if v_old.price_pence is distinct from p_price_pence
     or v_old.was_price_pence is distinct from p_was_price_pence then
    insert into public.product_price_history (
      product_slug, old_price_pence, new_price_pence,
      old_was_price_pence, new_was_price_pence, changed_by
    )
    values (
      p_slug, v_old.price_pence, p_price_pence,
      v_old.was_price_pence, p_was_price_pence, auth.uid()
    );
  end if;

  return v_product;
end;
$$;

revoke all on function public.admin_update_product(text, integer, integer, integer, boolean) from public;
grant execute on function public.admin_update_product(text, integer, integer, integer, boolean) to authenticated;
