"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Extraction } from "@/lib/ai/schemas";
import { CATEGORIES, CATEGORY_KEYS, type Category } from "@/lib/categories";
import { bestAddressMatch, bestNameMatch } from "@/lib/match";
import { DAYS, DAY_LABELS, type Day } from "@/lib/types";

interface KnownSpot {
  slug: string;
  name: string;
  address: string;
}

type Stage = "pick" | "extracting" | "review" | "done";

interface EditableDeal {
  item: string;
  price: string;
  category: Category;
  description: string;
}

interface Draft {
  restaurant: string;
  neighborhood: string;
  days: Day[];
  start: string; // "" = unknown
  end: string;
  deals: EditableDeal[];
  /** Submitter note for things the photos don't say ("cash only", "patio only"). */
  note: string;
}

const MAX_PHOTOS = 4;

/** Merge extractions from several photos of the same menu: deals concatenate
 * (de-duped by item name), days/times come from the first photo that had them. */
function draftFromExtractions(extractions: Extraction[], targetName?: string): Draft {
  const first = extractions[0];
  const withDays = extractions.find((x) => x.happy_hour_days.length > 0);
  const withTimes = extractions.find((x) => x.start || x.end);
  const seen = new Set<string>();
  const deals = extractions
    .flatMap((x) => x.deals)
    .filter((d) => {
      const key = d.item.trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return {
    restaurant: targetName ?? first?.restaurant_candidates[0] ?? "",
    neighborhood: "",
    days: (withDays?.happy_hour_days ?? []) as Day[],
    // Menus often omit times; 3–6 PM is the Houston default, editable below.
    start: withTimes?.start || "15:00",
    end: withTimes?.end || "18:00",
    deals: deals.map((d) => ({
      item: d.item,
      price: d.price ?? "",
      category: d.category as Category,
      description: d.description ?? "",
    })),
    note: "",
  };
}

const inputCls =
  "w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none";

export default function SubmitClient({
  target,
  knownSpots,
}: {
  /** When set, this submission updates an existing spot instead of creating one. */
  target: { slug: string; name: string } | null;
  /** Every listed spot — duplicate detection on the review screen. */
  knownSpots: KnownSpot[];
}) {
  const [stage, setStage] = useState<Stage>("pick");
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [demo, setDemo] = useState(false);
  const [stored, setStored] = useState(false);
  const [liveSlug, setLiveSlug] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedAddress, setExtractedAddress] = useState<string | null>(null);
  const [useMatch, setUseMatch] = useState(true);

  /** Duplicate guard — one listing per physical restaurant. The address
   * printed on the menu wins; otherwise fuzzy name match ("Boheme" →
   * "Bar Boheme"). */
  const suggestion = useMemo(() => {
    if (target || !draft?.restaurant.trim()) return null;
    return (
      (extractedAddress ? bestAddressMatch(extractedAddress, knownSpots) : null) ??
      bestNameMatch(draft.restaurant, knownSpots)
    );
  }, [target, draft?.restaurant, extractedAddress, knownSpots]);

  async function onFiles(list: FileList) {
    setError(null);
    const files = [...list].slice(0, MAX_PHOTOS);
    if ([...list].length > MAX_PHOTOS) {
      setError(`Up to ${MAX_PHOTOS} photos — using the first ${MAX_PHOTOS}.`);
    }
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        setError("One of those files doesn't look like an image.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError("10 MB max per photo — try smaller ones.");
        return;
      }
    }
    if (files.length === 0) return;
    setPhotos(files);
    setPreviews(files.map((f) => URL.createObjectURL(f)));
    setStage("extracting");
    try {
      const extractions: Extraction[] = [];
      let anyDemo = false;
      for (let i = 0; i < files.length; i++) {
        setProgress(files.length > 1 ? `Reading photo ${i + 1} of ${files.length}…` : null);
        const form = new FormData();
        form.append("photo", files[i]);
        const res = await fetch("/api/extract", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Extraction failed.");
          setStage("pick");
          return;
        }
        extractions.push(data.extraction);
        anyDemo = anyDemo || Boolean(data.demo);
      }
      setDraft(draftFromExtractions(extractions, target?.name));
      setExtractedAddress(extractions.find((x) => x.address)?.address ?? null);
      setUseMatch(true);
      setDemo(anyDemo);
      setStage("review");
    } catch {
      setError("Network error — try again.");
      setStage("pick");
    } finally {
      setProgress(null);
    }
  }

  async function submit() {
    if (!draft || busy) return;
    setError(null);
    if (!draft.restaurant.trim()) {
      setError("Give the restaurant a name so we know where the deals live.");
      return;
    }
    const deals = draft.deals.filter((d) => d.item.trim());
    if (deals.length === 0) {
      setError("Keep at least one deal.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append(
        "payload",
        JSON.stringify({
          restaurant_name:
            useMatch && suggestion ? suggestion.name : draft.restaurant.trim(),
          spot_slug: target?.slug ?? (useMatch && suggestion ? suggestion.slug : null),
          neighborhood: draft.neighborhood.trim() || null,
          days: draft.days,
          start: draft.start || null,
          end: draft.end || null,
          note: draft.note.trim() || null,
          deals: deals.map((d) => ({
            item: d.item.trim(),
            price: d.price.trim() || null,
            category: d.category,
            description: d.description.trim() || null,
          })),
        }),
      );
      for (const p of photos) form.append("photos", p);
      const res = await fetch("/api/submit", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Submission failed.");
        return;
      }
      setStored(Boolean(data.stored));
      setLiveSlug(typeof data.slug === "string" ? data.slug : null);
      setStage("done");
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  const setDeal = (i: number, patch: Partial<EditableDeal>) =>
    setDraft((d) =>
      d ? { ...d, deals: d.deals.map((deal, j) => (j === i ? { ...deal, ...patch } : deal)) } : d,
    );

  return (
    <div className="mx-auto max-w-xl space-y-6 pt-8">
      <header>
        <h1 className="font-display text-3xl font-semibold text-ink">
          {target ? `Update ${target.name}` : "Spot a deal"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {target ? (
            <>
              Snap their current happy hour menu — it becomes the new version of this listing
              the moment you publish, and the old one moves into its history.
            </>
          ) : (
            <>
              Snap the happy hour menu, we&rsquo;ll read it — then you fix anything we got
              wrong. Once you hit publish it goes straight onto the site.
            </>
          )}
        </p>
      </header>

      {stage === "pick" && (
        <label className="block cursor-pointer rounded-3xl border-2 border-dashed border-line bg-surface p-10 text-center transition-colors hover:border-primary">
          <span className="text-5xl">📸</span>
          <p className="font-display mt-3 text-lg text-ink">Upload menu photos</p>
          <p className="mt-1 text-xs text-muted">
            Up to {MAX_PHOTOS} photos (front + back, both pages…) · JPEG, PNG, or WebP · 10 MB each
          </p>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && onFiles(e.target.files)}
          />
        </label>
      )}

      {stage === "extracting" && (
        <div className="rounded-3xl border border-line bg-surface p-10 text-center">
          <div className="flex flex-wrap justify-center gap-3">
            {previews.map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={p}
                alt={`Menu photo ${i + 1}`}
                className="max-h-48 rounded-2xl object-contain"
              />
            ))}
          </div>
          <p className="font-display mt-4 text-lg text-ink">{progress ?? "Reading the menu…"}</p>
          <p className="mt-1 text-xs text-muted">Prices, times, and dishes are being extracted.</p>
        </div>
      )}

      {stage === "review" && draft && (
        <div className="space-y-4">
          {demo && (
            <p className="rounded-xl bg-sunken px-4 py-3 text-xs text-muted">
              Demo mode: this instance has no AI key, so this is sample output. The flow is
              identical with a real key.
            </p>
          )}

          <div className="flex gap-4 rounded-2xl border border-line bg-surface p-5">
            {previews.length > 0 && (
              <div className="flex shrink-0 flex-col gap-2">
                {previews.map((p, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={p}
                    alt={`Your menu photo ${i + 1}`}
                    className="h-24 w-24 rounded-xl object-cover"
                  />
                ))}
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <label className="block text-xs font-medium uppercase tracking-wide text-muted">
                Restaurant
                <input
                  value={draft.restaurant}
                  onChange={(e) => setDraft({ ...draft, restaurant: e.target.value })}
                  placeholder="Which restaurant is this?"
                  className={`${inputCls} mt-1`}
                />
              </label>
              <label className="block text-xs font-medium uppercase tracking-wide text-muted">
                Neighborhood <span className="normal-case">(optional)</span>
                <input
                  value={draft.neighborhood}
                  onChange={(e) => setDraft({ ...draft, neighborhood: e.target.value })}
                  placeholder="Montrose, Heights, EaDo…"
                  className={`${inputCls} mt-1`}
                />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-5">
            <label className="block text-xs font-medium uppercase tracking-wide text-muted">
              Anything the menu doesn&rsquo;t say? <span className="normal-case">(optional)</span>
              <textarea
                value={draft.note}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                maxLength={500}
                rows={2}
                placeholder='e.g. "Bar seating only", "Cash only", "Everyday 3–6 even though the menu doesn&apos;t say"'
                className={`${inputCls} mt-1 resize-y`}
              />
            </label>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              When does it run? <span className="normal-case">(fill in anything the menu didn&rsquo;t say)</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {DAYS.map((d) => {
                const on = draft.days.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        days: on ? draft.days.filter((x) => x !== d) : [...draft.days, d],
                      })
                    }
                    className={`font-data rounded-full px-3 py-1.5 text-sm transition-colors ${
                      on ? "bg-secondary text-white" : "bg-sunken text-muted hover:text-ink"
                    }`}
                  >
                    {DAY_LABELS[d]}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-2 text-sm">
              <label className="flex items-center gap-2 text-muted">
                from
                <input
                  type="time"
                  value={draft.start}
                  onChange={(e) => setDraft({ ...draft, start: e.target.value })}
                  className="rounded-xl border border-line bg-surface px-2 py-1.5 text-ink"
                />
              </label>
              <label className="flex items-center gap-2 text-muted">
                to
                <input
                  type="time"
                  value={draft.end}
                  onChange={(e) => setDraft({ ...draft, end: e.target.value })}
                  className="rounded-xl border border-line bg-surface px-2 py-1.5 text-ink"
                />
              </label>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-line bg-surface p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">The deals</p>
            {draft.deals.map((deal, i) => (
              <div key={i} className="space-y-2 rounded-xl bg-sunken/60 p-3">
                <div className="flex gap-2">
                  <input
                    value={deal.item}
                    onChange={(e) => setDeal(i, { item: e.target.value })}
                    placeholder="Dish"
                    className={inputCls}
                  />
                  <input
                    value={deal.price}
                    onChange={(e) => setDeal(i, { price: e.target.value })}
                    placeholder="$"
                    className={`${inputCls} w-24 shrink-0`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({ ...draft, deals: draft.deals.filter((_, j) => j !== i) })
                    }
                    aria-label="Remove deal"
                    className="shrink-0 rounded-xl px-2 text-muted hover:text-danger"
                  >
                    ✕
                  </button>
                </div>
                <input
                  value={deal.description}
                  onChange={(e) => setDeal(i, { description: e.target.value })}
                  placeholder="Description on the menu (optional)"
                  className={inputCls}
                />
                <select
                  value={deal.category}
                  onChange={(e) => setDeal(i, { category: e.target.value as Category })}
                  className="rounded-xl border border-line bg-surface px-2 py-1.5 text-sm text-ink"
                >
                  {CATEGORY_KEYS.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORIES[c].emoji} {CATEGORIES[c].label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setDraft({
                  ...draft,
                  deals: [
                    ...draft.deals,
                    { item: "", price: "", category: "barfood", description: "" },
                  ],
                })
              }
              className="w-full rounded-xl border-2 border-dashed border-line py-2 text-sm text-muted hover:border-primary hover:text-ink"
            >
              + Add another deal
            </button>
          </div>

          {suggestion && (
            <div className="space-y-2 rounded-2xl border border-accent/60 bg-accent/10 p-4 text-sm">
              <p className="text-ink">
                ⚠️ This looks like{" "}
                <span className="font-display font-semibold">{suggestion.name}</span>
                {suggestion.address && <span className="text-muted"> ({suggestion.address})</span>}
                , which is already listed — one listing per restaurant keeps votes and history
                together.
              </p>
              <div className="flex flex-wrap gap-3 text-sm">
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    checked={useMatch}
                    onChange={() => setUseMatch(true)}
                    name="dupe"
                  />
                  Update {suggestion.name}
                </label>
                <label className="flex items-center gap-1.5 text-muted">
                  <input
                    type="radio"
                    checked={!useMatch}
                    onChange={() => setUseMatch(false)}
                    name="dupe"
                  />
                  No, this is a different restaurant
                </label>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={busy}
              className="flex-1 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-40"
            >
              {busy
                ? "Publishing…"
                : suggestion && useMatch
                  ? `Publish → update ${suggestion.name}`
                  : "Publish it"}
            </button>
            <button
              onClick={() => {
                setStage("pick");
                setDraft(null);
                setPhotos([]);
                setPreviews([]);
              }}
              className="rounded-full border border-line bg-surface px-5 py-2.5 text-sm text-ink hover:bg-sunken"
            >
              Retake
            </button>
          </div>
        </div>
      )}

      {stage === "done" && (
        <div className="rounded-3xl border border-line bg-surface p-10 text-center">
          <span className="text-5xl">🏆</span>
          <p className="font-display mt-3 text-xl text-ink">You&rsquo;re on the board.</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            {stored ? (
              <>Thanks for feeding Houston — it&rsquo;s live on the site right now.</>
            ) : (
              <>
                Thanks for feeding Houston. <em>This instance has no database configured, so the
                submission wasn&rsquo;t stored — add Supabase credentials (see README) to enable
                real persistence.</em>
              </>
            )}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            {stored && liveSlug && (
              <Link
                href={`/r/${liveSlug}`}
                className="inline-block rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-hover"
              >
                See it live →
              </Link>
            )}
            <Link
              href="/"
              className="inline-block rounded-full bg-secondary px-5 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Back to the deals
            </Link>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <p className="text-xs text-muted">
        By submitting you confirm the photo is yours and shows a real, current menu. Location
        metadata is stripped from uploads; the community votes listings up or down after the
        fact, and flagged ones get taken down.
      </p>
    </div>
  );
}
