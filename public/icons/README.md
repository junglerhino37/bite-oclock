# Category artwork

Nine Monet-style oil paintings, one per category, generated with Gemini
(Imagen) in a single sitting so the set stays consistent: same warm cream
ground, same loose brushwork. Rendered by `components/CategoryIcon.tsx` as
circular medallions at 28px and up; below that the emoji glyph is used
(a painting is an illegible smudge at chip size).

Files: 320×320 JPEG (`texmex.jpg`, `seafood.jpg`, `barfood.jpg`, `bbq.jpg`,
`sushi.jpg`, `vietcajun.jpg`, `pizza.jpg`, `burgers.jpg`, `veg.jpg`).

## To regenerate a piece (keep the set consistent)

Start from this template, identical for every subject:

> An impressionist oil painting in the style of Claude Monet of [SUBJECT],
> loose visible brushstrokes, dappled warm light, soft edges, muted
> sun-washed palette, plain solid warm cream background, centered single
> subject filling 70% of the frame, no text, no border. Square image.

Then ask for silhouette clarity ("seen from the side, so the silhouette is
unmistakably a taco even as a tiny icon") — shape legibility at small sizes
matters more than detail. Subjects used: a folded street taco · an oyster on
the half shell · a glazed chicken wing drumette · a small rack of pork ribs ·
salmon nigiri · a boiled red crawfish · a slice of pepperoni pizza · a
cheeseburger · a halved avocado with pit.

Export/downscale to 320×320 JPEG quality ~82 (sharp: `.resize(320, 320,
{fit: "cover"}).jpeg({quality: 82, mozjpeg: true})`).
