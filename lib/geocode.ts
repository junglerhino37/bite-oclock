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

/** Address hint first (menus/users are precise), then a name lookup. */
export async function geocodeSpot(
  name: string,
  addressHint: string | null,
): Promise<GeoResult | null> {
  if (addressHint) {
    const q = /houston|,\s*tx/i.test(addressHint) ? addressHint : `${addressHint}, Houston, TX`;
    const byAddress = await geocodeQuery(q);
    if (byAddress) return byAddress;
  }
  return geocodeQuery(`${name}, Houston, TX`);
}
