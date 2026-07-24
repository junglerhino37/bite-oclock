"use client";

import { useEffect, useMemo, useState } from "react";
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

/** Flow: gather photos + context → read → confirm the place → publish.
 * Nothing runs until the submitter says so, and nothing publishes until the
 * restaurant's identity is positively confirmed (existing listing, verified
 * address lookup, or a typed address). */
type Stage = "gather" | "extracting" | "review" | "done";

interface EditableDeal {
  item: string;
  price: string;
  category: Category;
  description: string;
  /** Only these days ("Monday: $1 wings") — empty = every listed day. */
  days: Day[];
}

interface Draft {
  restaurant: string;
  days: Day[];
  start: string; // "" = unknown / open-ended
  end: string;
  /** All-day deals run the business's full open–close hours. */
  allDay: boolean;
  deals: EditableDeal[];
  /** Public note shown on the listing. */
  note: string;
}

const MAX_PHOTOS = 4;

/** Perceived progress beats a spinner: name the work being done, in order,
 * then keep the wait warm with true Houston food lore. */
const WORK_LINES = [
  "Reading the dish names…",
  "Lining up the prices…",
  "Checking which days…",
  "Squinting at the fine print…",
];
const HOUSTON_BITES = [
  "Ninfa's on Navigation popularized the fajita — right here in Houston.",
  "Viet-Cajun crawfish was invented by Houston's Vietnamese community.",
  "Greater Houston has 10,000+ restaurants. Pace yourself.",
  "Houstonians famously eat out more than almost any city in America.",
  "Houston's Chinatown covers six square miles of dumplings and boba.",
  "Queso is a food group here. This is not up for debate.",
];
const PLATE = ["🍤", "🌮", "🍕", "🦪", "🍗", "🍖"];

function ThinkingTicker() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 2600);
    return () => clearInterval(t);
  }, []);
  const line =
    tick < WORK_LINES.length
      ? WORK_LINES[tick]
      : HOUSTON_BITES[(tick - WORK_LINES.length) % HOUSTON_BITES.length];
  const eaten = tick % (PLATE.length + 1);
  return (
    <div className="mt-4">
      <div aria-hidden className="flex justify-center gap-2 text-2xl">
        {PLATE.map((e, i) => (
          <span
            key={i}
            className="transition-all duration-300"
            style={{ opacity: i < eaten ? 0.15 : 1, transform: i < eaten ? "scale(0.6)" : "none" }}
          >
            {e}
          </span>
        ))}
      </div>
      <p aria-live="polite" className="font-display mt-3 min-h-12 text-lg text-ink">
        {line}
      </p>
      {tick >= WORK_LINES.length && (
        <p className="text-[11px] uppercase tracking-wide text-muted">
          Houston food fact while you wait
        </p>
      )}
    </div>
  );
}

