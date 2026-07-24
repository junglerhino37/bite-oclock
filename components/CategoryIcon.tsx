import { CATEGORIES, type Category } from "@/lib/categories";

/** Category artwork: Monet-style oil paintings (see public/icons/README.md
 * for how the set was generated and how to regenerate a piece). The paintings
 * sit on an opaque warm-cream ground, so they render as circular medallions —
 * little framed canvases. Below MIN_PAINTING_SIZE a painting is an illegible
 * smudge, so tiny call sites (filter chips, deal rows) keep the emoji glyph. */
const MIN_PAINTING_SIZE = 28;

export default function CategoryIcon({
  category,
  size = 40,
  className = "",
}: {
  category: Category;
  size?: number;
  className?: string;
}) {
  if (size < MIN_PAINTING_SIZE) {
    return (
      <span
        aria-hidden
        className={className}
        style={{ fontSize: Math.round(size * 0.82), lineHeight: 1 }}
      >
        {CATEGORIES[category].emoji}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/icons/${category}.jpg`}
      alt=""
      width={size}
      height={size}
      className={className}
      style={{ borderRadius: "50%", objectFit: "cover" }}
      draggable={false}
    />
  );
}
