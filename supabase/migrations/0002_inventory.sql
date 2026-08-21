-- Northbridge storefront — inventory and transactional order placement.
-- Run this AFTER 0001_init.sql, in the Supabase SQL editor.
-- Idempotent: re-running will not reset live stock levels.

-- ---------------------------------------------------------------------------
-- products: the database owns price and stock. Copy, images and specs stay in
-- src/data/products.ts; only the numbers that change over time live here.
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  slug            text primary key,
  name            text not null,
  brand           text not null,
  category        text not null,
  price_pence     integer not null check (price_pence >= 0),
  was_price_pence integer check (was_price_pence >= 0),
  stock           integer not null default 0 check (stock >= 0),
  low_stock_at    integer not null default 8 check (low_stock_at >= 0),
  active          boolean not null default true,
  updated_at      timestamptz not null default now()
);

drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at
  before update on public.products
  for each row execute function public.touch_updated_at();

alter table public.products enable row level security;

-- The catalogue is public: shoppers need stock counts before they sign in.
drop policy if exists products_select_all on public.products;
create policy products_select_all on public.products
  for select using (true);

-- Deliberately no insert/update/delete policy. Stock moves only through
-- place_order() and restock() below, both of which run as the definer.

-- ---------------------------------------------------------------------------
-- stock_movements: an append-only ledger, so "why is stock 4?" has an answer.
-- No RLS policies at all, so it is invisible to the anon and authenticated
-- roles; read it from the dashboard or with the service_role key.
-- ---------------------------------------------------------------------------
create table if not exists public.stock_movements (
  id           bigint generated always as identity primary key,
  product_slug text not null references public.products (slug) on delete cascade,
  order_id     uuid references public.orders (id) on delete set null,
  delta        integer not null check (delta <> 0),
  reason       text not null check (reason in ('sale', 'restock', 'adjustment', 'cancellation')),
  note         text,
  created_at   timestamptz not null default now()
);

create index if not exists stock_movements_product_slug_idx
  on public.stock_movements (product_slug, created_at desc);

alter table public.stock_movements enable row level security;

