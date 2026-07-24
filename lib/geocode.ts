import "server-only";
import type { Day, DayHours } from "./types";

/** OpenStreetMap Nominatim lookup (identified UA, one call per action, per
 * usage policy). Results outside greater Houston are discarded — a wrong pin
 * is worse than no pin. */
export interface GeoResult {
  address: string;
  lat: number;
  lng: number;
  /** Derived from the location — nobody should have to type a neighborhood. */
  neighborhood: string | null;
  /** OSM opening_hours string when tagged (e.g. "Mo-Su 11:00-21:00") —
   * lets "all day" deals bound themselves to the business's real hours. */
  openingHours: string | null;
  /** Day-accurate hours (Google only) — businesses open later on Fridays. */
  hoursByDay: Partial<Record<Day, DayHours>> | null;
}

const GOOGLE_DAYS: Day[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export async function geocodeQuery(query: string): Promise<GeoResult | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&extratags=1&q=${encodeURIComponent(query)}`,
      {
        signal: AbortSignal.timeout(6000),
        headers: { "user-agent": "bite-oclock/1.0 (Houston happy hour directory)" },
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      lat: string;
      lon: string;
      display_name: string;
      address?: Record<string, string>;
      extratags?: Record<string, string>;
    }[];
    const hit = data[0];
    if (!hit) return null;
    const lat = parseFloat(hit.lat);
    const lng = parseFloat(hit.lon);
    if (!(lat > 29.2 && lat < 30.4 && lng > -96.2 && lng < -94.6)) return null;
    const address = hit.display_name.split(",").slice(0, 3).join(",").trim().slice(0, 160);
    const neighborhood =
      hit.address?.suburb ?? hit.address?.neighbourhood ?? hit.address?.city_district ?? null;
    return {
      address,
      lat,
      lng,
      neighborhood: neighborhood?.slice(0, 60) ?? null,
      openingHours: hit.extratags?.opening_hours?.slice(0, 120) ?? null,
      hoursByDay: null,
    };
  } catch {
    return null;
  }
}

interface GooglePlace {
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  regularOpeningHours?: {
    periods?: {
      open?: { day?: number; hour?: number; minute?: number };
      close?: { day?: number; hour?: number; minute?: number };
    }[];
  };
}

function parseGooglePlace(p: GooglePlace): GeoResult | null {
  if (!p?.location) return null;
  const lat = p.location.latitude;
  const lng = p.location.longitude;
  if (!(lat > 29.2 && lat < 30.4 && lng > -96.2 && lng < -94.6)) return null;
  const address = String(p.formattedAddress ?? "")
    .replace(/, (USA|United States)$/, "")
    .slice(0, 160);
  let openingHours: string | null = null;
  let hoursByDay: Partial<Record<Day, DayHours>> | null = null;
  const periods = p.regularOpeningHours?.periods;
  if (Array.isArray(periods) && periods.length > 0) {
    const f = (h?: number, m?: number) =>
      `${String(h ?? 0).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}`;
    let open = 24 * 60;
    let close = 0;
    hoursByDay = {};
    for (const per of periods) {
      if (!per.open) continue;
      const day = GOOGLE_DAYS[per.open.day ?? -1];
      const start = f(per.open.hour, per.open.minute);
      // Past-midnight closes clamp to end-of-day; our windows are per-day.
      const sameDay = per.close?.day === per.open.day;
      const end = per.close ? (sameDay ? f(per.close.hour, per.close.minute) : "23:59") : null;
      if (day && !hoursByDay[day]) hoursByDay[day] = { start, end };
      open = Math.min(open, (per.open.hour ?? 0) * 60 + (per.open.minute ?? 0));
      if (per.close) close = Math.max(close, (per.close.hour ?? 0) * 60 + (per.close.minute ?? 0));
    }
    if (Object.keys(hoursByDay).length === 0) hoursByDay = null;
    if (close > open) {
      const g = (m: number) =>
        `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      openingHours = `${g(open)}-${g(close)}`;
    }
  }
  return {
    address: address || `${lat}, ${lng}`,
    lat,
    lng,
    neighborhood: null,
    openingHours,
    hoursByDay,
  };
}

const normName = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");

