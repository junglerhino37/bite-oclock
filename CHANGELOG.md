# Changelog

The site shows the current version in the footer (from `package.json`).
See AGENTS.md → "Versioning" for the bump rules.

## 1.10.1 — 2026-07-24

- Address lookup speaks human: "bambolinos on westheimer" now resolves —
  location filler ("on/at/near …") is stripped and apostrophe variants
  are tried (bambolinos → Bambolino's, pistoleros → Pistolero's).

## 1.10.0 — 2026-07-24

- **OCR dialed in.** Photos are auto-rotated (EXIF) and optimized with
  sharp before reading; extraction upgraded to Claude Sonnet with a
  bigger output budget and told that sideways menu boards are normal —
  fixes the rotated-photo empty-items failure.
- **Thinking, visibly.** Extraction shows named work steps ("Reading the
  dish names…") while a plate of emoji gets eaten, then rotates true
  Houston food lore (Ninfa's fajitas, Viet-Cajun, six square miles of
  Chinatown) — perceived progress instead of a spinner.
- **All day, open to close.** A window/all-day toggle on review: all-day
  deals bound to the business's real hours, prefilled from
  OpenStreetMap's opening_hours when tagged, labeled opens/closes.

## 1.9.0 — 2026-07-23

- **Submit flow redesigned around the human.** Photos stage first (add,
  remove, reorder your shots — nothing reads until you tap "Read the
  menu"), with an instructions box for context the photo can't give
  ("this is Rudyard's", "left page only") that feeds the AI reader.
- **Positive place ID before publish.** The reader may no longer guess a
  restaurant name (visible-on-menu or submitter-stated only). On review,
  the flow asks its follow-up: "Found X at ADDRESS — is that the one?"
  with ✓/✗; no confirmed identity, no publish button.
- Anti-hallucination extraction rules: unreadable lines are skipped, each
  dish is categorized item-by-item.

## 1.8.2 — 2026-07-23

- Single "Add the menu" button (WhatsApp-style): the system sheet offers
  camera and camera roll together; a small fallback link opens the camera
  directly on devices whose picker hides it.

## 1.8.1 — 2026-07-23

- Submit screen offers "📷 Snap the menu now" (launches the camera via
  capture=environment) alongside "🖼 From your photos"; file inputs accept
  image/* so mobile pickers show the camera option everywhere.

## 1.8.0 — 2026-07-23

- **Exact locations only.** New spots must geocode (address or name) or the
  submission is rejected with a fix-it message; community spots without
  coordinates stay off the site. All existing spots backfilled.
- **Take me there launches your maps app** — by name + address, never raw
  coordinates: Android geo: intent (respects Waze/default), Apple Maps on
  iOS, Google Maps directions on desktop.
- **Addresses look themselves up** — type a restaurant name on the review
  screen (menus often don't print it) and the address auto-fills for
  confirmation via /api/geocode.
- **Neighborhoods are derived, never typed** — the input is gone; the
  geocoder's suburb/neighbourhood fills it in.

## 1.7.0 — 2026-07-23

- **🧭 Take me there** — a directions button in the restaurant hero that
  launches the navigation app (Google Maps universal link; exact
  coordinates when known, name + address otherwise).

## 1.6.2 — 2026-07-23

- Menu photos moved to the top of the restaurant page (above the deals),
  cropped to a tidy preview — tap opens full size.

## 1.6.1 — 2026-07-23

- Extraction also preserves calendar limits ("valid through 8/31",
  "summer only") and per-deal time windows ("lunch only", "after 9pm")
  by appending them to the deal's description — dates are never
  silently dropped.

## 1.6.0 — 2026-07-23

- **Per-deal days** — daily-specials boards ("Monday: $1 wings") finally fit
  the model. Deals carry their own days: pickable on the review screen and
  the deal editor, badged on spot pages and cards, honored by the day
  filter and the bubbles.
- **BBQ & Smoked category** (🍖).
- **Specific or nothing** — extraction rules tightened: every deal must name
  the actual item; prices carry the deal mechanic ("Buy 2 get 1 free",
  "Free with any order"); no more nameless "$5-7" fragments.
- **Open-ended windows** — "specials after 4 PM" keeps a null end: shows as
  "after 4 PM", counts as live until close of day.
- **Auto-address for new spots** — server geocodes the restaurant (menu
  address → typed address → name lookup via Nominatim, Houston-bounded), so
  community listings get a real address, map pin, and distance
  (migration 0007: submissions.address/lat/lng).

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
