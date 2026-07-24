import "server-only";
import { getServiceDb, UPLOADS_BUCKET } from "./db";
import { getSpots } from "./spots";
import type { Day, DayHours, Deal, Spot, SpotVersion, VoteSummary } from "./types";
import { DAYS } from "./types";
import { isCategory } from "./categories";

export function slugifyName(name: string): string {
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

interface SubRow {
  id: string;
  restaurant_name: string;
  neighborhood: string | null;
  days: unknown;
  start_time: unknown;
  end_time: unknown;
  deals: unknown;
  photo_path?: string | null;
  photo_paths?: string[] | null;
  note?: string | null;
  spot_slug?: string | null;
  source_url?: string | null;
  image_url?: string | null;
  hours?: unknown;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  created_at: string;
}

function parseDeals(raw: unknown, urlFor?: (path: string) => string | null): Deal[] {
  return (Array.isArray(raw) ? raw : []).flatMap((d: Record<string, unknown>) => {
    if (typeof d.item !== "string" || !isCategory(String(d.category))) return [];
    const photoPath = typeof d.photo_path === "string" ? d.photo_path : null;
    const days = (Array.isArray(d.days) ? d.days : []).filter((x): x is Day =>
      DAYS.includes(x as Day),
    );
    return [
      {
        item: d.item,
        price: typeof d.price === "string" ? d.price : null,
        category: String(d.category) as Deal["category"],
        description: typeof d.description === "string" ? d.description : null,
        days: days.length > 0 ? days : undefined,
        photoPath,
        photoUrl: photoPath && urlFor ? urlFor(photoPath) : null,
      },
    ];
  });
}

function parseDays(raw: unknown): Day[] {
  return (Array.isArray(raw) ? raw : []).filter((d): d is Day => DAYS.includes(d as Day));
}

function parseHoursByDay(raw: unknown): Partial<Record<Day, DayHours>> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Partial<Record<Day, DayHours>> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!DAYS.includes(k as Day)) continue;
    const h = v as { start?: unknown; end?: unknown };
    if (typeof h?.start !== "string" || !/^\d{2}:\d{2}/.test(h.start)) continue;
    out[k as Day] = {
      start: h.start.slice(0, 5),
      end: typeof h.end === "string" && /^\d{2}:\d{2}/.test(h.end) ? h.end.slice(0, 5) : null,
    };
  }
  return Object.keys(out).length > 0 ? out : null;
}

interface VoteRow {
  spot_slug: string;
  kind: string;
  target: string;
  vote: number;
  created_at: string;
}

function summarizeVotes(rows: VoteRow[]): Map<string, Record<string, VoteSummary>> {
  const bySlug = new Map<string, Record<string, VoteSummary>>();
  for (const v of rows) {
    const key = v.kind === "hours" ? "hours" : `deal:${v.target}`;
    const forSlug = bySlug.get(v.spot_slug) ?? {};
    const s = forSlug[key] ?? { up: 0, down: 0, lastVerifiedAt: null };
    if (v.vote > 0) {
      s.up += 1;
      if (!s.lastVerifiedAt || v.created_at > s.lastVerifiedAt) s.lastVerifiedAt = v.created_at;
    } else {
      s.down += 1;
    }
    forSlug[key] = s;
    bySlug.set(v.spot_slug, forSlug);
  }
  return bySlug;
}

/** Browse surface: seed spots overlaid with community submissions and votes.
 *
 * Submissions targeting an existing slug (via spot_slug, or a name that
 * slugifies to it) become new *versions* of that spot: the newest version's
 * days/times/deals/photo win, older ones fold into `history`. Submissions for
 * unknown restaurants create new community spots (no coords → list/bubbles
 * only). Without a configured database this is just the seed. */
