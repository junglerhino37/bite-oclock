-- Community verification: votes replace the human moderation queue.
-- Anyone can vote "still current" (+1) or "outdated" (-1) on a deal or on a
-- spot's happy-hour times; the latest +1 becomes the "last verified" date.
-- Submissions gain spot_slug so a new menu photo / hours edit can target an
-- existing restaurant instead of always creating a new one.

alter table submissions add column if not exists spot_slug text;
create index if not exists submissions_spot_slug_idx
  on submissions (spot_slug, created_at desc);

create table votes (
  id uuid primary key default gen_random_uuid(),
  spot_slug text not null,
  kind text not null check (kind in ('deal', 'hours')),
  target text not null default '', -- deal item name; '' when kind = 'hours'
  vote smallint not null check (vote in (-1, 1)),
  voter text not null,             -- 'u:<auth user id>' or 'ip:<hash>'
  created_at timestamptz not null default now(),
  unique (spot_slug, kind, target, voter)
);
create index votes_slug_idx on votes (spot_slug);

-- Service-role only, same model as submissions: all access goes through
-- server routes, which pick the voter identity themselves.
alter table votes enable row level security;
