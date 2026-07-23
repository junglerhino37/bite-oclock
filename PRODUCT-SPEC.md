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
4. **Contribute**: snap photos of a happy hour menu (up to 4) → AI extracts the deals
   (items, prices, times, days) → you fix anything it got wrong → it publishes
   instantly onto the matching restaurant (one listing per physical address;
   near-name/address matches are confirmed on the review screen). The Ask bar
   also accepts "add $1 oysters at julep" and links to happy-hour pages.
5. **Show off**: dish photos attach to individual deals; menu snapshots and
   restaurant-site preview images make the cards visual.
6. **Trust**: the community votes every deal and every spot's hours 👍 still
   current / 👎 outdated. Listings show last-verified dates; deals voted down
   dim on the page and drop off cards; every change is a version with history.

## Views
- **Map view**: interactive map of Houston, clustered markers, tap for deal card.
- **Bubble view**: playful dynamic packed-bubbles (food categories / deals), tap to dive in.
- **List/card view**: photo-forward cards, sortable.
- **Restaurant page**: all deals, menu photos, dish photos, hours, map snippet.

## Data model (as built)
- `data/seed.json`: curated baseline listings with sources.
- `submissions`: one row per community contribution — a *version* of a spot
  (days/times/deals jsonb/photos/note/link). `spot_slug` ties versions to a
  listing; the newest version wins, older ones render as history.
- `votes`: (spot_slug, kind deal|hours, target, ±1, voter) — verification.
- `site_stats`: visit counter for the footer.
- Photos (menu snapshots, dish photos) live in Supabase storage; paths ride
  in the submission/deal jsonb.

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
- Community verification instead of pre-moderation: instant publish, votes
  as the quality gate, versions as the audit trail, `rejected` status as
  the takedown lever.
- RLS / least-privilege DB access; contributors run against their own dev instance.
- Prompt-injection hardening: menu photos are untrusted input — extraction output is
  data, never instructions; schema-validated before writing to DB.

## Non-goals (v1)
- User accounts beyond lightweight OAuth for one-vote-per-person.
- Reservations, ordering, reviews/ratings wars.
- Native mobile apps (mobile-web first).
- Any city that is not Houston.
