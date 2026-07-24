import { CATEGORIES, type Category } from "@/lib/categories";

/** Category artwork. The painterly SVG set in /public/icons was a hand-coded
 * first pass that didn't clear the quality bar — flip PAINTED_ICONS_READY
 * once real art (AI-generated or commissioned) replaces those files. See
 * public/icons/README.md for the generation spec. Until then: emoji. */
const PAINTED_ICONS_READY = false;

export default function CategoryIcon({
  category,
  size = 40,
  className = "",
}: {
  category: Category;
  size?: number;
  className?: string;
}) {
  if (!PAINTED_ICONS_READY) {
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
      src={`/icons/${category}.svg`}
      alt=""
      width={size}
      height={size}
      className={className}
      draggable={false}
    />
  );
}
