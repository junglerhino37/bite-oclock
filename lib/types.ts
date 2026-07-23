import type { Category } from "./categories";

export type Day = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export const DAYS: Day[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export const DAY_LABELS: Record<Day, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

export interface Deal {
  item: string;
  /** Display price, e.g. "$1 each" or "$5" — null when the source didn't state one. */
  price: string | null;
  category: Category;
}

export interface Spot {
  id: string;
  slug: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  neighborhood: string;
  days: Day[];
  /** 24h "HH:MM" in America/Chicago, null when unknown. */
  start: string | null;
  end: string | null;
  deals: Deal[];
  sourceUrl: string | null;
  sourceDate: string | null;
  notes: string | null;
}

export interface DealFilter {
  categories: Category[];
  neighborhood: string | null;
  day: Day | null;
  liveNow: boolean;
  /** Free-text food terms from the AI query ("oysters", "queso"). */
  foodTerms: string[];
}

export const EMPTY_FILTER: DealFilter = {
  categories: [],
  neighborhood: null,
  day: null,
  liveNow: false,
  foodTerms: [],
};
