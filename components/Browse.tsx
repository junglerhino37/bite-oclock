"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { DealFilter, Spot } from "@/lib/types";
import { EMPTY_FILTER } from "@/lib/types";
import { applyFilter } from "@/lib/spots";
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
  { id: "list", label: "☰ List" },
  { id: "map", label: "🗺 Map" },
  { id: "bubbles", label: "🫧 Bubbles" },
];

export default function Browse({
  spots,
  neighborhoods,
}: {
  spots: Spot[];
  neighborhoods: string[];
}) {
  const [view, setView] = useState<View>("list");
  const [filter, setFilter] = useState<DealFilter>(EMPTY_FILTER);
  const filtered = useMemo(() => applyFilter(spots, filter), [spots, filter]);

  return (
    <div className="space-y-5">
      <AskBar onFilter={setFilter} />
      <FilterBar filter={filter} onChange={setFilter} neighborhoods={neighborhoods} />

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
        <p className="font-data text-sm text-muted">
          {filtered.length} spot{filtered.length === 1 ? "" : "s"}
        </p>
      </div>

      {view === "list" &&
        (filtered.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((spot) => (
              <DealCard key={spot.id} spot={spot} />
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
      {view === "bubbles" && <BubbleView spots={filtered} />}
    </div>
  );
}