export async function getAllSpots(): Promise<Spot[]> {
  const seed = getSpots();
  const db = getServiceDb();
  if (!db) return seed;

  const newCols = ", photo_paths, note, spot_slug, source_url, image_url, address, lat, lng";
  const newestCols = ", hours";
  const subCols = `id, restaurant_name, neighborhood, days, start_time, end_time, deals, photo_path${newCols}${newestCols}, created_at`;
  const fetchSubs = (cols: string) =>
    db
      .from("submissions")
      .select(cols)
      .eq("status", "approved")
      .order("created_at", { ascending: true })
      .limit(1000) as unknown as Promise<{
      data: SubRow[] | null;
      error: { message: string } | null;
    }>;
  let subsRes = await fetchSubs(subCols);
  if (subsRes.error) {
    // Instance predates migration 0009 — retry without the newest column…
    subsRes = await fetchSubs(subCols.replace(newestCols, ""));
  }
  if (subsRes.error) {
    // …or predates 0003/0004 entirely — degrade to the original columns.
    subsRes = await fetchSubs(subCols.replace(newCols, "").replace(newestCols, ""));
  }
  if (subsRes.error || !subsRes.data) {
    if (subsRes.error) console.error("live spots query failed:", subsRes.error.message);
    return seed;
  }

  // Votes table may not exist yet either — treat as empty then.
  const votesRes = await db
    .from("votes")
    .select("spot_slug, kind, target, vote, created_at")
    .limit(10000);
  const votes = summarizeVotes((votesRes.data as VoteRow[] | null) ?? []);

  const photoUrl = (path: string | null | undefined): string | null =>
    path ? db.storage.from(UPLOADS_BUCKET).getPublicUrl(path).data.publicUrl : null;

  // Group submissions by the spot they belong to.
  const bySlug = new Map<string, SubRow[]>();
  for (const row of subsRes.data as SubRow[]) {
    const slug = row.spot_slug?.trim() || slugifyName(row.restaurant_name);
    if (!slug) continue;
    const group = bySlug.get(slug);
    if (group) group.push(row);
    else bySlug.set(slug, [row]);
  }

  const spots: Spot[] = [];

  const rowPhotoUrls = (row: SubRow): string[] => {
    const paths =
      Array.isArray(row.photo_paths) && row.photo_paths.length > 0
        ? row.photo_paths
        : row.photo_path
          ? [row.photo_path]
          : [];
    return paths.flatMap((p) => photoUrl(p) ?? []);
  };

  const overlay = (base: Spot | null, slug: string, rows: SubRow[]): Spot | null => {
    const versions: SpotVersion[] = [];
    if (base) {
      versions.push({
        days: base.days,
        start: base.start,
        end: base.end,
        deals: base.deals,
        photoUrls: [],
        note: null,
        addedAt: base.sourceDate,
        source: "seed",
      });
    }
    for (const row of rows) {
      const prev = versions[versions.length - 1];
      const days = parseDays(row.days);
      const deals = parseDeals(row.deals, photoUrl);
      versions.push({
        // Hours-only edits carry the menu forward; menu-only photos keep hours.
        days: days.length > 0 ? days : (prev?.days ?? []),
        start: hhmm(row.start_time) ?? (deals.length === 0 ? null : (prev?.start ?? null)),
        end: hhmm(row.end_time) ?? (deals.length === 0 ? null : (prev?.end ?? null)),
        deals: deals.length > 0 ? deals : (prev?.deals ?? []),
        photoUrls: rowPhotoUrls(row),
        note: typeof row.note === "string" && row.note.trim() ? row.note.trim() : null,
        addedAt: row.created_at,
        source: "community",
      });
    }
    const current = versions[versions.length - 1];
    if (!current || current.deals.length === 0) return null;
    // Exact locations only: a community-only spot with no coordinates never
    // made it through geocoding — keep it off the site until it has a pin.
    const hasGeo = rows.some((r) => typeof r.lat === "number" && typeof r.lng === "number");
    if (!base && !hasGeo) return null;
    const latestPhotos =
      [...versions].reverse().find((v) => v.photoUrls.length > 0)?.photoUrls ?? [];
    const latestUrl = [...rows].reverse().find((r) => r.source_url)?.source_url ?? null;
    const latestImage = [...rows].reverse().find((r) => r.image_url)?.image_url ?? null;
    const geocoded = [...rows]
      .reverse()
      .find((r) => typeof r.lat === "number" && typeof r.lng === "number");
    const latestDayHours =
      [...rows].reverse().map((r) => parseHoursByDay(r.hours)).find((h) => h !== null) ?? null;
    const latestAddress = [...rows].reverse().find((r) => r.address)?.address ?? null;
    const latestSub = rows[rows.length - 1];
    const neighborhood =
      base?.neighborhood ??
      [...rows].reverse().find((r) => r.neighborhood)?.neighborhood ??
      "Houston";
    return {
      id: base?.id ?? `sub-${latestSub?.id ?? slug}`,
      slug,
      name: base?.name ?? rows[0].restaurant_name,
      address: base?.address || latestAddress || "",
      lat: base?.lat ?? geocoded?.lat ?? null,
      lng: base?.lng ?? geocoded?.lng ?? null,
      neighborhood,
      days: current.days,
      start: current.start,
      end: current.end,
      deals: current.deals,
      sourceUrl: latestUrl ?? base?.sourceUrl ?? null,
      sourceDate: base?.sourceDate ?? null,
      notes: base?.notes ?? (rows.length > 0 ? "Community-submitted from a menu photo." : null),
      photoUrls: latestPhotos,
      imageUrl: latestImage,
      hoursByDay: latestDayHours,
      communityNote: current.note,
      addedAt: current.source === "community" ? current.addedAt : null,
      history: versions.slice(0, -1).reverse(),
      verification: votes.get(slug),
    };
  };

  for (const s of seed) {
    const rows = bySlug.get(s.slug) ?? [];
    bySlug.delete(s.slug);
    spots.push(overlay(s, s.slug, rows) ?? { ...s, verification: votes.get(s.slug) });
  }
  for (const [slug, rows] of bySlug) {
    const spot = overlay(null, slug, rows);
    if (spot) spots.push(spot);
  }

  return spots.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getAnySpot(slug: string): Promise<Spot | undefined> {
  return (await getAllSpots()).find((s) => s.slug === slug);
}
