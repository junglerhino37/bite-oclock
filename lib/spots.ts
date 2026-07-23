import seed from "@/data/seed.json";
import type { Day, DealFilter, Spot } from "./types";
import { DAYS } from "./types";
import { isCategory } from "./categories";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

let cache: Spot[] | null = null;

/** Seed data, validated and enriched with ids/slugs. Invalid entries are dropped
 * rather than crashing the site — seed PRs shouldn't be able to take pages down. */
export function getSpots(): Spot[] {
  if (cache) return cache;
  const seen = new Set<string>();
  cache = (seed as unknown[])
    .flatMap((raw): Spot[] => {
      const r = raw as Record<string, unknown>;
      if (typeof r.name !== "string" || typeof r.lat !== "number" || typeof r.lng !== "number") {
        return [];
      }
      let slug = slugify(r.name);
      while (seen.has(slug)) slug = `${slug}-2`;
      seen.add(slug);
      const days = Array.isArray(r.days)
        ? (r.days.filter((d): d is Day => DAYS.includes(d as Day)) as Day[])
        : [];
      const deals = Array.isArray(r.deals)
        ? r.deals.flatMap((d) => {
            const deal = d as Record<string, unknown>;
            if (typeof deal.item !== "string" || !isCategory(String(deal.category))) return [];
            return [
              {
                item: deal.item,
                price: typeof deal.price === "string" ? deal.price : null,
                category: String(deal.category),
                description: typeof deal.description === "string" ? deal.description : null,
              },
            ];
          })
        : [];
      return [
        {
          id: slug,
          slug,
          name: r.name,
          address: typeof r.address === "string" ? r.address : "",
          lat: r.lat,
          lng: r.lng,
          neighborhood: typeof r.neighborhood === "string" ? r.neighborhood : "Houston",
          days,
          start: typeof r.start === "string" ? r.start : null,
          end: typeof r.end === "string" ? r.end : null,
          deals,
          sourceUrl: typeof r.sourceUrl === "string" ? r.sourceUrl : null,
          sourceDate: typeof r.sourceDate === "string" ? r.sourceDate : null,
          notes: typeof r.notes === "string" ? r.notes : null,
        } as Spot,
      ];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  return cache;
}

export function getSpot(slug: string): Spot | undefined {
  return getSpots().find((s) => s.slug === slug);
}

export function getNeighborhoods(): string[] {
  return [...new Set(getSpots().map((s) => s.neighborhood))].sort();
}

/** Current day + minutes-since-midnight in Houston (America/Chicago). */
export function houstonNow(now: Date = new Date()): { day: Day; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const day = get("weekday").toLowerCase().slice(0, 3) as Day;
  const minutes = parseInt(get("hour"), 10) * 60 + parseInt(get("minute"), 10);
  return { day, minutes };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function isLiveNow(spot: Spot, now: Date = new Date()): boolean {
  if (!spot.start || !spot.end) return false;
  const { day, minutes } = houstonNow(now);
  if (!spot.days.includes(day)) return false;
  return minutes >= toMinutes(spot.start) && minutes < toMinutes(spot.end);
}

export function formatTimeRange(spot: { start: string | null; end: string | null }): string {
  if (!spot.start || !spot.end) return "hours vary";
  const fmt = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    const suffix = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return m === 0 ? `${hour12} ${suffix}` : `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
  };
  return `${fmt(spot.start)}–${fmt(spot.end)}`;
}

export interface LatLng {
  lat: number;
  lng: number;
}

/** Great-circle (haversine) distance in miles. */
export function distanceMiles(a: LatLng, b: LatLng): number {
  const R = 3958.8;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function spotDistanceMiles(spot: Spot, origin: LatLng | null): number | null {
  if (!origin || spot.lat === null || spot.lng === null) return null;
  return distanceMiles(origin, { lat: spot.lat, lng: spot.lng });
}

export function applyFilter(
  spots: Spot[],
  filter: DealFilter,
  now: Date = new Date(),
  origin: LatLng | null = null,
): Spot[] {
  return spots.filter((spot) => {
    // Distance is a no-op until the visitor's location arrives.
    if (filter.maxMiles !== null && origin) {
      const d = spotDistanceMiles(spot, origin);
      if (d === null || d > filter.maxMiles) return false;
    }
    if (filter.categories.length > 0) {
      const cats = new Set(spot.deals.map((d) => d.category));
      if (!filter.categories.some((c) => cats.has(c))) return false;
    }
    if (filter.neighborhood && spot.neighborhood !== filter.neighborhood) return false;
    // Spots with no listed days are "days unknown", not "never" — day filters
    // keep them visible so a fresh community listing doesn't vanish.
    if (filter.day && spot.days.length > 0 && !spot.days.includes(filter.day)) return false;
    if (filter.liveNow && !isLiveNow(spot, now)) return false;
    if (filter.foodTerms.length > 0) {
      const haystack = [spot.name, ...spot.deals.map((d) => d.item)].join(" ").toLowerCase();
      if (!filter.foodTerms.some((t) => haystack.includes(t.toLowerCase()))) return false;
    }
    return true;
  });
}