/** Google Places (New) — the real source for business identity + hours.
 * Env-gated on GOOGLE_PLACES_API_KEY; without it we fall back to OSM.
 * openingHours is canonicalized to "HH:MM-HH:MM" as the weekly envelope
 * (earliest open, latest close) — honest bounds for all-day deals.
 * Returns up to `max` Houston locations; chains ("Slowpokes") have several,
 * and each deserves its own pin. `nameFilter` keeps only results that are
 * plausibly the same business, so "other locations" never means "whatever
 * else Google found nearby" — but if the filter rejects everything, the top
 * result is kept (the searcher may have typed a partial name). */
async function googlePlaces(query: string, nameFilter: string | null, max: number): Promise<GeoResult[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      signal: AbortSignal.timeout(6000),
      headers: {
        "content-type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.displayName,places.formattedAddress,places.location,places.regularOpeningHours.periods",
      },
      body: JSON.stringify({ textQuery: `${query}, Houston, TX`, pageSize: Math.min(Math.max(max, 1), 5) }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { places?: GooglePlace[] };
    const places = data.places ?? [];
    const wanted = nameFilter ? normName(nameVariants(nameFilter)[0] ?? nameFilter) : "";
    const sameName = (p: GooglePlace) => {
      if (!wanted) return true;
      const got = normName(p.displayName?.text ?? "");
      return got.length > 0 && (got.includes(wanted) || wanted.includes(got));
    };
    const filtered = places.filter(sameName);
    const kept = filtered.length > 0 ? filtered : places.slice(0, 1);
    return kept.slice(0, max).flatMap((p) => parseGooglePlace(p) ?? []);
  } catch {
    return [];
  }
}

/** Nominatim reverse lookup just for the neighborhood name. */
async function reverseNeighborhood(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
      {
        signal: AbortSignal.timeout(5000),
        headers: { "user-agent": "bite-oclock/1.0 (Houston happy hour directory)" },
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { address?: Record<string, string> };
    const n =
      data.address?.suburb ?? data.address?.neighbourhood ?? data.address?.city_district ?? null;
    return n?.slice(0, 60) ?? null;
  } catch {
    return null;
  }
}

/** People type "bambolinos on westheimer"; OSM knows "Bambolino's".
 * Strip location filler and try apostrophe variants (names ending in s are
 * usually possessives: pistoleros → Pistolero's). */
function nameVariants(raw: string): string[] {
  const cleaned = raw.trim().replace(/\s+/g, " ");
  const m = cleaned.match(/^(.+?)\s+(?:on|at|off|near|in)\s+.+$/i);
  const base = (m ? m[1] : cleaned).trim();
  const words = base.split(" ");
  const last = words[words.length - 1];
  const apos =
    /^[A-Za-z]{3,}s$/.test(last) && !/['’]s$/.test(last)
      ? [...words.slice(0, -1), `${last.slice(0, -1)}'s`].join(" ")
      : null;
  return [...new Set([base, apos, cleaned].filter((v): v is string => !!v))];
}

/** Every Houston location of a business (chains get one listing per pin).
 * Google first when configured — it knows restaurants, their hours, and their
 * other locations. OSM fallbacks only ever produce one result: address hint
 * first (menus/users are precise), then name-variant lookups (sequential with
 * a 1s gap per Nominatim's usage policy). Neighborhoods are NOT filled in
 * here — callers reverse-lookup only the locations they actually use. */
export async function geocodeSpotAll(
  name: string,
  addressHint: string | null,
  max = 5,
): Promise<GeoResult[]> {
  const g = await googlePlaces(addressHint ? `${name}, ${addressHint}` : name, name, max);
  if (g.length > 0) return g;
  if (addressHint) {
    const q = /houston|,\s*tx/i.test(addressHint) ? addressHint : `${addressHint}, Houston, TX`;
    const byAddress = await geocodeQuery(q);
    if (byAddress) return [byAddress];
  }
  let first = true;
  for (const variant of nameVariants(name)) {
    if (!first) await new Promise((r) => setTimeout(r, 1000));
    first = false;
    const hit = await geocodeQuery(`${variant}, Houston, TX`);
    if (hit) return [hit];
  }
  return [];
}

/** Single-location lookup (review screen, primary pin) with neighborhood. */
export async function geocodeSpot(
  name: string,
  addressHint: string | null,
): Promise<GeoResult | null> {
  const hit = (await geocodeSpotAll(name, addressHint, 1))[0] ?? null;
  if (hit && !hit.neighborhood) hit.neighborhood = await reverseNeighborhood(hit.lat, hit.lng);
  return hit;
}

export { reverseNeighborhood };
