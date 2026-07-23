# Changelog

The site shows the current version in the footer (from `package.json`).
See AGENTS.md → "Versioning" for the bump rules.

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
