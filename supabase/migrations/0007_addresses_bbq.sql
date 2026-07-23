-- Community spots get real addresses + coordinates (geocoded server-side at
-- submit time via Nominatim) so they show on the map and in distance sorts.
-- Per-deal days ride inside the deals jsonb — no schema change needed.

alter table submissions add column if not exists address text;
alter table submissions add column if not exists lat double precision;
alter table submissions add column if not exists lng double precision;

-- New 'bbq' category. The legacy deals table (0001, unused by the live
-- submissions flow) carries an inline check constraint — refresh it so the
-- schema stays honest.
alter table deals drop constraint if exists deals_category_check;
alter table deals add constraint deals_category_check check (category in
  ('texmex','seafood','barfood','bbq','sushi','vietcajun','pizza','burgers','veg'));
