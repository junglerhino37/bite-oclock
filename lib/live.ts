import "server-only";
import { getServiceDb } from "./db";
import { getSpots } from "./spots";
import type { Day, Spot } from "./types";
import { DAYS } from "./types";
import { isCategory } from "./categories";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function hhmm(t: unknown): string | null {
  // Postgres `time` comes back as "HH:MM:SS"
  return typeof t === "string" && /^\d{2}:\d{2}/.test(t) ? t.slice(0, 5) : null;
}

/** Seed spots + approved community submissions, merged for the browse surface.
 * Without a configured database this is just the seed — same behavior as before. */
export async function getAllSpots(): Promise<Spot[]> {
  const seed = getSpots();
  const db = getServiceDb();
  if (!db) return seed;

  const { data, error } = await db
    .from("submissions")
    .select("id, restaurant_name, neighborhood, days, start_time, end_time, deals")
    .eq("status", "approved")
    .limit(500);
  if (error || !data) {
    if (error) console.error("live spots query failed:", error.message);
    return seed;
  }

  const seen = new Set(seed.map((s) => s.slug));
  const live: Spot[] = data.flatMap((row) => {
    let slug = slugify(row.restaurant_name);
    if (!slug) return [];
    while (seen.has(slug)) slug = `${slug}-community`;
    seen.add(slug);
    const deals = (Array.isArray(row.deals) ? row.deals : []).flatMap(
      (d: Record<string, unknown>) =>
        typeof d.item === "string" && isCategory(String(d.category))
          ? [
              {
                item: d.item,
                price: typeof d.price === "string" ? d.price : null,
                category: String(d.category) as Spot["deals"][number]["category"],
                description: typeof d.description === "string" ? d.description : null,
              },
            ]
          : [],
    );
    if (deals.length === 0) return [];
    return [
      {
        id: `sub-${row.id}`,
        slug,
        name: row.restaurant_name,
        address: "",
        lat: null, // not geocoded yet — list/bubbles only, not the map
        lng: null,
        neighborhood: row.neighborhood ?? "Houston",
        days: (Array.isArray(row.days) ? row.days : []).filter((d): d is Day =>
          DAYS.includes(d as Day),
        ),
        start: hhmm(row.start_time),
        end: hhmm(row.end_time),
        deals,
        sourceUrl: null,
        sourceDate: null,
        notes: "Community-submitted from a menu photo.",
      },
    ];
  });

  return [...seed, ...live].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getAnySpot(slug: string): Promise<Spot | undefined> {
  return (await getAllSpots()).find((s) => s.slug === slug);
}
