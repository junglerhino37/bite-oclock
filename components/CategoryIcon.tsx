import type { Category } from "@/lib/categories";

/** Painterly category icons (impressionist dabs, Monet-leaning palette) —
 * SVGs in /public/icons, one per category. Decorative: empty alt. */
export default function CategoryIcon({
  category,
  size = 40,
  className = "",
}: {
  category: Category;
  size?: number;
  className?: string;
}) {
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