-- ---------------------------------------------------------------------------
-- place_order: one transaction that checks stock, decrements it, writes the
-- order and its lines, and records the ledger entries.
--
-- Doing this from the browser in separate round trips would let two shoppers
-- both buy the last unit, and would let a caller name their own price. Here
-- prices come from the products table and the rows are locked while we work.
--
-- p_items is [{"slug": "...", "quantity": 2}, ...].
-- ---------------------------------------------------------------------------
create or replace function public.place_order(
  p_full_name      text,
  p_email          text,
  p_address1       text,
  p_address2       text,
  p_city           text,
  p_postcode       text,
  p_delivery_speed text,
  p_items          jsonb
)
returns table (order_id uuid, reference text, subtotal_pence integer, shipping_pence integer, total_pence integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Keep these in step with FREE_DELIVERY_THRESHOLD / DELIVERY_FEE in
  -- src/lib/cart.tsx and EXPRESS_FEE in src/routes/checkout.tsx.
  c_free_delivery_threshold constant integer := 5000;
  c_delivery_fee            constant integer := 499;
  c_express_fee             constant integer := 699;

  v_user     uuid := auth.uid();
  v_item     record;
  v_product  public.products%rowtype;
  v_order    public.orders%rowtype;
  v_subtotal integer := 0;
  v_shipping integer;
begin
  if v_user is null then
    raise exception 'You need to be signed in to place an order'
      using errcode = '42501';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Your basket is empty'
      using errcode = '22023';
  end if;

  if p_delivery_speed not in ('standard', 'express') then
    raise exception 'Unknown delivery speed: %', p_delivery_speed
      using errcode = '22023';
  end if;

  -- Pass one: lock each product row in a stable order (so two concurrent
  -- checkouts can't deadlock), validate availability, and total it up.
  for v_item in
    select (elem ->> 'slug')::text as slug,
           (elem ->> 'quantity')::integer as quantity
    from jsonb_array_elements(p_items) as elem
    order by 1
  loop
    if v_item.quantity is null or v_item.quantity <= 0 then
      raise exception 'Invalid quantity for %', v_item.slug
        using errcode = '22023';
    end if;

    select * into v_product
    from public.products
    where slug = v_item.slug and active
    for update;

    if not found then
      raise exception 'That product is no longer available'
        using errcode = '22023';
    end if;

    if v_product.stock < v_item.quantity then
      raise exception '% — only % left in stock', v_product.name, v_product.stock
        using errcode = '23514';
    end if;

    v_subtotal := v_subtotal + v_product.price_pence * v_item.quantity;
  end loop;

  v_shipping := case
    when p_delivery_speed = 'express' then c_express_fee
    when v_subtotal >= c_free_delivery_threshold then 0
    else c_delivery_fee
  end;

  insert into public.orders (
    user_id, full_name, email, address1, address2, city, postcode,
    delivery_speed, subtotal_pence, shipping_pence, total_pence
  )
  values (
    v_user, p_full_name, p_email, p_address1, nullif(p_address2, ''), p_city, p_postcode,
    p_delivery_speed, v_subtotal, v_shipping, v_subtotal + v_shipping
  )
  returning * into v_order;

  -- Pass two: the rows are already locked, so this cannot oversell.
  for v_item in
    select (elem ->> 'slug')::text as slug,
           (elem ->> 'quantity')::integer as quantity
    from jsonb_array_elements(p_items) as elem
    order by 1
  loop
    select * into v_product from public.products where slug = v_item.slug;

    insert into public.order_items (
      order_id, product_slug, product_name, unit_price_pence, quantity
    )
    values (
      v_order.id, v_product.slug, v_product.name, v_product.price_pence, v_item.quantity
    );

    update public.products
    set stock = stock - v_item.quantity
    where slug = v_item.slug;

    insert into public.stock_movements (product_slug, order_id, delta, reason)
    values (v_item.slug, v_order.id, -v_item.quantity, 'sale');
  end loop;

  return query
  select v_order.id, v_order.reference, v_order.subtotal_pence,
         v_order.shipping_pence, v_order.total_pence;
end;
$$;

revoke all on function public.place_order(text, text, text, text, text, text, text, jsonb) from public;
grant execute on function public.place_order(text, text, text, text, text, text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- restock: for warehouse use from the SQL editor, e.g.
--   select public.restock('aurex-quietude-900', 25, 'Delivery from supplier');
-- Not granted to anon or authenticated, so the storefront cannot call it.
-- ---------------------------------------------------------------------------
create or replace function public.restock(
  p_slug     text,
  p_quantity integer,
  p_note     text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock integer;
begin
  if p_quantity = 0 then
    raise exception 'Quantity must not be zero' using errcode = '22023';
  end if;

  update public.products
  set stock = stock + p_quantity
  where slug = p_slug
  returning stock into v_stock;

  if not found then
    raise exception 'No such product: %', p_slug using errcode = '22023';
  end if;

  insert into public.stock_movements (product_slug, delta, reason, note)
  values (p_slug, p_quantity, case when p_quantity > 0 then 'restock' else 'adjustment' end, p_note);

  return v_stock;
end;
$$;

revoke all on function public.restock(text, integer, text) from public;

-- ---------------------------------------------------------------------------
-- Handy read-only views for keeping an eye on the shop.
--
-- security_invoker keeps the caller's RLS in force rather than the view owner's,
-- so product_sales only totals up rows the caller can see: run it from the SQL
-- editor or with the service_role key for shop-wide figures. A signed-in
-- shopper querying it would only ever see their own purchases.
-- ---------------------------------------------------------------------------
create or replace view public.low_stock
with (security_invoker = true) as
  select slug, name, brand, category, stock, low_stock_at
  from public.products
  where active and stock <= low_stock_at
  order by stock asc;

-- Units sold and revenue per product, from the order lines.
create or replace view public.product_sales
with (security_invoker = true) as
  select p.slug,
         p.name,
         p.stock,
         coalesce(sum(oi.quantity), 0) as units_sold,
         coalesce(sum(oi.line_total_pence), 0) as revenue_pence
  from public.products p
  left join public.order_items oi on oi.product_slug = p.slug
  group by p.slug, p.name, p.stock
  order by units_sold desc;

-- ---------------------------------------------------------------------------
-- Seed the catalogue. On re-run the descriptive columns and prices are
-- refreshed but stock is left alone, so this never undoes real sales.
-- ---------------------------------------------------------------------------
insert into public.products (slug, name, brand, category, price_pence, was_price_pence, stock) values
  ('nordvane-aero-14', 'Nordvane Aero 14', 'Nordvane', 'laptops', 129900, 144900, 12),
  ('nordvane-raider-16', 'Nordvane Raider 16', 'Nordvane', 'laptops', 184900, null, 6),
  ('kestrel-nova-9', 'Kestrel Nova 9', 'Kestrel', 'mobile', 74900, 79900, 24),
  ('kestrel-slate-11', 'Kestrel Slate 11', 'Kestrel', 'mobile', 42900, null, 18),
  ('aurex-quietude-900', 'Aurex Quietude 900', 'Aurex', 'audio', 32900, 37900, 31),
  ('meridian-vista-27', 'Meridian Vista 27', 'Meridian', 'displays', 54900, null, 9),
  ('meridian-tactile-75', 'Meridian Tactile 75', 'Meridian', 'displays', 13900, null, 27),
  ('meridian-glide-pro', 'Meridian Glide Pro', 'Meridian', 'displays', 7900, null, 45),
  ('corvus-rx-9070', 'Corvus RX 9070', 'Corvus', 'components', 68900, 74900, 7),
  ('corvus-apex-9', 'Corvus Apex 9', 'Corvus', 'components', 52900, null, 14),
  ('helix-torrent-2tb', 'Helix Torrent 2TB', 'Helix', 'components', 16900, null, 38),
  ('beacon-mesh-ax6600', 'Beacon Mesh AX6600', 'Beacon', 'connected', 24900, null, 16),
  ('beacon-hub-mini', 'Beacon Hub Mini', 'Beacon', 'connected', 11900, null, 22),
  ('volta-gan-100w', 'Volta GaN 100W', 'Volta', 'connected', 5900, null, 60)
on conflict (slug) do update set
  name            = excluded.name,
  brand           = excluded.brand,
  category        = excluded.category,
  price_pence     = excluded.price_pence,
  was_price_pence = excluded.was_price_pence;
