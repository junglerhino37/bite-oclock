"use client";

import { useState } from "react";
import Map, { Marker, Popup } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import Link from "next/link";
import type { Spot } from "@/lib/types";
import { CATEGORIES } from "@/lib/categories";
import { formatTimeRange, isLiveNow } from "@/lib/spots";

const HOUSTON = { longitude: -95.39, latitude: 29.755, zoom: 11.4 };

/** MapLibre + OpenFreeMap tiles: free, keyless, unlimited (see DESIGN.md for
 * the planned custom warm style — positron is the closest stock base). */
const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

export default function MapView({ spots }: { spots: Spot[] }) {
  const [selected, setSelected] = useState<Spot | null>(null);

  return (
    <div className="h-[70vh] min-h-[420px] overflow-hidden rounded-2xl border border-line shadow-md">
      <Map
        initialViewState={HOUSTON}
        mapStyle={MAP_STYLE}
        style={{ width: "100%", height: "100%" }}
        attributionControl={{ compact: true }}
      >
        {spots
          .filter((s) => s.lat !== null && s.lng !== null)
          .map((spot) => {
          const meta = CATEGORIES[spot.deals[0]?.category ?? "barfood"];
          const live = isLiveNow(spot);
          return (
            <Marker
              key={spot.id}
              longitude={spot.lng!}
              latitude={spot.lat!}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setSelected(spot);
              }}
            >
              <button
                aria-label={spot.name}
                className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-white text-base shadow-md transition-transform hover:scale-110 ${
                  live ? "live-dot" : ""
                }`}
                style={{
                  background: live ? "var(--accent)" : "var(--primary)",
                  transitionTimingFunction: "var(--ease-spring)",
                }}
              >
                {meta.emoji}
              </button>
            </Marker>
          );
        })}
        {selected && selected.lng !== null && selected.lat !== null && (
          <Popup
            longitude={selected.lng}
            latitude={selected.lat}
            anchor="top"
            onClose={() => setSelected(null)}
            closeButton={false}
            maxWidth="280px"
          >
            <Link href={`/r/${selected.slug}`} className="block p-3">
              <p className="font-display text-base font-semibold text-ink">{selected.name}</p>
              <p className="font-data mt-0.5 text-xs text-muted">
                {selected.neighborhood} · {formatTimeRange(selected)}
              </p>
              <ul className="mt-2 space-y-0.5 text-xs text-ink">
                {selected.deals.slice(0, 3).map((d, i) => (
                  <li key={i}>
                    {CATEGORIES[d.category].emoji} {d.item}
                    {d.price ? ` — ${d.price}` : ""}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs font-medium text-primary">See details →</p>
            </Link>
          </Popup>
        )}
      </Map>
    </div>
  );
}
