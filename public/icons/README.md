# Category artwork

The SVGs here are a hand-coded first pass that didn't clear the bar — the
site currently renders emoji instead (see `components/CategoryIcon.tsx`,
`PAINTED_ICONS_READY = false`).

## To replace with real art

1. Generate one image per category with an image model (Midjourney, DALL·E,
   Gemini/Imagen, Firefly). Use the prompt template below for consistency.
2. Export **512×512 PNG with transparent background**, named exactly:
   `texmex.png  seafood.png  barfood.png  bbq.png  sushi.png  vietcajun.png
   pizza.png  burgers.png  veg.png`
3. Drop them in this folder, change the extension in `CategoryIcon.tsx`
   from `.svg` to `.png`, and flip `PAINTED_ICONS_READY` to `true`.

## Prompt template (keep identical across all nine for a consistent set)

> An impressionist oil painting in the style of Claude Monet of [SUBJECT],
> loose visible brushstrokes, dappled warm light, soft edges, muted
> sun-washed palette with terracotta and sage accents, painted on a plain
> background, centered single subject, no text, no border. Square icon
> composition, subject fills 70% of frame.

Subjects: a street taco · an oyster on the half shell · a chicken wing ·
a rack of pork ribs · a piece of salmon nigiri · a boiled crawfish ·
a slice of pepperoni pizza · a cheeseburger · a halved avocado

Background removal: most tools can output transparent PNG directly; if not,
remove.bg or Photoshop. Keep the painterly edge soft — a hard cutout kills
the style.
