# Bite o'Clock — Design System

Direction: **"Golden Hour Editorial with playful accents."** Warm editorial
food-magazine base (cream paper surfaces, ink text, expressive serif display)
carries appetite and trust; playfulness is bounded to the bubble view, chips,
empty states, and micro-interactions. Golden hour literally matches the
happy-hour window and Houston's sunset heat.

## UI principles (the short version)
1. Food photos are the hero: UI chrome stays warm-neutral and low-saturation; nothing on screen may be more colorful than the food.
2. Warm everything: backgrounds, grays, shadows, skeletons, and dark mode all use warm (brown-based) tones — never blue-gray.
3. Fraunces for feelings, Inter for facts, Space Grotesk for prices and times — never mix roles.
4. Playfulness is bounded: springs, bubbles, and confetti live in interactions and empty states, never in reading surfaces or data displays.
5. Every list, map, and empty state names the community: show who added, confirmed, or photographed a deal; make "add one" the empty-state CTA.
6. Mobile first, thumb first: 44px minimum targets, bottom sheets over popups, filters reachable one-handed.
7. Time is a first-class signal: "live now" is always amber, always animated, always filterable.
8. Motion respects `prefers-reduced-motion` and never exceeds 400ms; feedback beats decoration.

## Design tokens

```css
:root {
  /* color — light */
  --bg: #FAF6EF;            /* warm paper */
  --surface: #FFFFFF;
  --surface-sunken: #F1EAE0;
  --primary: #C8501E;       /* burnt terracotta */
  --primary-hover: #A84217;
  --secondary: #1F4D3A;     /* bayou green */
  --accent: #F5A623;        /* golden-hour amber */
  --text: #241C15;
  --text-muted: #6E6257;
  --border: #E4DACB;
  --success: #2E7D4F;
  --danger: #C0392B;
  --scrim: linear-gradient(transparent, rgba(27,22,19,.72));

  /* category hues */
  --cat-texmex: #D95D39; --cat-seafood: #2E7E8C; --cat-barfood: #B4452F;
  --cat-sushi: #3E5F8A;  --cat-vietcajun: #6B8E23; --cat-pizza: #C99A2E;
  --cat-burgers: #8C5A32; --cat-veg: #4C8C57;

  /* type */
  --font-display: "Fraunces", "Iowan Old Style", Georgia, serif;
  --font-body: "Inter", -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-data: "Space Grotesk", "SF Mono", ui-monospace, monospace;
  --text-xs: 12px; --text-sm: 14px; --text-base: 16px;
  --text-lg: 18px; --text-xl: 22px; --text-2xl: 28px;
  --text-3xl: 36px; --text-4xl: 48px;

  /* radii */
  --radius-sm: 8px; --radius-md: 12px; --radius-lg: 16px;
  --radius-xl: 24px; --radius-pill: 999px;

  /* shadows (light mode) */
  --shadow-sm: 0 1px 3px rgba(36,28,21,.06);
  --shadow-md: 0 2px 8px rgba(36,28,21,.08);
  --shadow-lg: 0 8px 24px rgba(36,28,21,.14);
  --shadow-sheet: 0 -4px 24px rgba(36,28,21,.16);

  /* spacing (4px base) */
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-5: 24px; --space-6: 32px; --space-7: 48px; --space-8: 64px;

  /* motion */
  --ease-spring: cubic-bezier(.34,1.56,.64,1);
  --dur-fast: 150ms; --dur-base: 250ms; --dur-slow: 400ms;
}

[data-theme="dark"] {
  /* warm charcoal, never blue-black — keeps food photos appetizing */
  --bg: #1B1613; --surface: #251F1A; --surface-sunken: #2F2822;
  --primary: #E8703D; --primary-hover: #F08552;
  --secondary: #7FB89A; --accent: #FFC15E;
  --text: #F3EDE4; --text-muted: #A79A8C; --border: #3A322A;
  --success: #5FAE7F; --danger: #E06A5A;
  /* dark mode: replace shadows with 1px var(--border) borders + raised surfaces */
}
```

## Typography
- **Display: Fraunces** (variable; SOFT 80–100, WONK 1 for hero/section titles;
  tighter and straighter for card titles; never below 18px).
- **Body/UI: Inter** — small-size legibility for times, prices, addresses.
- **Data: Space Grotesk** for price/time chips ("3–6 PM · $5").
- Scale: 12/14/16 body, 18/22 card titles, 28/36/48 display; line-height 1.5
  body, 1.1 display.

## Bubble view
- Packed circles on the warm paper bg with gentle idle drift (Apple Music
  genre-picker energy). Two levels: **category bubbles** (15% category tint
  fill, 2px full-strength ring, Fraunces label + food emoji) tap-expand into
  **deal bubbles** (circle-cropped dish photo, thin white ring).
- Size: radius ∝ sqrt(hotness) — deal count weighted by recent community
  activity; clamped to 44px min touch target, 4:1 max ratio.
- Amber "LIVE" dot pulses on bubbles with a happy hour running right now.
- Interactions: tap = expand/open bottom sheet (bubble field persists);
  drag = fling with spring-back; filters re-run the simulation — the re-pack
  animation IS the filter feedback.
- Implementation: **d3-force** (`forceSimulation` + `forceCollide(r+2)` +
  weak `forceX/forceY`), rendered to Canvas (>60 bubbles) or
  transform-positioned divs (<60). Not CSS-only, not static `d3.pack()`.
  `alphaDecay ~0.05`, low-power idle tick. Static layout under
  `prefers-reduced-motion`.

## Map view
- **MapLibre GL JS** + custom warm-light style (Maputnik-edited from an
  OpenFreeMap/CARTO Positron base — free, keyless): land `#F3EDE2`, water
  desaturated bayou `#BFD6CC`, parks `#DCE5D3`, POI/label noise stripped.
  Dark variant: `#211B17` land, `#172420` water.
- Markers: terracotta pins with white category glyph; live pins get amber halo
  pulse; selected pin scales 1.2× with a spring.
- Clusters: white circles, 2px terracotta ring, count in Space Grotesk.
- Mobile: bottom sheet (peek 96px / half / full) instead of floating popups;
  desktop: anchored card popover, 12px radius, soft shadow.
- Map and bubbles are two tabs of one browse surface with shared filter state.

## Cards & photos
- Deal cards: photo-top, image 4:3 (1:1 in dense grids), radius 16px card /
  12px image; light mode = soft shadows not borders; dark mode = 1px border +
  raised surface. Hover: shadow-lg + translateY(-2px), 200ms.
- Restaurant pages: 16:9 hero with bottom scrim + Fraunces title; deals as
  timetable chips; community photo grid 3-col 1:1 with contributor avatar
  badged on their photo.
- Photos: `object-fit: cover`, warm-tone blurhash placeholders (never gray),
  no filters on user photos, lightbox credits "📸 by @user • 3 days ago".
- Price badges: solid amber, ink text, pill radius.

## Community micro-interactions
- "+ Spot a deal" FAB always present in browse views.
- Upvote = 2–3 food-emoji particles, 400ms, reduced-motion-safe.
- Upload success: photo "flies" into the grid; "You're the first to snap this
  dish 🏆" when true.
- Countdown chips turn amber under 60 min: "Ends in 43 min."
- Freshness attribution everywhere: "Confirmed by 4 people this week."
- Empty states are invitations: "No deals in EaDo yet. Know one? Be the first
  to put it on the map."
