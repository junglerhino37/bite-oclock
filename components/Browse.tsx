"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { Day, DealFilter, Spot } from "@/lib/types";
import { EMPTY_FILTER } from "@/lib/types";
import { applyFilter, spotDistanceMiles, type LatLng } from "@/lib/spots";
import DealCard from "./DealCard";
import FilterBar from "./FilterBar";
import AskBar from "./AskBar";

// Map + bubbles are browser-only (MapLibre/d3) — load them lazily.
const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <ViewSkeleton label="Loading the map…" />,
});
const BubbleView = dynamic(() => import("./BubbleView"), {
  ssr: false,
  loading: () => <ViewSkeleton label="Inflating bubbles…" />,
});

function ViewSkeleton({ label }: { label: string }) {
  return (
    <div className="flex h-[65vh] min-h-[420px] items-center justify-center rounded-2xl border border-line bg-sunken/60 text-sm text-muted">
      {label}
    </div>
  );
}

type View = "list" | "map" | "bubbles";
const VIEWS: { id: View; label: string }[] = [
  { id: "map", label: "🗺 Map" },
  { id: "bubbles", label: "🫧 Bubbles" },
  { id: "list", label: "☰ List" },
];

export default function Browse({
  spots,
  neighborhoods,
  today,
}: {
  spots: Spot[];
  neighborhoods: string[];
  /** Houston's current weekday — the default day filter ("today, not all days"). */
  today: Day;
}) {
  const [view, setView] = useState<View>("map");
  const [filter, setFilter] = useState<DealFilter>({ ...EMPTY_FILTER, day: today });
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [geoNote, setGeoNote] = useState<string | null>(null);

  /** Ask the browser for location — used by the distance filter and the
   * bubbles' price × distance map. */
  const requestLocation = () => {
    if (origin) return;
    if (!("geolocation" in navigator)) {
      setGeoNote("This browser can't share your location.");
      return;
    }
    setGeoNote("Finding you…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoNote(null);
      },
      () => {
        setGeoNote("Couldn't get your location — allow location access to use distance features.");
        setFilter((cur) => ({ ...cur, maxMiles: null }));
      },
      { maximumAge: 5 * 60 * 1000, timeout: 10 * 1000 },
    );
  };

  const changeFilter = (f: DealFilter) => {
    setFilter(f);
    if (f.maxMiles !== null && !origin) requestLocation();
  };

  const [sort, setSort] = useState<"az" | "new">("az");

  const filtered = useMemo(() => {
    const result = applyFilter(spots, filter, new Date(), origin);
    // An active distance filter always sorts nearest-first.
    if (filter.maxMiles !== null && origin) {
      return [...result].sort(
        (a, b) =>
          (spotDistanceMiles(a, origin) ?? Infinity) - (spotDistanceMiles(b, origin) ?? Infinity),
      );
    }
    if (sort === "new") {
      // Community-updated spots newest first; untouched seed spots follow A–Z.
      return [...result].sort(
        (a, b) =>
          (b.addedAt ?? "").localeCompare(a.addedAt ?? "") || a.name.localeCompare(b.name),
      );
    }
    return result;
  }, [spots, filter, origin, sort]);

  return (
    <div className="space-y-5">
      <AskBar onFilter={changeFilter} spots={spots} />
      <FilterBar filter={filter} onChange={changeFilter} neighborhoods={neighborhoods} today={today} />
      {geoNote && <p className="text-xs text-muted">{geoNote}</p>}

      <div className="flex items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Browse view"
          className="inline-flex rounded-full border border-line bg-surface p-1 shadow-sm"
        >
          {VIEWS.map((v) => (
            <button
              key={v.id}
              role="tab"
              aria-selected={view === v.id}
              onClick={() => setView(v.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                view === v.id ? "bg-secondary text-white" : "text-muted hover:text-ink"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "az" | "new")}
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink"
            aria-label="Sort spots"
          >
            <option value="az">A–Z</option>
            <option value="new">🆕 Latest added</option>
          </select>
          <p className="font-data text-sm text-muted">
            {filtered.length} spot{filtered.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {view === "list" &&
        (filtered.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((spot) => (
              <DealCard key={spot.id} spot={spot} distanceMi={spotDistanceMiles(spot, origin)} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-line bg-surface px-6 py-16 text-center">
            <p className="font-display text-xl text-ink">No deals match… yet.</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">
              Know a happy hour we&rsquo;re missing? Be the first to put it on the map — snap the
              menu and it&rsquo;s live after a quick review.
            </p>
            <Link
              href="/submit"
              className="mt-5 inline-block rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-hover"
            >
              + Spot a deal
            </Link>
          </div>
        ))}
      {view === "map" && <MapView spots={filtered} />}
      {view === "bubbles" && (
        <BubbleView spots={filtered} origin={origin} onRequestOrigin={requestLocation} />
      )}
    </div>
  );
}
