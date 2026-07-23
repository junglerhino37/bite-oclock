-- Bite o'Clock — initial schema
-- Postgres + PostGIS on Supabase. RLS is default-deny: the public reads only
-- approved rows; all writes land in pending state via server routes.

create extension if not exists postgis;
create extension if not exists pg_trgm;

-- ————— restaurants —————
create table restaurants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  address text,
  location geography(point, 4326) not null,
  neighborhood text,
  source text not null default 'manual', -- 'overture' | 'fsq' | 'manual' | 'submission'
  created_at timestamptz not null default now()
);
create index restaurants_location_idx on restaurants using gist (location);
create index restaurants_name_trgm_idx on restaurants using gin (name gin_trgm_ops);

-- ————— deals —————
create type deal_status as enum ('pending', 'published', 'expired', 'rejected');

create table deals (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  item text not null,
  price text,
  category text not null check (category in
    ('texmex','seafood','barfood','sushi','vietcajun','pizza','burgers','veg')),
  days int[] not null default '{}', -- 0=mon .. 6=sun
  start_time time,
  end_time time,
  status deal_status not null default 'pending',
  source_photo_id uuid,
  submitted_by uuid, -- auth.users id; nullable for imported seed data
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
create index deals_restaurant_idx on deals (restaurant_id);
create index deals_status_idx on deals (status);

-- ————— photos (menus + dishes) —————
create type photo_kind as enum ('menu', 'dish');
create type photo_status as enum ('pending', 'published', 'rejected');

create table photos (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references restaurants (id) on delete cascade,
  deal_id uuid references deals (id) on delete set null,
  kind photo_kind not null,
  storage_path text not null, -- re-encoded WebP variants only; originals deleted
  status photo_status not null default 'pending',
  submitted_by uuid,
  created_at timestamptz not null default now()
);
alter table deals
  add constraint deals_source_photo_fk
  foreign key (source_photo_id) references photos (id) on delete set null;

-- ————— moderation + abuse —————
create table reports (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references deals (id) on delete cascade,
  photo_id uuid references photos (id) on delete cascade,
  reason text not null,
  reporter_ip_hash text,
  created_at timestamptz not null default now()
);

create table ai_usage (
  id bigint generated always as identity primary key,
  endpoint text not null, -- 'extract' | 'ask'
  ip_hash text not null,
  user_id uuid,
  input_tokens int,
  output_tokens int,
  created_at timestamptz not null default now()
);
create index ai_usage_window_idx on ai_usage (endpoint, ip_hash, created_at);

-- ————— row level security: default deny —————
alter table restaurants enable row level security;
alter table deals enable row level security;
alter table photos enable row level security;
alter table reports enable row level security;
alter table ai_usage enable row level security;

-- Public (anon) may read restaurants and only published content.
create policy "anon read restaurants" on restaurants for select using (true);
create policy "anon read published deals" on deals for select using (status = 'published');
create policy "anon read published photos" on photos for select using (status = 'published');

-- Authenticated users may insert pending content only (their own).
create policy "auth insert pending deals" on deals for insert
  with check (auth.uid() = submitted_by and status = 'pending');
create policy "auth insert pending photos" on photos for insert
  with check (auth.uid() = submitted_by and status = 'pending');
create policy "auth insert reports" on reports for insert
  with check (auth.role() = 'authenticated');

-- Moderators (JWT claim role=moderator) manage everything.
create policy "moderator all deals" on deals for all
  using ((auth.jwt() ->> 'user_role') = 'moderator');
create policy "moderator all photos" on photos for all
  using ((auth.jwt() ->> 'user_role') = 'moderator');
create policy "moderator read reports" on reports for select
  using ((auth.jwt() ->> 'user_role') = 'moderator');

-- ai_usage: server-only (service role bypasses RLS); no client policies.
