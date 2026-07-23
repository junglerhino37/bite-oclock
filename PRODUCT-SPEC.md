# Bite o'Clock — Product Spec

> It's bite o'clock somewhere in Houston — every food happy hour, mapped by the hour.

## One-liner
A crowdsourced, beautifully designed directory of every **food** happy hour in Houston, TX.

## Why
Happy hour info is scattered, stale, and drink-centric. Houstonians who care about
cheap great food have no single, current, trustworthy source. Crowdsourcing +
AI menu extraction keeps it fresh with minimal moderator effort.

## Scope
- Houston only (greater Houston area). No other cities — until Houston is nailed.
- Food happy hours are the focus; drink deals may ride along on the same menu but
  food is the organizing principle.

## Core user stories
1. **Find**: "Show me food happy hours near me right now" — map view, list view, bubble view.
2. **Filter**: by food type (oysters, tacos, sushi, wings, burgers…), time of day /
   day of week, neighborhood/location, price.
3. **Ask**: natural-language AI query — "cheap oysters near Montrose on a Tuesday at 4pm."
4. **Contribute**: snap a photo of a happy hour menu → upload → AI extracts the deals
   (items, prices, times, days) and associates them with the restaurant → lands in a
   moderation queue → published.
5. **Show off**: upload photos of the actual dishes; photos are the visual heart of the site.
6. **Trust**: deals show when they were last verified; stale deals get flagged/expired.

## Views
- **Map view**: interactive map of Houston, clustered markers, tap for deal card.
- **Bubble view**: playful dynamic packed-bubbles (food categories / deals), tap to dive in.
- **List/card view**: photo-forward cards, sortable.
- **Restaurant page**: all deals, menu photos, dish photos, hours, map snippet.

## Data model (first cut)
- `restaurants`: name, address, lat/lng, neighborhood, hours, source (OSM/Overture/manual).
- `deals`: restaurant_id, item name, food categories[], price, days[], start/end times,
  source photo, status (pending/published/expired), verified_at.
- `menu_photos`: uploaded menu images → AI extraction runs against these.
- `dish_photos`: user photos of dishes, linked to deal/restaurant.
- `submissions/moderation`: queue with status + reviewer actions.

## AI back end
- Vision extraction: menu photo → structured JSON (items, prices, times) via Claude API,
  server-side only, strict structured output schema.
- Entity resolution: match extracted restaurant to canonical restaurant record
  (name + geo proximity + fuzzy match), human-confirmable in moderation.
- NL query: user question → structured filter over the deals DB (not free-form RAG),
  so answers are grounded in actual published deals.

## Security & abuse (public repo, crowdsourced content)
- No secrets in the repo — env vars only, `.env.example` committed, keys server-side.
- All uploads validated (type, size), EXIF-stripped, content-moderated, stored
  in object storage (never in the repo / never executed).
- Rate limiting on uploads and AI endpoints; AI cost caps.
- Moderation queue before anything goes public; audit trail.
- RLS / least-privilege DB access; contributors run against their own dev instance.
- Prompt-injection hardening: menu photos are untrusted input — extraction output is
  data, never instructions; schema-validated before writing to DB.

## Non-goals (v1)
- User accounts beyond lightweight auth for submissions.
- Reservations, ordering, reviews/ratings wars.
- Native mobile apps (mobile-web first).
- Any city that is not Houston.
