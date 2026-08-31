-- Northbridge storefront — Claude API usage & cost ledger ("the Claude bill").
-- Run this AFTER 0004_payments.sql, in the Supabase SQL editor.
-- Idempotent: re-running will not drop rows or reset recorded costs.
--
-- What this is for
--   The FAQ assistant (src/server/chat.ts) calls the Anthropic API on every
--   free-form question. This migration records one row per call — tokens in,
--   tokens out, and the pound/dollar cost — so "what is Claude costing us?"
--   has an answer that lives next to the rest of the shop's data.
--
-- Access model (server/admin only)
--   Both tables have row level security enabled and NO policies, so the anon
--   and authenticated roles cannot see or touch them at all. Writes happen
--   through record_claude_usage(), a SECURITY DEFINER function granted only to
--   service_role — call it from the server with the service-role key. Read the
--   ledger from the Supabase dashboard or with the service-role key.

-- ---------------------------------------------------------------------------
-- claude_pricing: the rate card. Cost is frozen onto each usage row at insert
-- time from these numbers, so editing a rate here only affects future calls —
-- past bills stay at the price they were charged.
--
-- Rates are US dollars per 1,000,000 tokens, matching Anthropic's published
-- pricing. Update them here when Anthropic's pricing changes.
-- ---------------------------------------------------------------------------
create table if not exists public.claude_pricing (
  model                     text primary key,
  input_usd_per_mtok        numeric(10, 4) not null check (input_usd_per_mtok >= 0),
  output_usd_per_mtok       numeric(10, 4) not null check (output_usd_per_mtok >= 0),
  cache_read_usd_per_mtok   numeric(10, 4) not null default 0 check (cache_read_usd_per_mtok >= 0),
  cache_write_usd_per_mtok  numeric(10, 4) not null default 0 check (cache_write_usd_per_mtok >= 0),
  updated_at                timestamptz not null default now()
);

alter table public.claude_pricing enable row level security;
-- Deliberately no policies: invisible to anon/authenticated.

-- Seed the current rate card. on conflict do nothing so a re-run never
-- overwrites a rate you have since corrected by hand.
insert into public.claude_pricing
  (model, input_usd_per_mtok, output_usd_per_mtok, cache_read_usd_per_mtok, cache_write_usd_per_mtok)
values
  ('claude-opus-5',   5.00, 25.00, 0.50, 6.25),
  ('claude-opus-4-8', 5.00, 25.00, 0.50, 6.25),
  ('claude-sonnet-5', 2.00, 10.00, 0.20, 2.50),
  ('claude-haiku-4-5', 1.00,  5.00, 0.10, 1.25)
on conflict (model) do nothing;

-- ---------------------------------------------------------------------------
-- claude_usage: one row per Anthropic API call. cost_usd is computed once at
-- insert time and stored, so totals never need the pricing join and a later
-- rate change cannot rewrite history.
-- ---------------------------------------------------------------------------
create table if not exists public.claude_usage (
  id                  bigint generated always as identity primary key,
  created_at          timestamptz not null default now(),
  model               text not null,
  source              text not null default 'chat',
  input_tokens        integer not null default 0 check (input_tokens >= 0),
  output_tokens       integer not null default 0 check (output_tokens >= 0),
  cache_read_tokens   integer not null default 0 check (cache_read_tokens >= 0),
  cache_write_tokens  integer not null default 0 check (cache_write_tokens >= 0),
  cost_usd            numeric(12, 6) not null default 0 check (cost_usd >= 0),
  -- Nullable: the server may record a call it can't attribute to a signed-in
  -- shopper. No FK to auth.users so a deleted user never deletes the bill.
  user_id             uuid,
  meta                jsonb
);

create index if not exists claude_usage_created_at_idx
  on public.claude_usage (created_at desc);

alter table public.claude_usage enable row level security;
-- Deliberately no policies: invisible to anon/authenticated. Writes go through
-- record_claude_usage() below; reads come from the dashboard or service_role.

-- ---------------------------------------------------------------------------
-- record_claude_usage(): the prepared endpoint. Looks up the rate card, freezes
-- the cost onto the row, and returns the new row id. SECURITY DEFINER so it can
-- write to a table with no policies; granted to service_role only.
--
-- An unknown model (one not in claude_pricing) still records — tokens are kept
-- and cost_usd falls back to 0, so a new model never silently drops usage.
-- ---------------------------------------------------------------------------
create or replace function public.record_claude_usage(
  p_model              text,
  p_input_tokens       integer,
  p_output_tokens      integer,
  p_cache_read_tokens  integer default 0,
  p_cache_write_tokens integer default 0,
  p_source             text default 'chat',
  p_user_id            uuid default null,
  p_meta               jsonb default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_price public.claude_pricing%rowtype;
  v_cost  numeric(12, 6);
  v_in    integer := greatest(coalesce(p_input_tokens, 0), 0);
  v_out   integer := greatest(coalesce(p_output_tokens, 0), 0);
  v_cr    integer := greatest(coalesce(p_cache_read_tokens, 0), 0);
  v_cw    integer := greatest(coalesce(p_cache_write_tokens, 0), 0);
  v_id    bigint;
begin
  if p_model is null or p_model = '' then
    raise exception 'A model is required' using errcode = '22023';
  end if;

  select * into v_price from public.claude_pricing where model = p_model;

  v_cost := round(
    v_in / 1000000.0 * coalesce(v_price.input_usd_per_mtok, 0)
    + v_out / 1000000.0 * coalesce(v_price.output_usd_per_mtok, 0)
    + v_cr / 1000000.0 * coalesce(v_price.cache_read_usd_per_mtok, 0)
    + v_cw / 1000000.0 * coalesce(v_price.cache_write_usd_per_mtok, 0),
    6
  );

  insert into public.claude_usage (
    model, source, input_tokens, output_tokens,
    cache_read_tokens, cache_write_tokens, cost_usd, user_id, meta
  )
  values (
    p_model, coalesce(nullif(p_source, ''), 'chat'), v_in, v_out,
    v_cr, v_cw, v_cost, p_user_id, p_meta
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_claude_usage(text, integer, integer, integer, integer, text, uuid, jsonb) from public;
grant execute on function public.record_claude_usage(text, integer, integer, integer, integer, text, uuid, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- claude_usage_daily: the bill at a glance — one row per day per model, with
-- call count, token totals and the day's spend. Read it from the dashboard or
-- with the service-role key (the underlying table has no anon/authenticated
-- policies, so this view is equally invisible to them).
-- ---------------------------------------------------------------------------
create or replace view public.claude_usage_daily as
select
  (created_at at time zone 'UTC')::date as usage_date,
  model,
  count(*)                              as calls,
  sum(input_tokens)                     as input_tokens,
  sum(output_tokens)                    as output_tokens,
  sum(cache_read_tokens)                as cache_read_tokens,
  sum(cache_write_tokens)               as cache_write_tokens,
  round(sum(cost_usd), 4)               as cost_usd
from public.claude_usage
group by 1, 2
order by 1 desc, 2;
