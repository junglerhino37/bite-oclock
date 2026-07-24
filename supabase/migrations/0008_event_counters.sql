-- Generic event counters in site_stats ("Take me there" clicks etc.) —
-- upsert-increment so new keys create themselves.

create or replace function bump_stat(k text) returns bigint
language sql
security definer
as $$
  insert into site_stats (key, value) values (k, 1)
  on conflict (key) do update set value = site_stats.value + 1
  returning value;
$$;
