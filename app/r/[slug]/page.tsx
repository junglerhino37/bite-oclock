import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getSpots, formatTimeRange } from "@/lib/spots";
import { getAnySpot } from "@/lib/live";
import { CATEGORIES } from "@/lib/categories";
import { DAYS, DAY_LABELS } from "@/lib/types";
import LiveNow from "./live";

// Seed spots are prebuilt; approved community submissions render on demand (ISR).
export const revalidate = 300;

export function generateStaticParams() {
  return getSpots().map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const spot = await getAnySpot((await params).slug);
  return { title: spot ? `${spot.name} — Bite o'Clock` : "Not found — Bite o'Clock" };
}

export default async function SpotPage({ params }: { params: Promise<{ slug: string }> }) {
  const spot = await getAnySpot((await params).slug);
  if (!spot) notFound();
  const dominant = CATEGORIES[spot.deals[0]?.category ?? "barfood"];

  return (
    <article className="space-y-8 pt-6">
      <div
        className="relative overflow-hidden rounded-3xl px-6 py-14 sm:px-10"
        style={{ background: `linear-gradient(140deg, ${dominant.color}33, ${dominant.color}66)` }}
      >
        <span aria-hidden className="absolute -right-4 -top-6 text-[120px] opacity-40">
          {dominant.emoji}
        </span>
        <p className="text-sm font-medium text-muted">
          <Link href="/" className="hover:text-ink">
            ← All happy hours
          </Link>
        </p>
        <h1 className="font-display mt-2 text-4xl font-semibold text-ink sm:text-5xl">
          {spot.name}
        </h1>
        <p className="font-data mt-2 text-sm text-ink/80">
          {spot.neighborhood}
          {spot.address ? ` · ${spot.address}` : ""}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <LiveNow spot={spot} />
          <span className="font-data rounded-full bg-surface/90 px-3 py-1 text-sm text-ink shadow-sm">
            {formatTimeRange(spot)}
          </span>
        </div>
      </div>

      <section>
        <h2 className="font-display text-2xl font-semibold text-ink">The deals</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {spot.deals.map((deal, i) => {
            const meta = CATEGORIES[deal.category];
            return (
              <li
                key={i}
                className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full text-lg"
                    style={{ background: `${meta.color}26` }}
                  >
                    {meta.emoji}
                  </span>
                  <div>
                    <p className="font-medium text-ink">{deal.item}</p>
                    {deal.description && (
                      <p className="text-xs italic text-muted">{deal.description}</p>
                    )}
                    <p className="text-xs text-muted">{meta.label}</p>
                  </div>
                </div>
                {deal.price && (
                  <span className="font-data rounded-full bg-accent px-3 py-1 text-sm font-semibold text-[#241c15]">
                    {deal.price}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="font-display text-2xl font-semibold text-ink">When</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {DAYS.map((d) => (
            <span
              key={d}
              className={`font-data rounded-full px-3.5 py-1.5 text-sm ${
                spot.days.includes(d)
                  ? "bg-secondary text-white"
                  : "bg-sunken text-muted line-through decoration-line"
              }`}
            >
              {DAY_LABELS[d]}
            </span>
          ))}
          <span className="font-data rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm text-ink">
            {formatTimeRange(spot)}
          </span>
        </div>
      </section>

      <section className="rounded-2xl border-2 border-dashed border-line bg-surface p-6 text-center">
        <p className="font-display text-lg text-ink">No dish photos yet — snap the first pic 📸</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">
          Been here at happy hour? Photos from real plates are what make this site worth using.
        </p>
        <Link
          href="/submit"
          className="mt-4 inline-block rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-hover"
        >
          Add a photo or update this deal
        </Link>
      </section>

      <footer className="text-xs text-muted">
        {spot.sourceUrl ? (
          <p>
            Source:{" "}
            <a
              href={spot.sourceUrl}
              rel="nofollow noopener noreferrer"
              target="_blank"
              className="underline decoration-line underline-offset-2 hover:text-ink"
            >
              {new URL(spot.sourceUrl).hostname}
            </a>
            {spot.sourceDate ? ` (${spot.sourceDate})` : ""} — deals change; always confirm with
            the restaurant.
          </p>
        ) : (
          <p>Community-submitted — always confirm with the restaurant.</p>
        )}
        {spot.notes && <p className="mt-1">{spot.notes}</p>}
      </footer>
    </article>
  );
}
