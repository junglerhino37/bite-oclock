# AGENTS.md — instructions for AI agents working in this repo

Bite o'Clock is a **public, crowdsourced** directory of Houston food happy
hours. Humans and AI agents both contribute here; these rules keep the project
safe and coherent. Read [PRODUCT-SPEC.md](PRODUCT-SPEC.md) for what we're
building and [DESIGN.md](DESIGN.md) for how it should look.

## Rule #1 — security is not optional

This repo is public and handles user uploads and AI calls. Any change that
touches uploads, AI endpoints, or the database must follow
[SECURITY.md](SECURITY.md). The load-bearing rules:

- **No secrets in the repo, ever.** Env vars only; `.env.example` documents
  names, not values. Client code never sees `ANTHROPIC_API_KEY` or
  `SUPABASE_SERVICE_ROLE_KEY` (the `server-only` import in `lib/ai/client.ts`
  enforces this — keep it).
- **All user input is hostile.** Uploads: sniff magic bytes, cap size,
  re-encode server-side (strips EXIF/GPS). Questions to `/api/ask`: length-cap,
  fixed system prompt, user text only in the user turn.
- **AI output is data, never instructions.** Extraction and query results are
  zod-validated (`lib/ai/schemas.ts`) before use. The NL-query model produces a
  constrained filter object — it must never generate SQL or call tools.
- **Nothing crowdsourced auto-publishes.** Everything lands `pending` for
  human moderation.
- **Rate-limit every write and AI endpoint** (`lib/ratelimit.ts`).
- CI for fork PRs gets **no secrets**; never use `pull_request_target` with a
  checkout of fork code.

## Rule #2 — data honesty

- Houston only. Every seed listing must trace to a real source
  (`sourceUrl`/`sourceDate` in `data/seed.json`). Do not invent restaurants,
  deals, prices, or hours. Unknown fields are `null`, not guesses.
- Demo/fallback behavior must be labeled as demo in the UI (see
  `/api/extract` demo mode) — never pass simulated output off as real.

## Architecture map

```
app/
  page.tsx            home = Browse (list/map/bubbles share one filter state)
  r/[slug]/           restaurant detail (static params from seed)
  submit/             menu-photo upload → AI extraction → review → (moderation)
  about/
  api/extract/        Claude vision → zod-validated Extraction (demo w/o key)
  api/ask/            NL question → constrained QueryFilter → applyFilter()
  api/uploads/sign/   Supabase signed upload URL (501 until configured)
components/           Browse, DealCard, FilterBar, MapView, BubbleView, AskBar
lib/
  spots.ts            seed loading, validation, filtering, live-now time logic
  categories.ts       the 8 food categories (labels, emoji, hexes)
  ai/schemas.ts       zod schemas — the trust boundary for all AI output
  ai/client.ts        server-only Anthropic client
  ratelimit.ts        in-memory limiter (swap for Upstash in production)
data/seed.json        sourced Houston happy hours (see Rule #2)
supabase/migrations/  Postgres + PostGIS schema, RLS default-deny
DESIGN.md             design tokens + UI principles — follow them exactly
```

## Conventions

- TypeScript strict; `npm run lint` and `npm run build` must pass before a PR.
- Times are 24h `"HH:MM"` strings in **America/Chicago**; days are
  `"mon".."sun"`. All time math goes through `lib/spots.ts` helpers.
- Categories are the closed set in `lib/categories.ts`. Adding one means
  updating the zod schemas, the SQL check constraint, and DESIGN.md hues.
- Styling: Tailwind utilities + the design tokens in `globals.css`. Use the
  mapped colors (`bg-surface`, `text-ink`, `text-muted`, `border-line`,
  `bg-sunken`, `text-primary`, `bg-accent`) — no raw hex in components (the
  only exception: category colors from `lib/categories.ts` via inline style).
- Map/bubble components are client-only (`next/dynamic`, `ssr: false`).

## Design principles (the ones agents most often violate)

1. Food photos are the hero — chrome stays warm-neutral; nothing more colorful
   than the food.
2. Warm everything — never blue-gray backgrounds, shadows, or skeletons.
3. Fraunces (`.font-display`) for feelings, Inter for facts, Space Grotesk
   (`.font-data`) for prices/times — never mix roles.
4. Playfulness is bounded to bubbles, chips, empty states, micro-interactions.
5. Empty states are invitations to contribute, not dead ends.
6. Mobile first: 44px touch targets, bottom sheets over popups.
7. "Live now" is always amber, always animated, always filterable.
8. Respect `prefers-reduced-motion`; nothing animates longer than 400ms.

## Current frontier (check README roadmap before starting work)

The next milestones are wiring Supabase persistence + the moderation queue,
lightweight auth, and the sharp image pipeline. If you build these, follow the
security checklist in SECURITY.md item by item.
