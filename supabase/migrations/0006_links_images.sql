-- Links + preview images per submission version.
-- source_url: the restaurant's happy-hour/menu page (tracking params stripped
-- server-side). image_url: og:image scraped from that page at add time —
-- becomes the card/hero photo until someone uploads a real dish photo.

alter table submissions add column if not exists source_url text;
alter table submissions add column if not exists image_url text;
