"use client";

import type { DealFilter, Day } from "@/lib/types";
import { DAYS, DAY_LABELS } from "@/lib/types";
import { CATEGORIES, CATEGORY_KEYS, type Category } from "@/lib/categories";

export default function FilterBar({
  filter,
  onChange,
  neighborhoods,
  today,
}: {
  filter: DealFilter;
  onChange: (f: DealFilter) => void;
  neighborhoods: string[];
  today: Day;
}) {
  const toggleCategory = (c: Category) =>
    onChange({
      ...filter,
      categories: filter.categories.includes(c)
        ? filter.categories.filter((x) => x !== c)
        : [...filter.categories, c],
    });

  return (
    <div className="space-y-3">
      <div className="-mx-4 overflow-x-auto px-4">
        <div className="flex w-max gap-2 pb-1">
          <button
            onClick={() => onChange({ ...filter, liveNow: !filter.liveNow })}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              filter.liveNow
                ? "border-accent bg-accent text-[#241c15]"
                : "border-line bg-surface text-ink hover:bg-sunken"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${filter.liveNow ? "bg-[#241c15]" : "bg-accent"} ${filter.liveNow ? "" : "live-dot"}`} />
            Open now
          </button>
          {CATEGORY_KEYS.map((c) => {
            const active = filter.categories.includes(c);
            const meta = CATEGORIES[c];
            return (
              <button
                key={c}
                onClick={() => toggleCategory(c)}
                className="shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors"
                style={
                  active
                    ? { background: meta.color, borderColor: meta.color, color: "#fff" }
                    : {
                        background: `${meta.color}14`,
                        borderColor: `${meta.color}55`,
                        color: "var(--text)",
                      }
                }
              >
                {meta.emoji} {meta.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select
          value={filter.day ?? ""}
          onChange={(e) => onChange({ ...filter, day: (e.target.value || null) as Day | null })}
          className="rounded-full border border-line bg-surface px-3 py-1.5 text-ink"
          aria-label="Filter by day"
        >
          <option value="">Any day</option>
          {DAYS.map((d) => (
            <option key={d} value={d}>
              {DAY_LABELS[d]}
              {d === today ? " (today)" : ""}
            </option>
          ))}
        </select>
        <select
          value={filter.maxMiles ?? ""}
          onChange={(e) =>
            onChange({ ...filter, maxMiles: e.target.value ? Number(e.target.value) : null })
          }
          className="rounded-full border border-line bg-surface px-3 py-1.5 text-ink"
          aria-label="Filter by distance"
        >
          <option value="">Any distance</option>
          {[1, 2, 5, 10].map((m) => (
            <option key={m} value={m}>
              📍 Within {m} mi
            </option>
          ))}
        </select>
        <select
          value={filter.neighborhood ?? ""}
          onChange={(e) => onChange({ ...filter, neighborhood: e.target.value || null })}
          className="rounded-full border border-line bg-surface px-3 py-1.5 text-ink"
          aria-label="Filter by neighborhood"
        >
          <option value="">All neighborhoods</option>
          {neighborhoods.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        {(filter.categories.length > 0 ||
          filter.neighborhood ||
          filter.day !== today ||
          filter.liveNow ||
          filter.foodTerms.length > 0 ||
          filter.maxMiles !== null) && (
          <button
            onClick={() =>
              // "Cleared" means back to the default view: today, everything else off.
              onChange({
                categories: [],
                neighborhood: null,
                day: today,
                liveNow: false,
                foodTerms: [],
                maxMiles: null,
              })
            }
            className="rounded-full px-3 py-1.5 text-muted underline decoration-line underline-offset-4 hover:text-ink"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
