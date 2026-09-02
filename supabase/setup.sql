-- Northbridge storefront — complete database setup.
--
-- Paste this whole file into the Supabase SQL editor and press Run:
--   https://supabase.com/dashboard/project/cpcisbkwcywnwfsvfmkj/sql/new
--
-- Generated from supabase/migrations/0001..0004, concatenated in order.
-- If you change a migration, regenerate this file rather than editing it.
-- Idempotent: re-running will not reset stock or delete orders.


-- ===========================================================================
-- 0001_init.sql
-- ===========================================================================

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

-- ===========================================================================
-- 0002_inventory.sql
-- ===========================================================================

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

-- ===========================================================================
-- 0003_reviews.sql
-- ===========================================================================

-- Northbridge storefront — customer reviews.
-- Run this AFTER 0002_inventory.sql, in the Supabase SQL editor.
-- Idempotent: re-running will not delete reviews that shoppers have written.

-- ---------------------------------------------------------------------------
-- reviews: one review per shopper per product.
--
-- The database owns the two fields a reviewer must not be able to set for
-- themselves: `verified` (did they actually buy it?) is computed on insert from
-- their order history, and the helpful count is not stored here at all — it is
-- counted from review_votes below, so it cannot drift or be inflated.
--
-- author_name is copied in rather than joined from profiles, the same way
-- order_items copies product_name: the review should keep reading the way it
-- did when it was written, even if the account is renamed later.
-- ---------------------------------------------------------------------------
create table if not exists public.reviews (
  id           bigint generated always as identity primary key,
  product_slug text not null references public.products (slug) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  author_name  text not null,
  rating       integer not null check (rating between 1 and 5),
  title        text not null check (length(btrim(title)) > 0),
  body         text not null check (length(btrim(body)) > 0),
  verified     boolean not null default false,
  status       text not null default 'published'
                 check (status in ('published', 'hidden')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (product_slug, user_id)
);

create index if not exists reviews_product_slug_created_at_idx
  on public.reviews (product_slug, created_at desc);

drop trigger if exists reviews_touch_updated_at on public.reviews;
create trigger reviews_touch_updated_at
  before update on public.reviews
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- review_votes: the "was this helpful?" ledger, one vote per shopper per
-- review. Votes are world-readable so the count on the page is the real total
-- rather than only the rows the caller happens to own — the row is just a
-- (review, user) pair, and the storefront never renders who voted.
-- ---------------------------------------------------------------------------
create table if not exists public.review_votes (
  review_id  bigint not null references public.reviews (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Verified-purchase check. security definer because it reads the order tables,
-- which RLS otherwise limits to the caller's own rows — the insert policy below
-- already pins user_id to auth.uid(), so this can only ever look at the
-- reviewer's own order history.
-- ---------------------------------------------------------------------------
create or replace function public.reviews_set_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.verified := exists (
    select 1
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.user_id = new.user_id
      and oi.product_slug = new.product_slug
  );
  return new;
end;
$$;

drop trigger if exists reviews_set_verified on public.reviews;
create trigger reviews_set_verified
  before insert on public.reviews
  for each row execute function public.reviews_set_verified();

-- Editing a review may change the rating and the words, nothing else. Without
-- this an author could flip their own verified badge on, or move the review
-- onto a product they never bought.
create or replace function public.reviews_guard_derived()
returns trigger
language plpgsql
as $$
begin
  -- id needs no guard: Postgres already refuses to update an identity column.
  new.product_slug := old.product_slug;
  new.user_id      := old.user_id;
  new.verified     := old.verified;
  new.status       := old.status;
  new.created_at   := old.created_at;
  return new;
end;
$$;

drop trigger if exists reviews_guard_derived on public.reviews;
create trigger reviews_guard_derived
  before update on public.reviews
  for each row execute function public.reviews_guard_derived();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.reviews enable row level security;

-- Published reviews are public; a hidden one stays visible to its author.
drop policy if exists reviews_select_published on public.reviews;
create policy reviews_select_published on public.reviews
  for select using (status = 'published' or user_id = auth.uid());

drop policy if exists reviews_insert_own on public.reviews;
create policy reviews_insert_own on public.reviews
  for insert with check (auth.uid() = user_id);

drop policy if exists reviews_update_own on public.reviews;
create policy reviews_update_own on public.reviews
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists reviews_delete_own on public.reviews;
create policy reviews_delete_own on public.reviews
  for delete using (auth.uid() = user_id);

alter table public.review_votes enable row level security;

drop policy if exists review_votes_select_all on public.review_votes;
create policy review_votes_select_all on public.review_votes
  for select using (true);

drop policy if exists review_votes_insert_own on public.review_votes;
create policy review_votes_insert_own on public.review_votes
  for insert with check (auth.uid() = user_id);

-- Voting is a toggle, so a shopper can take their own vote back.
drop policy if exists review_votes_delete_own on public.review_votes;
create policy review_votes_delete_own on public.review_votes
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Read models for the product page.
--
-- security_invoker keeps the caller's RLS in force, so a hidden review stays
-- hidden from everyone but its author.
-- ---------------------------------------------------------------------------
create or replace view public.reviews_public
with (security_invoker = true) as
  select r.id,
         r.product_slug,
         r.user_id,
         r.author_name,
         r.rating,
         r.title,
         r.body,
         r.verified,
         r.status,
         r.created_at,
         r.updated_at,
         (select count(*) from public.review_votes v where v.review_id = r.id)::integer
           as helpful_count,
         exists (
           select 1 from public.review_votes v
           where v.review_id = r.id and v.user_id = auth.uid()
         ) as voted_by_me
  from public.reviews r;

-- Average, total and star breakdown per product — everything the summary
-- panel needs in one row, so the page does not add ratings up client side.
create or replace view public.product_ratings
with (security_invoker = true) as
  select product_slug,
         count(*)::integer as review_count,
         round(avg(rating), 2)::double precision as average_rating,
         count(*) filter (where rating = 5)::integer as five_star,
         count(*) filter (where rating = 4)::integer as four_star,
         count(*) filter (where rating = 3)::integer as three_star,
         count(*) filter (where rating = 2)::integer as two_star,
         count(*) filter (where rating = 1)::integer as one_star
  from public.reviews
  where status = 'published'
  group by product_slug;

-- ===========================================================================
-- 0004_payments.sql
-- ===========================================================================

-- Northbridge storefront — payment methods on orders.
-- Run this in the Supabase SQL editor after 0003_reviews.sql.
-- Idempotent, so re-running it is safe.

-- ---------------------------------------------------------------------------
-- orders gains how it was paid for.
--
-- payment_detail is a short, non-sensitive display string: "Visa ending 4242",
-- a UPI ID, or the wallet name. Full card numbers must never reach this table,
-- so the length check keeps anything PAN-shaped out by construction.
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists payment_method text not null default 'card',
  add column if not exists payment_detail text;

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method in ('card', 'upi', 'apple_pay', 'google_pay', 'paypal'));

alter table public.orders drop constraint if exists orders_payment_detail_check;
alter table public.orders add constraint orders_payment_detail_check
  check (payment_detail is null or char_length(payment_detail) between 1 and 64);

-- ---------------------------------------------------------------------------
-- place_order gains the two payment arguments. The old eight-argument version
-- is dropped so there is exactly one overload for PostgREST to resolve.
-- Everything else is unchanged from 0002_inventory.sql.
-- ---------------------------------------------------------------------------
drop function if exists public.place_order(text, text, text, text, text, text, text, jsonb);

create or replace function public.place_order(
  p_full_name      text,
  p_email          text,
  p_address1       text,
  p_address2       text,
  p_city           text,
  p_postcode       text,
  p_delivery_speed text,
  p_payment_method text,
  p_payment_detail text,
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
  v_detail   text;
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

  if p_payment_method not in ('card', 'upi', 'apple_pay', 'google_pay', 'paypal') then
    raise exception 'Unknown payment method: %', p_payment_method
      using errcode = '22023';
  end if;

  -- Belt and braces against a client that sends more than it should: trim to
  -- the column limit, and refuse anything that looks like a full card number.
  v_detail := nullif(left(coalesce(p_payment_detail, ''), 64), '');

  if v_detail is not null and regexp_replace(v_detail, '\D', '', 'g') ~ '\d{12,}' then
    raise exception 'Payment details must not be sent to the server'
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
    delivery_speed, payment_method, payment_detail,
    subtotal_pence, shipping_pence, total_pence
  )
  values (
    v_user, p_full_name, p_email, p_address1, nullif(p_address2, ''), p_city, p_postcode,
    p_delivery_speed, p_payment_method, v_detail,
    v_subtotal, v_shipping, v_subtotal + v_shipping
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

revoke all on function public.place_order(text, text, text, text, text, text, text, text, text, jsonb) from public;
grant execute on function public.place_order(text, text, text, text, text, text, text, text, text, jsonb) to authenticated;
