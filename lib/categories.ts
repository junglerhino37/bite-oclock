export type Category =
  | "texmex"
  | "seafood"
  | "barfood"
  | "sushi"
  | "vietcajun"
  | "pizza"
  | "burgers"
  | "veg";

/** Category metadata. Hex values mirror the CSS vars in globals.css —
 * duplicated here because canvas/map markers can't read CSS custom properties. */
export const CATEGORIES: Record<
  Category,
  { label: string; emoji: string; color: string }
> = {
  texmex: { label: "Tacos & Tex-Mex", emoji: "🌮", color: "#d95d39" },
  seafood: { label: "Oysters & Seafood", emoji: "🦪", color: "#2e7e8c" },
  barfood: { label: "Wings & Bar Food", emoji: "🍗", color: "#b4452f" },
  sushi: { label: "Sushi", emoji: "🍣", color: "#3e5f8a" },
  vietcajun: { label: "Viet-Cajun", emoji: "🦞", color: "#6b8e23" },
  pizza: { label: "Pizza", emoji: "🍕", color: "#c99a2e" },
  burgers: { label: "Burgers", emoji: "🍔", color: "#8c5a32" },
  veg: { label: "Veg-Friendly", emoji: "🥑", color: "#4c8c57" },
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[];

export function isCategory(value: string): value is Category {
  return value in CATEGORIES;
}
