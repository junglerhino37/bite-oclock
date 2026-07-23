"use client";

import { useState } from "react";
import Link from "next/link";
import type { Extraction } from "@/lib/ai/schemas";
import { CATEGORIES, CATEGORY_KEYS, type Category } from "@/lib/categories";
import { DAYS, DAY_LABELS, type Day } from "@/lib/types";

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
}

function draftFromExtraction(x: Extraction): Draft {
  return {
    restaurant: x.restaurant_candidates[0] ?? "",
    neighborhood: "",
    days: x.happy_hour_days as Day[],
    start: x.start ?? "",
    end: x.end ?? "",
    deals: x.deals.map((d) => ({
      item: d.item,
      price: d.price ?? "",
      category: d.category as Category,
      description: d.description ?? "",
    })),
  };
}

const inputCls =
  "w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none";

export default function SubmitPage() {
  const [stage, setStage] = useState<Stage>("pick");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [demo, setDemo] = useState(false);
  const [stored, setStored] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File) {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("That doesn't look like an image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("10 MB max — try a smaller photo.");
      return;
    }
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
    setStage("extracting");
    try {
      const form = new FormData();
      form.append("photo", file);
      const res = await fetch("/api/extract", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Extraction failed.");
        setStage("pick");
        return;
      }
      setDraft(draftFromExtraction(data.extraction));
      setDemo(Boolean(data.demo));
      setStage("review");
    } catch {
      setError("Network error — try again.");
      setStage("pick");
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
          restaurant_name: draft.restaurant.trim(),
          neighborhood: draft.neighborhood.trim() || null,
          days: draft.days,
          start: draft.start || null,
          end: draft.end || null,
          deals: deals.map((d) => ({
            item: d.item.trim(),
            price: d.price.trim() || null,
            category: d.category,
            description: d.description.trim() || null,
          })),
        }),
      );
      if (photo) form.append("photo", photo);
      const res = await fetch("/api/submit", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Submission failed.");
        return;
      }
      setStored(Boolean(data.stored));
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
        <h1 className="font-display text-3xl font-semibold text-ink">Spot a deal</h1>
        <p className="mt-2 text-sm text-muted">
          Snap the happy hour menu, we&rsquo;ll read it — then you fix anything we got wrong.
          Everything goes through a quick human review before it appears on the site.
        </p>
      </header>

      {stage === "pick" && (
        <label className="block cursor-pointer rounded-3xl border-2 border-dashed border-line bg-surface p-10 text-center transition-colors hover:border-primary">
          <span className="text-5xl">📸</span>
          <p className="font-display mt-3 text-lg text-ink">Upload a menu photo</p>
          <p className="mt-1 text-xs text-muted">JPEG, PNG, or WebP · 10 MB max</p>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </label>
      )}

      {stage === "extracting" && (
        <div className="rounded-3xl border border-line bg-surface p-10 text-center">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Menu preview"
              className="mx-auto max-h-64 rounded-2xl object-contain"
            />
          )}
          <p className="font-display mt-4 text-lg text-ink">Reading the menu…</p>
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
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Your menu photo"
                className="h-24 w-24 shrink-0 rounded-xl object-cover"
              />
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

          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={busy}
              className="flex-1 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-40"
            >
              {busy ? "Submitting…" : "Submit for review"}
            </button>
            <button
              onClick={() => {
                setStage("pick");
                setDraft(null);
                setPhoto(null);
                setPreview(null);
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
              <>
                Thanks for feeding Houston — your submission (photo included) is in the moderation
                queue and goes live once a human approves it.
              </>
            ) : (
              <>
                Thanks for feeding Houston. <em>This instance has no database configured, so the
                submission wasn&rsquo;t stored — add Supabase credentials (see README) to enable
                the real moderation queue.</em>
              </>
            )}
          </p>
          <Link
            href="/"
            className="mt-5 inline-block rounded-full bg-secondary px-5 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Back to the deals
          </Link>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <p className="text-xs text-muted">
        By submitting you confirm the photo is yours and shows a real, current menu. Location
        metadata is stripped from uploads; submissions are moderated before publishing.
      </p>
    </div>
  );
}
