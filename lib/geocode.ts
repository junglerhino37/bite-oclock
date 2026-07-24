import "server-only";

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
}

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
    };
  } catch {
    return null;
  }
}

/** Google Places (New) — the real source for business identity + hours.
 * Env-gated on GOOGLE_PLACES_API_KEY; without it we fall back to OSM.
 * openingHours is canonicalized to "HH:MM-HH:MM" as the weekly envelope
 * (earliest open, latest close) — honest bounds for all-day deals. */
async function googlePlaces(query: string): Promise<GeoResult | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      signal: AbortSignal.timeout(6000),
      headers: {
        "content-type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.formattedAddress,places.location,places.regularOpeningHours.periods",
      },
      body: JSON.stringify({ textQuery: `${query}, Houston, TX`, pageSize: 1 }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      places?: {
        formattedAddress?: string;
        location?: { latitude: number; longitude: number };
        regularOpeningHours?: {
          periods?: {
            open?: { hour?: number; minute?: number };
            close?: { hour?: number; minute?: number };
          }[];
        };
      }[];
    };
    const p = data.places?.[0];
    if (!p?.location) return null;
    const lat = p.location.latitude;
    const lng = p.location.longitude;
    if (!(lat > 29.2 && lat < 30.4 && lng > -96.2 && lng < -94.6)) return null;
    const address = String(p.formattedAddress ?? "")
      .replace(/, (USA|United States)$/, "")
      .slice(0, 160);
    let openingHours: string | null = null;
    const periods = p.regularOpeningHours?.periods;
    if (Array.isArray(periods) && periods.length > 0) {
      let open = 24 * 60;
      let close = 0;
      for (const per of periods) {
        if (per.open) open = Math.min(open, (per.open.hour ?? 0) * 60 + (per.open.minute ?? 0));
        if (per.close) close = Math.max(close, (per.close.hour ?? 0) * 60 + (per.close.minute ?? 0));
      }
      if (close > open) {
        const f = (m: number) =>
          `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
        openingHours = `${f(open)}-${f(close)}`;
      }
    }
    return { address: address || `${lat}, ${lng}`, lat, lng, neighborhood: null, openingHours };
  } catch {
    return null;
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

/** Address hint first (menus/users are precise), then name-variant lookups
 * (sequential with a 1s gap per Nominatim's usage policy). */
export async function geocodeSpot(
  name: string,
  addressHint: string | null,
): Promise<GeoResult | null> {
  // Google first when configured — it actually knows restaurants and their
  // hours; the neighborhood still comes from OSM reverse lookup.
  const g = await googlePlaces(addressHint ? `${name}, ${addressHint}` : name);
  if (g) {
    g.neighborhood = await reverseNeighborhood(g.lat, g.lng);
    return g;
  }
  if (addressHint) {
    const q = /houston|,\s*tx/i.test(addressHint) ? addressHint : `${addressHint}, Houston, TX`;
    const byAddress = await geocodeQuery(q);
    if (byAddress) return byAddress;
  }
  let first = true;
  for (const variant of nameVariants(name)) {
    if (!first) await new Promise((r) => setTimeout(r, 1000));
    first = false;
    const hit = await geocodeQuery(`${variant}, Houston, TX`);
    if (hit) return hit;
  }
  return null;
}
