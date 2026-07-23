"use client";

import Link from "next/link";
import type { Spot } from "@/lib/types";
import { DAY_LABELS } from "@/lib/types";
import { CATEGORIES } from "@/lib/categories";
import { formatTimeRange, isLiveNow, latestVerifiedAt } from "@/lib/spots";
import { timeAgo } from "@/lib/format";

/** Photo-forward deal card. Until a spot has real dish photos, the header is a
 * warm two-tone gradient in its dominant category color with an oversized emoji
 * — never a gray placeholder (DESIGN.md). */
export default function DealCard({
  spot,
  distanceMi = null,
}: {
  spot: Spot;
  /** Miles from the visitor, when their location is known. */
  distanceMi?: number | null;
}) {
  const dominant = spot.deals[0]?.category ?? "barfood";
  const meta = CATEGORIES[dominant];
  const live = isLiveNow(spot);
  const verified = latestVerifiedAt(spot);
  // Real dish photos beat the og:image beat the category gradient.
  const headerImage = spot.deals.find((d) => d.photoUrl)?.photoUrl ?? spot.imageUrl ?? null;
  // Flash a badge for a day after a community update so a refreshed listing
  // stands out on the grid (an update changes an existing card in place).
  const updatedRecently =
    spot.addedAt != null && Date.now() - Date.parse(spot.addedAt) < 24 * 60 * 60 * 1000;

  return (
    <Link
      href={`/r/${spot.slug}`}
      className="card-lift group block overflow-hidden rounded-2xl border border-line bg-surface"
    >
      <div
        className="relative flex h-36 items-center justify-center overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${meta.color}26, ${meta.color}59)`,
        }}
      >
        {headerImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={headerImage}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            style={{ transitionTimingFunction: "var(--ease-spring)" }}
          />
        ) : (
          <span
            aria-hidden
            className="text-6xl transition-transform duration-300 group-hover:scale-110"
            style={{ transitionTimingFunction: "var(--ease-spring)" }}
          >
            {meta.emoji}
          </span>
        )}
        {live && (
          <span className="live-dot absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-[#241c15]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#241c15]" /> LIVE NOW
          </span>
        )}
        {updatedRecently && spot.addedAt && (
          <span
            suppressHydrationWarning
            className="updated-flash absolute right-3 top-3 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-white"
          >
            ✨ Updated {timeAgo(spot.addedAt)}
          </span>
        )}
        <span className="font-data absolute bottom-3 right-3 rounded-full bg-surface/90 px-2.5 py-1 text-xs font-medium text-ink shadow-sm">
          {spot.days.map((d) => DAY_LABELS[d]).join(" ")} · {formatTimeRange(spot)}
        </span>
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-display text-lg font-semibold leading-tight text-ink">{spot.name}</h3>
          <span className="shrink-0 text-xs text-muted">
            {distanceMi !== null && (
              <span className="font-data mr-1.5 text-ink/70">{distanceMi.toFixed(1)} mi</span>
            )}
            {spot.neighborhood}
          </span>
        </div>
        {verified && (
          <p suppressHydrationWarning className="font-data text-[11px] text-success">
            ✓ verified {timeAgo(verified)}
          </p>
        )}
        <ul className="flex flex-wrap gap-1.5">
          {spot.deals.slice(0, 4).map((deal, i) => (
            <li
              key={i}
              className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs"
              style={{
                background: `${CATEGORIES[deal.category].color}1a`,
                color: "var(--text)",
              }}
            >
              <span>{deal.item}</span>
              {deal.price && (
                <span className="font-data rounded-full bg-accent px-1.5 py-px text-[10px] font-semibold text-[#241c15]">
                  {deal.price}
                </span>
              )}
            </li>
          ))}
          {spot.deals.length > 4 && (
            <li className="rounded-full bg-sunken px-2.5 py-1 text-xs text-muted">
              +{spot.deals.length - 4} more
            </li>
          )}
        </ul>
      </div>
    </Link>
  );
}
