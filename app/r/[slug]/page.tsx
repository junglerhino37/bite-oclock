import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { getSpots, displayTimeRange, formatTimeRange, isDealStale } from "@/lib/spots";
import { getAllSpots, getAnySpot } from "@/lib/live";
import { CATEGORIES } from "@/lib/categories";
import { DAYS, DAY_LABELS, verificationKey } from "@/lib/types";
import { formatDate } from "@/lib/format";
import VerifyButtons from "@/components/VerifyButtons";
import HoursEditor from "@/components/HoursEditor";
import DealRow from "@/components/DealRow";
import NavButton from "@/components/NavButton";
import AskBar from "@/components/AskBar";
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
  const allSpots = await getAllSpots();
  const { slug } = await params;
  const spot = allSpots.find((s) => s.slug === slug);
  if (!spot) notFound();
  const dominant = CATEGORIES[spot.deals[0]?.category ?? "barfood"];
  const history = spot.history ?? [];
  const photos = spot.photoUrls ?? [];

  return (
    <article className="space-y-8 pt-6">
      <div
        className="relative overflow-hidden rounded-3xl px-6 py-14 sm:px-10"
        style={{ background: `linear-gradient(140deg, ${dominant.color}33, ${dominant.color}66)` }}
      >
        {spot.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={spot.imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-30"
          />
        )}
        <span aria-hidden className="absolute -right-4 -top-6 text-[120px] opacity-40">
          {dominant.emoji}
        </span>
        <p className="relative text-sm font-medium text-muted">
          <Link href="/" className="hover:text-ink">
            ← All happy hours
          </Link>
        </p>
        <h1 className="font-display relative mt-2 text-4xl font-semibold text-ink sm:text-5xl">
          {spot.name}
        </h1>
        <p className="font-data relative mt-2 text-sm text-ink/80">
          {spot.neighborhood}
          {spot.address ? ` · ${spot.address}` : ""}
        </p>
        <div className="relative mt-4 flex flex-wrap items-center gap-2">
          <LiveNow spot={spot} />
          <span className="font-data rounded-full bg-surface/90 px-3 py-1 text-sm text-ink shadow-sm">
            {displayTimeRange(spot)}
          </span>
          {spot.sourceUrl && (
            <a
              href={spot.sourceUrl}
              target="_blank"
              rel="nofollow noopener noreferrer"
              className="font-data rounded-full bg-surface/90 px-3 py-1 text-sm text-ink shadow-sm transition-colors hover:text-primary"
            >
              🔗 Happy hour page ↗
            </a>
          )}
          {(spot.address || spot.lat !== null) && (
            <NavButton name={spot.name} address={spot.address} />
          )}
          {spot.addedAt && (
            <span
              suppressHydrationWarning
              className={`font-data rounded-full bg-surface/70 px-3 py-1 text-xs text-muted shadow-sm ${
                Date.now() - Date.parse(spot.addedAt) < 24 * 60 * 60 * 1000 ? "updated-flash" : ""
              }`}
            >
              Updated {formatDate(spot.addedAt)}
            </span>
          )}
        </div>
      </div>

      <AskBar spots={allSpots} />

      {spot.communityNote && (
        <p className="rounded-2xl border border-line bg-sunken/60 px-5 py-3.5 text-sm text-ink">
          📝 <span className="italic">&ldquo;{spot.communityNote}&rdquo;</span>
          <span className="ml-1.5 text-xs text-muted">— submitter note</span>
        </p>
      )}

      {photos.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-2xl font-semibold text-ink">
              The menu{photos.length > 1 ? "s" : ""}
            </h2>
            <Link
              href={`/submit?spot=${spot.slug}`}
              className="shrink-0 rounded-full border border-line bg-surface px-4 py-1.5 text-sm text-ink transition-colors hover:text-primary"
            >
              📸 Update this happy hour
            </Link>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {photos.map((url, i) => (
              <figure
                key={i}
                className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm"
              >
                <a href={url} target="_blank" rel="noopener noreferrer" title="Open full size">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Happy hour menu at ${spot.name}`}
                    className="max-h-96 w-full object-cover object-top"
                  />
                </a>
                {spot.addedAt && i === 0 && (
                  <figcaption className="px-4 py-2.5 text-xs text-muted">
                    Snapped {formatDate(spot.addedAt)} — tap to view full size.
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-display text-2xl font-semibold text-ink">The deals</h2>
        <p className="mt-1 text-xs text-muted">
          Tap ✏️ on any deal to fix its price, add a dish photo, or update it.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {[...spot.deals]
            .sort(
              (a, b) =>
                Number(isDealStale(spot, a.item)) - Number(isDealStale(spot, b.item)),
            )
            .map((deal, i) => (
              <DealRow
                key={`${deal.item}-${i}`}
                slug={spot.slug}
                deal={deal}
                summary={spot.verification?.[verificationKey("deal", deal.item)]}
                stale={isDealStale(spot, deal.item)}
              />
            ))}
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
          {!spot.hoursByDay && (
            <span className="font-data rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm text-ink">
              {formatTimeRange(spot)}
            </span>
          )}
        </div>
        {spot.hoursByDay && (
          <div className="mt-3 grid max-w-sm gap-1">
            {DAYS.map((d) => {
              const h = spot.hoursByDay?.[d];
              return (
                <div
                  key={d}
                  className="font-data flex items-baseline justify-between rounded-lg px-3 py-1 text-sm odd:bg-sunken/50"
                >
                  <span className="text-muted">{DAY_LABELS[d]}</span>
                  <span className={h ? "text-ink" : "text-muted line-through decoration-line"}>
                    {h ? formatTimeRange(h) : "closed"}
                  </span>
                </div>
              );
            })}
            <p className="mt-0.5 text-xs text-muted">
              All-day deal — runs the business&rsquo;s posted hours.
            </p>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <VerifyButtons
            slug={spot.slug}
            kind="hours"
            summary={spot.verification?.hours}
          />
          <HoursEditor spot={spot} />
        </div>
      </section>

      {photos.length === 0 && (
        <section className="rounded-2xl border-2 border-dashed border-line bg-surface p-6 text-center">
          <p className="font-display text-lg text-ink">Been here lately? 📸</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Vote on the deals above so everyone knows what&rsquo;s still real — and snap the
            happy hour menu: a photo is the best proof, and this page updates instantly.
          </p>
          <Link
            href={`/submit?spot=${spot.slug}`}
            className="mt-4 inline-block rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-hover"
          >
            📸 Update this happy hour
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
                {v.photoUrls.length > 0 ? (
                  <a
                    href={v.photoUrls[0]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={v.photoUrls[0]}
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
                  {v.note && <p className="mt-0.5 text-xs italic text-muted">📝 {v.note}</p>}
                </div>
              </li>
            ))}
          </ol>
        </details>
      )}

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
