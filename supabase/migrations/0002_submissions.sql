-- Community submissions: one row per reviewed menu-photo upload.
-- Deliberately denormalized (deals as jsonb) for the v1 moderation loop;
-- approval later graduates rows into restaurants/deals proper.

create type submission_status as enum ('pending', 'approved', 'rejected');

create table submissions (
  id uuid primary key default gen_random_uuid(),
  restaurant_name text not null,
  neighborhood text,
  days text[] not null default '{}', -- 'mon'..'sun'
  start_time time,
  end_time time,
  deals jsonb not null, -- [{item, price, category, description}]
  photo_path text,      -- storage path of the source menu photo
  status submission_status not null default 'pending',
  submitter_ip_hash text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index submissions_status_idx on submissions (status, created_at desc);

-- Service-role only: no anon/authenticated policies. All access goes through
-- server routes (submit + moderation), which enforce their own auth.
alter table submissions enable row level security;

-- Storage: create a bucket named 'uploads' (public read) in the dashboard or:
--   insert into storage.buckets (id, name, public) values ('uploads', 'uploads', true);
