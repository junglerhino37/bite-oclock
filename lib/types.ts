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
  /** Menu sub-text under the dish (ingredients/preparation), when present. */
  description?: string | null;
  /** Days this specific deal runs, when the menu says so ("Monday: $1 wings").
   * Empty/absent = every day the spot's happy hour runs. */
  days?: Day[];
  /** Community dish photo — storage path (persisted) and public URL (display). */
  photoPath?: string | null;
  photoUrl?: string | null;
}

export interface Spot {
  id: string;
  slug: string;
  name: string;
  address: string;
  /** Null for community submissions that haven't been geocoded yet —
   * such spots appear in list/bubble views but not on the map. */
  lat: number | null;
  lng: number | null;
  neighborhood: string;
  days: Day[];
  /** 24h "HH:MM" in America/Chicago, null when unknown. */
  start: string | null;
  end: string | null;
  deals: Deal[];
  sourceUrl: string | null;
  sourceDate: string | null;
  notes: string | null;
  /** Menu snapshots from the current version (latest submission with photos). */
  photoUrls?: string[];
  /** Preview image scraped from the spot's linked happy-hour page (og:image). */
  imageUrl?: string | null;
  /** Day-accurate windows (business hours for all-day deals) — when present,
   * they override start/end for that day. Days differ; Fridays exist. */
  hoursByDay?: Partial<Record<Day, DayHours>> | null;
  /** Submitter note on the current version ("cash only", "patio only"…). */
  communityNote?: string | null;
  /** When the current version of this listing was added (ISO, community only). */
  addedAt?: string | null;
  /** Older versions of the happy hour, newest first (excludes the current one). */
  history?: SpotVersion[];
  /** Community votes keyed by 'hours' or 'deal:<item>'. */
  verification?: Record<string, VoteSummary>;
}

export function verificationKey(kind: "deal" | "hours", target: string): string {
  return kind === "hours" ? "hours" : `deal:${target}`;
}

/** One day's operating window — end null means open-ended (till close). */
export interface DayHours {
  start: string;
  end: string | null;
}

/** Aggregated community votes for one target ('hours' or a deal item). */
export interface VoteSummary {
  up: number;
  down: number;
  /** When the newest "still current" vote was cast — the last-verified date. */
  lastVerifiedAt: string | null;
}

/** One historical state of a spot's happy hour (seed baseline or a
 * community submission), used for the folded history on the spot page. */
export interface SpotVersion {
  days: Day[];
  start: string | null;
  end: string | null;
  deals: Deal[];
  /** Menu snapshots uploaded with this version (empty when none). */
  photoUrls: string[];
  /** Submitter note that came with this version, if any. */
  note: string | null;
  /** ISO timestamp (community) or source date string (seed). */
  addedAt: string | null;
  source: "seed" | "community";
}

export interface DealFilter {
  categories: Category[];
  neighborhood: string | null;
  day: Day | null;
  liveNow: boolean;
  /** Free-text food terms from the AI query ("oysters", "queso"). */
  foodTerms: string[];
  /** Only spots within this many miles of the visitor; null = anywhere.
   * Needs the visitor's location — spots without coords are excluded. */
  maxMiles: number | null;
}

export const EMPTY_FILTER: DealFilter = {
  categories: [],
  neighborhood: null,
  day: null,
  liveNow: false,
  foodTerms: [],
  maxMiles: null,
};
