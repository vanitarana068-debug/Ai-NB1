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
