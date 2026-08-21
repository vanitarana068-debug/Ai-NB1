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
