import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getSpots, formatTimeRange } from "@/lib/spots";
import { getAnySpot } from "@/lib/live";
import { CATEGORIES } from "@/lib/categories";
import { DAYS, DAY_LABELS, verificationKey } from "@/lib/types";
import { formatDate } from "@/lib/format";
import VerifyButtons from "@/components/VerifyButtons";
import HoursEditor from "@/components/HoursEditor";
import LiveNow from "./live";

// Seed spots are prebuilt; community versions and votes re-render on demand —
// writes call revalidatePath so edits show up immediately.
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
  const history = spot.history ?? [];

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
          {spot.addedAt && (
            <span className="font-data rounded-full bg-surface/70 px-3 py-1 text-xs text-muted shadow-sm">
              Updated {formatDate(spot.addedAt)}
            </span>
          )}
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
                className="space-y-3 rounded-2xl border border-line bg-surface p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
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
                </div>
                <div className="border-t border-line pt-2.5">
                  <VerifyButtons
                    slug={spot.slug}
                    kind="deal"
                    target={deal.item}
                    summary={spot.verification?.[verificationKey("deal", deal.item)]}
                    compact
                  />
                </div>
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
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <VerifyButtons
            slug={spot.slug}
            kind="hours"
            summary={spot.verification?.hours}
          />
          <HoursEditor spot={spot} />
        </div>
      </section>

      {spot.photoUrl ? (
        <section>
          <h2 className="font-display text-2xl font-semibold text-ink">Menu snapshot</h2>
          <figure className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm sm:max-w-md">
            <a href={spot.photoUrl} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={spot.photoUrl} alt={`Happy hour menu at ${spot.name}`} className="w-full" />
            </a>
            {spot.addedAt && (
              <figcaption className="px-4 py-2.5 text-xs text-muted">
                Snapped {formatDate(spot.addedAt)} — deals above come from this menu.
              </figcaption>
            )}
          </figure>
        </section>
      ) : (
        <section className="rounded-2xl border-2 border-dashed border-line bg-surface p-6 text-center">
          <p className="font-display text-lg text-ink">No menu snapshot yet — snap one 📸</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            A photo of the actual happy hour menu is the best proof these deals are real.
          </p>
          <Link
            href={`/submit?spot=${spot.slug}`}
            className="mt-4 inline-block rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-hover"
          >
            Add a photo or update this deal
          </Link>
        </section>
      )}

      {history.length > 0 && (
        <details className="group rounded-2xl border border-line bg-surface">
          <summary className="cursor-pointer select-none px-5 py-4 font-display text-lg text-ink marker:content-none">
            <span className="mr-2 inline-block transition-transform group-open:rotate-90">▸</span>
            How this happy hour has changed
            <span className="font-data ml-2 text-xs text-muted">
              {history.length} earlier version{history.length === 1 ? "" : "s"}
            </span>
          </summary>
          <ol className="space-y-4 border-t border-line px-5 py-4">
            {history.map((v, i) => (
              <li key={i} className="flex gap-4">
                {v.photoUrl ? (
                  <a
                    href={v.photoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={v.photoUrl}
                      alt="Older menu snapshot"
                      className="h-16 w-16 rounded-xl border border-line object-cover"
                    />
                  </a>
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-sunken text-2xl">
                    {v.source === "seed" ? "📰" : "🕰"}
                  </div>
                )}
                <div className="min-w-0 text-sm">
                  <p className="font-data text-xs text-muted">
                    {v.addedAt ? formatDate(v.addedAt) : "original listing"}
                    {v.source === "seed" ? " · from the original source" : ""}
                  </p>
                  <p className="mt-0.5 text-ink">
                    {v.days.map((d) => DAY_LABELS[d]).join(" ") || "days unknown"} ·{" "}
                    {formatTimeRange(v)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {v.deals
                      .slice(0, 4)
                      .map((d) => `${d.item}${d.price ? ` ${d.price}` : ""}`)
                      .join(" · ")}
                    {v.deals.length > 4 ? ` · +${v.deals.length - 4} more` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </details>
      )}

      <section className="rounded-2xl border-2 border-dashed border-line bg-surface p-6 text-center">
        <p className="font-display text-lg text-ink">Been here lately?</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">
          Vote on the deals above so everyone knows what&rsquo;s still real — or snap the newest
          menu and this page updates instantly.
        </p>
        <Link
          href={`/submit?spot=${spot.slug}`}
          className="mt-4 inline-block rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-hover"
        >
          📸 Update this happy hour
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
