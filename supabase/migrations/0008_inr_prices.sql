-- Northbridge storefront — reprice the catalogue from GBP to INR.
-- Run this in the Supabase SQL editor. Idempotent: it sets absolute values, so
-- re-running never doubles the price, and it does not touch stock.
--
-- Rate used: 1 GBP = ₹105. The stored figures were historically GBP-shaped
-- (minor units = pence) but are charged in INR; this converts them to realistic
-- rupee amounts (minor units = paise) so the amount charged matches the amount
-- shown. These values match src/data/products.ts exactly. Adjust the rate by
-- re-deriving both together if you want a different exchange rate.

update public.products as p set
  price_pence     = v.price_pence,
  was_price_pence = v.was_price_pence
from (values
  ('nordvane-aero-14',    13639500, 15214500),
  ('nordvane-raider-16',  19414500, null),
  ('kestrel-nova-9',       7864500,  8389500),
  ('kestrel-slate-11',     4504500, null),
  ('aurex-quietude-900',   3454500,  3979500),
  ('meridian-vista-27',    5764500, null),
  ('meridian-tactile-75',  1459500, null),
  ('meridian-glide-pro',    829500, null),
  ('corvus-rx-9070',       7234500,  7864500),
  ('corvus-apex-9',        5554500, null),
  ('helix-torrent-2tb',    1774500, null),
  ('beacon-mesh-ax6600',   2614500, null),
  ('beacon-hub-mini',      1249500, null),
  ('volta-gan-100w',        619500, null)
) as v(slug, price_pence, was_price_pence)
where p.slug = v.slug;
