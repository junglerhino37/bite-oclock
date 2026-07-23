-- Submitter notes + multiple menu photos per submission.
-- photo_path stays (first photo) for backward compatibility; photo_paths
-- holds the full ordered set.

alter table submissions add column if not exists note text;
alter table submissions add column if not exists photo_paths text[];
