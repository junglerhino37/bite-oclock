# Bite o'Clock 🍤🕓

> It's bite o'clock somewhere in Houston — every food happy hour in town,
> crowdsourced, mapped by the hour.

Houston's happy hour info is scattered, stale, and drink-centric. Bite o'Clock
is a community-built directory of **food** happy hours: the $1 oysters, the $5
queso, the half-price sushi. Snap a photo of a menu, AI reads it, a human
approves it, and everyone eats better.

**Status: early days.** The browse experience (list / map / bubbles), AI menu
extraction, and AI natural-language search work today. Persistence (Supabase),
accounts, and the moderation dashboard are the next milestones — see the
roadmap below.

## Features

- 🗺 **Map view** — every deal on a MapLibre map of Houston (free OpenFreeMap
  tiles, no API key).
- 🫧 **Bubble view** — a playful d3-force packed-bubble browser: bigger bubble =
  more deals, amber dot = live right now.
- ☰ **List view** — photo-forward cards, filter by food type, day, neighborhood,
  or "live now."
- 🤖 **Ask** — "cheap oysters near Montrose on a Tuesday" → the AI turns your
  question into a filter (never SQL) and shows real matching deals.
- 📸 **Spot a deal** — upload a menu photo; Claude extracts the dishes, prices,
  and hours for human review.

## Getting started

```bash
git clone https://github.com/junglerhino37/bite-oclock
cd bite-oclock
npm install
npm run dev
```

That's it — the site runs entirely from seed data with **no keys required**
(AI features fall back to a clearly-labeled demo mode).

To enable real AI extraction and search, copy `.env.example` to `.env.local`
and add your own `ANTHROPIC_API_KEY` (set a spend limit in the Anthropic
console). To work on uploads/persistence, add your own free-tier Supabase
project (schema in `supabase/migrations/`). **Never commit keys** — see
[SECURITY.md](SECURITY.md).

## How the data stays trustworthy

1. Every listing traces to a source — a menu photo or a published article
   (see `sourceUrl` in [data/seed.json](data/seed.json)).
2. AI extraction output is *pending data for human review*, never auto-published.
3. Deals show their source and age; stale deals get expired.
4. Deals change without notice — always confirm with the restaurant.

## Architecture (short version)

| Layer | Choice |
|---|---|
| Framework | Next.js 15 App Router, TypeScript |
| Styling | Tailwind CSS 4 + design tokens ([DESIGN.md](DESIGN.md)) |
| Map | MapLibre GL + OpenFreeMap tiles (keyless) |
| Bubbles | d3-force |
| AI | Claude API, server-side only, structured outputs ([lib/ai](lib/ai)) |
| Database (next) | Supabase — Postgres + PostGIS + RLS ([supabase/migrations](supabase/migrations)) |
| Hosting | Vercel |

More detail: [PRODUCT-SPEC.md](PRODUCT-SPEC.md) · [DESIGN.md](DESIGN.md) ·
[AGENTS.md](AGENTS.md) · [SECURITY.md](SECURITY.md)

## Roadmap

- [x] Browse: list / map / bubble views with filters
- [x] AI menu extraction endpoint (Claude vision, structured output)
- [x] AI natural-language search
- [x] Supabase schema + RLS policies
- [ ] Wire Supabase: persist submissions, moderation queue UI
- [ ] Auth (lightweight — enough to credit contributors and stop spam)
- [ ] Image pipeline: signed uploads → sharp re-encode (EXIF/GPS strip) → variants
- [ ] Real dish/menu photos on cards (today: category gradients)
- [ ] Import Houston restaurant canon from Overture/Foursquare OS Places
- [ ] Deal freshness: confirmations, auto-expiry, "last verified" badges
- [ ] Custom warm MapLibre style (Maputnik) to match the design system

## Contributing

Yes please — code, design, moderation, and above all **happy hour intel**.
Start with [CONTRIBUTING.md](CONTRIBUTING.md). Be kind, keep it Houston.

## License

[MIT](LICENSE)
