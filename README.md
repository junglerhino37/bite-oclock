# Bite o'Clock 🍤🕓

> It's bite o'clock somewhere in Houston — every food happy hour in town,
> crowdsourced, mapped by the hour.

Houston's happy hour info is scattered, stale, and drink-centric. Bite o'Clock
is a community-built directory of **food** happy hours: the $1 oysters, the $5
queso, the half-price sushi. Snap a photo of a menu, AI reads it, it goes live
instantly, and the community votes on whether it's still current.

**Status: early days.** Browse (list / map / bubbles), AI menu extraction, AI
natural-language search, instant photo submissions, and community verification
(votes + hours edits + happy hour history) work today — see the roadmap below.

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
  and hours; you fix anything it got wrong and it's live immediately.
- ✅ **Community verification** — 👍 "still current" / 👎 "outdated" votes on
  every deal and every spot's hours, with a "last verified" blurb. No
  moderation queue.
- 🕰 **Happy hour history** — each new menu snapshot or hours edit becomes the
  current version; older versions fold into the restaurant page's history.

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
console). **Never commit keys** — see [SECURITY.md](SECURITY.md).

To enable **submission persistence + community verification**:
1. Create a free [Supabase](https://supabase.com) project.
2. Run the SQL in `supabase/migrations/` (SQL editor, in order) and create a
   public storage bucket named `uploads`.
3. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in your env (locally in
   `.env.local`; on Vercel in project settings).
4. Menu submissions now persist with their photo and go live instantly;
   anyone can vote deals/hours current or outdated.
5. Optional — Google/Facebook sign-in for one-vote-per-person: set
   `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` and enable the
   providers in Supabase Auth settings. Without them, votes are keyed by IP.

## How the data stays trustworthy

1. Every listing traces to a source — a menu photo or a published article
   (see `sourceUrl` in [data/seed.json](data/seed.json)).
2. AI extraction is reviewed and corrected by the submitter before publishing;
   schema validation keeps it data, never instructions.
3. The community verifies: every deal and every spot's hours carry
   "still current" / "outdated" votes and a last-verified date, and hours can
   be fixed in place (the old schedule stays in history).
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
- [x] Wire Supabase: persist submissions (photo included); instant publish
- [x] Community verification: votes on deals + hours, last-verified badges,
      editable hours, happy hour history (replaced the moderation queue)
- [x] Auth: Google/Facebook sign-in via Supabase (one vote per account)
- [ ] Image pipeline: signed uploads → sharp re-encode (EXIF/GPS strip) → variants
- [ ] Real dish/menu photos on cards (today: category gradients)
- [ ] Import Houston restaurant canon from Overture/Foursquare OS Places
- [x] Auto-expiry for deals that keep getting "outdated" votes (dim + drop
      off cards; votes or an edit revive them)
- [ ] Custom warm MapLibre style (Maputnik) to match the design system

## Contributing

Yes please — code, design, moderation, and above all **happy hour intel**.
Start with [CONTRIBUTING.md](CONTRIBUTING.md). Be kind, keep it Houston.

## License

[MIT](LICENSE)
