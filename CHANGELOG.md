# Changelog

The site shows the current version in the footer (from `package.json`).
See AGENTS.md → "Versioning" for the bump rules.

## 1.5.0 — 2026-07-23

- **Outdated votes now have teeth.** A deal with more 👎 than 👍 (2+ downs)
  dims on its spot page with a "voted outdated" notice, sinks below fresh
  deals, and disappears from home-page cards. Votes (or an ✏️ edit) bring
  it back — nothing is deleted.
- PRODUCT-SPEC.md rewritten to match the community-verification reality.

## 1.4.0 — 2026-07-23

- **Bubbles rebuilt around the clock.** Bubbles are now restaurants, not
  categories: live happy hours gravitate to the center with amber rings
  that drain as time runs out, "starts soon" orbits with dashed rings,
  done-for-today fades to the rim. Bubbles show "from $X" and end times;
  tapping opens a preview (deals, distance, verified, full-page link).
- **Pop to narrow** — eliminate bubbles you don't want; survivors grow;
  the last one standing is dinner. **🎲 Surprise me** pops everything but
  one open-or-soon spot.
- **Price × distance value map** — a second bubble layout on real axes
  (cheaper ↓, closer ←) using your location; bottom-left is "go here".

## 1.3.0 — 2026-07-23

- **Tap-to-edit deals.** Every deal on a spot page has ✏️ Edit: fix the
  name/price/description/category, attach a dish photo, or remove it.
  Price-less deals show a "+ price" button. Edits publish instantly as a
  new version; renames/removals reset that deal's verification votes.
- Dish photos show on the deal row and take over the home-page card
  header (dish photo > linked-page image > category gradient).

## 1.2.0 — 2026-07-23

- **One listing per physical restaurant.** Photo submissions now fuzzy-match
  the extracted name AND the address printed on the menu against known
  spots; the review screen shows "This looks like Bar Boheme — update it?"
  before publishing, and the submit route silently attaches exact/substring
  matches so no path can mint a near-duplicate ("Boheme" vs "Bar Boheme").
- Menu extraction also reads the printed street address.

## 1.1.1 — 2026-07-23

- Fix: og:image scraping now falls back to Microlink for bot-protected
  restaurant sites (Cloudflare 403s plain server fetches).

## 1.1.0 — 2026-07-23

- **Happy-hour links** — "add a link to bar boheme <url>" in the Ask bar
  attaches the page to the existing listing (tracking params stripped); a
  "🔗 Happy hour page ↗" pill shows in the spot hero.
- **Food images from restaurant sites** — a linked page's og:image becomes
  the card photo and a soft hero backdrop until real dish photos exist.
- **Ask bar everywhere** — restaurant pages have the bar too; searches hop
  to the home page and run automatically.
- Merged the two redundant CTA cards on the spot page into one.
- Fix: the AI no longer mistakes link-adds for new restaurants.

## 1.0.0 — 2026-07-23

First real release: the site went from prototype to daily-usable.

- **Community verification replaces the moderation queue** — 👍 still-current /
  👎 outdated votes on every deal and every spot's hours, "last verified"
  blurbs, and instant publishing (no `/mod`, no moderator key).
- **Versioned listings** — new menu photos and hours edits update a spot in
  place; older happy hours fold into a history section on the spot page,
  with menu snapshots and dates.
- **Multi-photo submissions** (up to 4, deals merged across photos) and a
  submitter-note box for things the menu doesn't say.
- **Ask bar "add" intent** — "add $1 oysters at julep" → did-you-mean
  confirmation → published, into an existing listing or as a new one.
- **Browse upgrades** — defaults to today, "Open now" chip, distance filter
  (1/2/5/10 mi) with nearest-first sorting, latest-added sort, ✨ updated
  badges, ✓ verified badges.
- **Auth scaffolding** — Google/Facebook sign-in via Supabase OAuth for
  one-vote-per-person (provider setup pending).
- **Vercel Web Analytics** beacon + footer counters (visits, happy hours
  added, contributors).

## 0.1.0

Prototype: seed-data browse (list/map/bubbles), AI menu extraction, AI
natural-language search, submissions with a human moderation queue.