/** "Mo-Su 11:00-21:00" → first time range, good enough to prefill. */
function parseOsmHours(s: string): { start: string; end: string } | null {
  const m = s.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return {
    start: `${m[1].padStart(2, "0")}:${m[2]}`,
    end: `${m[3].padStart(2, "0")}:${m[4]}`,
  };
}

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
    days: (withDays?.happy_hour_days ?? []) as Day[],
    // Menus often omit times; 3–6 PM is the Houston default, editable below.
    // "Specials after 4 PM" keeps its open end — don't invent a closing time.
    start: withTimes?.start || "15:00",
    end: withTimes?.start && !withTimes.end ? "" : withTimes?.end || "18:00",
    allDay: false,
    deals: deals.map((d) => ({
      item: d.item,
      price: d.price ?? "",
      category: d.category as Category,
      description: d.description ?? "",
      days: ((d as { days?: string[] }).days ?? []) as Day[],
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
  const [stage, setStage] = useState<Stage>("gather");
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [hint, setHint] = useState("");
  const [progress, setProgress] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [demo, setDemo] = useState(false);
  const [stored, setStored] = useState(false);
  const [liveSlug, setLiveSlug] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Place identity: address + how we got it + whether the human said "yes".
  const [address, setAddress] = useState<string | null>(null);
  const [addressAuto, setAddressAuto] = useState(false);
  const [placeConfirmed, setPlaceConfirmed] = useState(false);
  const [looking, setLooking] = useState(false);
  const [useMatch, setUseMatch] = useState(true);
  /** Business hours from OSM, when tagged — bounds "all day" deals. */
  const [knownHours, setKnownHours] = useState<{ start: string; end: string } | null>(null);

  function addPhotos(list: FileList) {
    setError(null);
    const incoming = [...list];
    const room = MAX_PHOTOS - photos.length;
    if (incoming.length > room) {
      setError(`Up to ${MAX_PHOTOS} photos total — using the first ${Math.max(0, room)}.`);
    }
    const accepted: File[] = [];
    for (const file of incoming.slice(0, room)) {
      if (!file.type.startsWith("image/")) {
        setError("One of those files doesn't look like an image.");
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError("10 MB max per photo — that one's too big.");
        continue;
      }
      accepted.push(file);
    }
    if (accepted.length === 0) return;
    setPhotos((p) => [...p, ...accepted]);
    setPreviews((p) => [...p, ...accepted.map((f) => URL.createObjectURL(f))]);
  }

  function removePhoto(i: number) {
    URL.revokeObjectURL(previews[i]);
    setPhotos((p) => p.filter((_, j) => j !== i));
    setPreviews((p) => p.filter((_, j) => j !== i));
  }

  function startOver() {
    previews.forEach((p) => URL.revokeObjectURL(p));
    setPhotos([]);
    setPreviews([]);
    setHint("");
    setDraft(null);
    setAddress(null);
    setAddressAuto(false);
    setPlaceConfirmed(false);
    setError(null);
    setStage("gather");
  }

  async function readMenu() {
    if (photos.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    setStage("extracting");
    try {
      const extractions: Extraction[] = [];
      let anyDemo = false;
      for (let i = 0; i < photos.length; i++) {
        setProgress(photos.length > 1 ? `Reading photo ${i + 1} of ${photos.length}…` : null);
        const form = new FormData();
        form.append("photo", photos[i]);
        if (hint.trim()) form.append("hint", hint.trim());
        const res = await fetch("/api/extract", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Couldn't read the menu — your photos are still here.");
          setStage("gather");
          return;
        }
        extractions.push(data.extraction);
        anyDemo = anyDemo || Boolean(data.demo);
      }
      setDraft(draftFromExtractions(extractions, target?.name));
      setAddress(extractions.find((x) => x.address)?.address ?? null);
      setAddressAuto(false);
      setPlaceConfirmed(false);
      setUseMatch(true);
      setDemo(anyDemo);
      setStage("review");
    } catch {
      setError("Network error — your photos are still here, try again.");
      setStage("gather");
    } finally {
      setProgress(null);
      setBusy(false);
    }
  }

  /** Duplicate guard — one listing per physical restaurant. */
  const suggestion = useMemo(() => {
    if (target || !draft?.restaurant.trim()) return null;
    return (
      (address ? bestAddressMatch(address, knownSpots) : null) ??
      bestNameMatch(draft.restaurant, knownSpots)
    );
  }, [target, draft?.restaurant, address, knownSpots]);

  /** Type the name → the address looks itself up, then asks for a yes. */
  useEffect(() => {
    const name = draft?.restaurant.trim();
    if (target || stage !== "review" || suggestion || !name || name.length < 3) return;
    if (address && !addressAuto) return; // never clobber a printed/typed address
    setLooking(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(name)}`);
        const data = await res.json();
        if (data.result?.address) {
          setAddress(data.result.address);
          setAddressAuto(true);
          setPlaceConfirmed(false);
          setKnownHours(
            data.result.openingHours ? parseOsmHours(data.result.openingHours) : null,
          );
        }
      } catch {
        // Lookup is a convenience — silence is fine.
      } finally {
        setLooking(false);
      }
    }, 900);
    return () => {
      clearTimeout(t);
      setLooking(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.restaurant, stage, target, suggestion]);

  const placeReady =
    !!target ||
    (!!suggestion && useMatch) ||
    (!!draft?.restaurant.trim() && !!address && (placeConfirmed || !addressAuto));

  async function publish() {
    if (!draft || busy || !placeReady) return;
    setError(null);
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
            target?.name ??
            (useMatch && suggestion ? suggestion.name : draft.restaurant.trim()),
          spot_slug: target?.slug ?? (useMatch && suggestion ? suggestion.slug : null),
          neighborhood: null, // derived from the location server-side
          address,
          days: draft.days,
          start: draft.start || null,
          end: draft.end || null,
          deals: deals.map((d) => ({
            item: d.item.trim(),
            price: d.price.trim() || null,
            category: d.category,
            description: d.description.trim() || null,
            ...(d.days.length > 0 ? { days: d.days } : {}),
          })),
          note: draft.note.trim() || null,
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
          {stage === "gather" ? (
            <>Snap or pick the menu — nothing happens until you say go.</>
          ) : (
            <>We read it — you fix anything we got wrong, then publish.</>
          )}
        </p>
      </header>

      {stage === "gather" && (
        <div className="space-y-4">
          {previews.length === 0 ? (
            <div>
              <label className="block cursor-pointer rounded-3xl border-2 border-dashed border-line bg-surface p-10 text-center transition-colors hover:border-primary">
                <span className="text-5xl">📸</span>
                <p className="font-display mt-3 text-lg text-ink">Add the menu</p>
                <p className="mt-1 text-xs text-muted">
                  Camera or camera roll · up to {MAX_PHOTOS} photos
                </p>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && addPhotos(e.target.files)}
                />
              </label>
              <label className="mt-2 block cursor-pointer text-center text-xs text-muted underline decoration-line underline-offset-4 hover:text-ink">
                camera didn&rsquo;t show up? open it directly
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => e.target.files && addPhotos(e.target.files)}
                />
              </label>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                {previews.map((p, i) => (
                  <div key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p}
                      alt={`Menu photo ${i + 1}`}
                      className="h-28 w-full rounded-xl border border-line object-cover"
                    />
                    <button
                      onClick={() => removePhoto(i)}
                      aria-label={`Remove photo ${i + 1}`}
                      className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-danger text-xs text-white shadow-sm"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <label className="flex h-28 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-line text-2xl text-muted transition-colors hover:border-primary hover:text-ink">
                    +
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => e.target.files && addPhotos(e.target.files)}
                    />
                  </label>
                )}
              </div>
              <textarea
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                maxLength={300}
                rows={2}
                placeholder='Anything the reader should know? — "This is Rudyard&apos;s on Waugh", "left page only", "prices are per taco"'
                className={`${inputCls} resize-y`}
              />
              <button
                onClick={() => void readMenu()}
                disabled={busy}
                className="w-full rounded-full bg-primary px-5 py-3 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-40"
              >
                Read the menu{photos.length > 1 ? ` (${photos.length} photos)` : ""} →
              </button>
            </>
          )}
        </div>
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
                className="max-h-40 rounded-2xl object-contain"
              />
            ))}
          </div>
          <ThinkingTicker />
          {progress && <p className="mt-1 text-xs text-muted">{progress}</p>}
        </div>
      )}

      {stage === "review" && draft && (
        <div className="space-y-4">
          <button
            onClick={startOver}
            className="text-xs text-muted underline decoration-line underline-offset-4 hover:text-ink"
          >
            ← start over
          </button>
          {demo && (
            <p className="rounded-xl bg-sunken px-4 py-3 text-xs text-muted">
              Demo mode: this instance has no AI key, so this is sample output.
            </p>
          )}

          {!target && !suggestion && (
            <div className="space-y-2 rounded-2xl border border-line bg-surface p-5">
              <label className="block text-xs font-medium uppercase tracking-wide text-muted">
                Which restaurant is this?
                <input
                  value={draft.restaurant}
                  onChange={(e) => {
                    setDraft({ ...draft, restaurant: e.target.value });
                    if (addressAuto) {
                      setAddress(null);
                      setAddressAuto(false);
                    }
                    setPlaceConfirmed(false);
                  }}
                  placeholder="Type the name — the address finds itself"
                  className={`${inputCls} mt-1`}
                />
              </label>
              {looking && <p className="text-xs text-muted">📍 looking it up…</p>}
              {address && addressAuto && !placeConfirmed && (
                <div className="space-y-2 rounded-xl border border-accent/60 bg-accent/10 p-3">
                  <p className="text-sm text-ink">
                    📍 Found <span className="font-medium">{draft.restaurant.trim()}</span> at{" "}
                    <span className="font-medium">{address}</span> — is that the one?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPlaceConfirmed(true)}
                      className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-hover"
                    >
                      ✓ That&rsquo;s it
                    </button>
                    <button
                      onClick={() => {
                        setAddress(null);
                        setAddressAuto(false);
                      }}
                      className="rounded-full border border-line bg-surface px-4 py-1.5 text-sm text-ink hover:bg-sunken"
                    >
                      ✗ No — I&rsquo;ll give the address
                    </button>
                  </div>
                </div>
              )}
              {address && addressAuto && placeConfirmed && (
                <p className="text-sm text-success">
                  📍 {address} ✓{" "}
                  <button
                    onClick={() => {
                      setAddress(null);
                      setAddressAuto(false);
                      setPlaceConfirmed(false);
                    }}
                    className="ml-1 text-xs text-muted underline decoration-line underline-offset-2 hover:text-ink"
                  >
                    change
                  </button>
                </p>
              )}
              {(!address || !addressAuto) && (
                <input
                  value={addressAuto ? "" : (address ?? "")}
                  onChange={(e) => {
                    setAddress(e.target.value || null);
                    setAddressAuto(false);
                  }}
                  placeholder="Street address"
                  className={inputCls}
                />
              )}
            </div>
          )}

          {suggestion && (
            <div className="space-y-2 rounded-2xl border border-accent/60 bg-accent/10 p-4 text-sm">
              <p className="text-ink">
                📍 This looks like{" "}
                <span className="font-display font-semibold">{suggestion.name}</span>
                {suggestion.address && <span className="text-muted"> ({suggestion.address})</span>}
                , which is already listed.
              </p>
              <div className="flex flex-wrap gap-3 text-sm">
                <label className="flex items-center gap-1.5">
                  <input type="radio" checked={useMatch} onChange={() => setUseMatch(true)} name="dupe" />
                  Update {suggestion.name}
                </label>
                <label className="flex items-center gap-1.5 text-muted">
                  <input type="radio" checked={!useMatch} onChange={() => setUseMatch(false)} name="dupe" />
                  Different restaurant
                </label>
              </div>
              {!useMatch && (
                <input
                  value={draft.restaurant}
                  onChange={(e) => setDraft({ ...draft, restaurant: e.target.value })}
                  placeholder="Then what's it called?"
                  className={inputCls}
                />
              )}
            </div>
          )}

          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">When does it run?</p>
            <div className="mt-2 flex gap-1.5">
              <button
                type="button"
                onClick={() => setDraft({ ...draft, allDay: false })}
                className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                  !draft.allDay ? "bg-secondary text-white" : "border border-line bg-surface text-muted hover:text-ink"
                }`}
              >
                ⏰ Set window
              </button>
              <button
                type="button"
                onClick={() =>
                  setDraft({
                    ...draft,
                    allDay: true,
                    ...(knownHours ? { start: knownHours.start, end: knownHours.end } : {}),
                  })
                }
                className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                  draft.allDay ? "bg-secondary text-white" : "border border-line bg-surface text-muted hover:text-ink"
                }`}
              >
                🌞 All day, open to close
              </button>
            </div>
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
                {draft.allDay ? "opens" : "from"}
                <input
                  type="time"
                  value={draft.start}
                  onChange={(e) => setDraft({ ...draft, start: e.target.value })}
                  className="rounded-xl border border-line bg-surface px-2 py-1.5 text-ink"
                />
              </label>
              <label className="flex items-center gap-2 text-muted">
                {draft.allDay ? "closes" : "to"}
                <input
                  type="time"
                  value={draft.end}
                  onChange={(e) => setDraft({ ...draft, end: e.target.value })}
                  className="rounded-xl border border-line bg-surface px-2 py-1.5 text-ink"
                />
              </label>
            </div>
            {draft.allDay && (
              <p className="mt-2 text-xs text-muted">
                {knownHours
                  ? "Prefilled from OpenStreetMap's hours for this place — double-check them."
                  : "Enter the business's open and close times — the deal runs the whole day."}
              </p>
            )}
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
                <div className="flex flex-wrap items-center gap-2">
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
                  <span className="text-[11px] text-muted">only on:</span>
                  <span className="flex gap-1">
                    {DAYS.map((d) => {
                      const on = deal.days.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() =>
                            setDeal(i, {
                              days: on ? deal.days.filter((x) => x !== d) : [...deal.days, d],
                            })
                          }
                          title={on ? `${DAY_LABELS[d]} only` : `Limit to ${DAY_LABELS[d]}`}
                          className={`font-data rounded-full px-1.5 py-0.5 text-[11px] ${
                            on ? "bg-secondary text-white" : "bg-sunken text-muted hover:text-ink"
                          }`}
                        >
                          {DAY_LABELS[d][0]}
                        </button>
                      );
                    })}
                  </span>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setDraft({
                  ...draft,
                  deals: [
                    ...draft.deals,
                    { item: "", price: "", category: "barfood", description: "", days: [] },
                  ],
                })
              }
              className="w-full rounded-xl border-2 border-dashed border-line py-2 text-sm text-muted hover:border-primary hover:text-ink"
            >
              + Add another deal
            </button>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-5">
            <label className="block text-xs font-medium uppercase tracking-wide text-muted">
              Anything the menu doesn&rsquo;t say? <span className="normal-case">(optional)</span>
              <textarea
                value={draft.note}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                maxLength={500}
                rows={2}
                placeholder='e.g. "Bar seating only", "Cash only"'
                className={`${inputCls} mt-1 resize-y`}
              />
            </label>
          </div>

          <button
            onClick={() => void publish()}
            disabled={busy || !placeReady}
            className="w-full rounded-full bg-primary px-5 py-3 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-40"
          >
            {busy
              ? "Publishing…"
              : target
                ? `Publish → update ${target.name}`
                : suggestion && useMatch
                  ? `Publish → update ${suggestion.name}`
                  : "Publish it"}
          </button>
          {!placeReady && (
            <p className="text-center text-xs text-muted">
              Confirm which restaurant this is first — name and address above.
            </p>
          )}
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
                submission wasn&rsquo;t stored.</em>
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

      {stage !== "done" && (
        <p className="text-xs text-muted">
          By submitting you confirm the photo is yours and shows a real, current menu. Location
          metadata is stripped from uploads; the community votes listings up or down after the
          fact, and flagged ones get taken down.
        </p>
      )}
    </div>
  );
}
