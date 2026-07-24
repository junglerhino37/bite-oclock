-- Day-accurate hours per submission version: {"mon": {"start":"08:00","end":"22:00"}, ...}
-- Present when an all-day deal is bounded to the business's real hours
-- (from Google Places). Overrides start_time/end_time per day.

alter table submissions add column if not exists hours jsonb;
