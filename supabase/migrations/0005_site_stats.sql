-- Site stats: visit counter for the footer ("visited X times").
-- Single-row-per-key table + an atomic bump function (PostgREST can't do
-- value = value + 1 expressions). Service-role only via /api/stats.

create table site_stats (
  key text primary key,
  value bigint not null default 0
);
insert into site_stats (key, value) values ('visits', 0);

create or replace function bump_visits() returns bigint
language sql
security definer
as $$
  update site_stats set value = value + 1 where key = 'visits' returning value;
$$;

alter table site_stats enable row level security;
