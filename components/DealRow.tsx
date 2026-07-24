"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Day, Deal, VoteSummary } from "@/lib/types";
import { DAYS, DAY_LABELS } from "@/lib/types";
import { CATEGORIES, CATEGORY_KEYS, type Category } from "@/lib/categories";
import { compressImage } from "@/lib/image";
import VerifyButtons from "./VerifyButtons";

const inputCls =
  "w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none";

/** One deal on the spot page — tap ✏️ to fix the price, rename it, attach a
 * dish photo, or remove it. Every save lands as a new community version. */
export default function DealRow({
  slug,
  deal,
  summary,
  stale = false,
}: {
  slug: string;
  deal: Deal;
  summary?: VoteSummary;
  /** Voted outdated by the community — dimmed here, hidden from cards. */
  stale?: boolean;
}) {
  const router = useRouter();
  const meta = CATEGORIES[deal.category];
  const [editing, setEditing] = useState(false);
  const [item, setItem] = useState(deal.item);
  const [price, setPrice] = useState(deal.price ?? "");
  const [description, setDescription] = useState(deal.description ?? "");
  const [category, setCategory] = useState<Category>(deal.category);
  const [days, setDays] = useState<Day[]>(deal.days ?? []);
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(action: "edit" | "remove") {
    if (busy) return;
    if (action === "edit" && !item.trim()) {
      setError("The dish needs a name.");
      return;
    }
    if (action === "remove" && !confirm(`Remove "${deal.item}" from this happy hour?`)) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append(
        "payload",
        JSON.stringify({
          slug,
          originalItem: deal.item,
          action,
          item: item.trim(),
          price: price.trim() || null,
          category,
          description: description.trim() || null,
          days,
        }),
      );
      if (photo) form.append("photo", photo);
      const res = await fetch("/api/deal-edit", { method: "POST", body: form });
      if (!res.ok) {
        setError((await res.json()).error ?? "Couldn't save the edit.");
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <li className="space-y-2 rounded-2xl border border-primary/50 bg-surface p-4 shadow-sm">
        <div className="flex gap-2">
          <input
            value={item}
            onChange={(e) => setItem(e.target.value)}
            placeholder="Dish"
            className={`${inputCls} min-w-0 flex-1`}
          />
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="$"
            className="w-24 shrink-0 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
          />
        </div>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className={inputCls}
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="rounded-xl border border-line bg-surface px-2 py-1.5 text-sm text-ink"
          >
            {CATEGORY_KEYS.map((c) => (
              <option key={c} value={c}>
                {CATEGORIES[c].emoji} {CATEGORIES[c].label}
              </option>
            ))}
          </select>
          <span className="flex items-center gap-1">
            <span className="text-[11px] text-muted">only on:</span>
            {DAYS.map((d) => {
              const on = days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(on ? days.filter((x) => x !== d) : [...days, d])}
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
          <label className="cursor-pointer rounded-xl border border-dashed border-line px-3 py-1.5 text-sm text-muted hover:border-primary hover:text-ink">
            {photo ? `📷 ${photo.name.slice(0, 18)}` : deal.photoUrl ? "📷 Replace photo" : "📷 Add a dish photo"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                setPhoto(f ? await compressImage(f, 1600) : null);
              }}
            />
          </label>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={() => void save("edit")}
            disabled={busy}
            className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-40"
          >
            {busy ? "Saving…" : "Save"}
          </button>
          <button
            onClick={() => setEditing(false)}
            disabled={busy}
            className="rounded-full border border-line bg-surface px-4 py-1.5 text-sm text-ink hover:bg-sunken"
          >
            Cancel
          </button>
          <button
            onClick={() => void save("remove")}
            disabled={busy}
            className="ml-auto rounded-full px-3 py-1.5 text-sm text-muted hover:text-danger"
          >
            🗑 Remove
          </button>
        </div>
        <p className="text-[11px] text-muted">
          Edits publish instantly as a new version — the old menu stays in history. Renaming
          restarts this deal&rsquo;s verification.
        </p>
      </li>
    );
  }

  return (
    <li
      className={`space-y-3 rounded-2xl border bg-surface p-4 shadow-sm ${
        stale ? "border-danger/40 opacity-70" : "border-line"
      }`}
    >
      {stale && (
        <p className="text-[11px] font-medium text-danger">
          ⚠️ Voted outdated — hidden from cards until someone confirms it&rsquo;s back (or ✏️
          fixes it).
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {deal.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={deal.photoUrl}
              alt={deal.item}
              className="h-12 w-12 shrink-0 rounded-xl border border-line object-cover"
            />
          ) : (
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
              style={{ background: `${meta.color}26` }}
            >
              {meta.emoji}
            </span>
          )}
          <div>
            <p className="font-medium text-ink">
              {deal.item}
              {deal.days && deal.days.length > 0 && (
                <span className="font-data ml-1.5 rounded-full bg-secondary/15 px-1.5 py-0.5 text-[10px] font-semibold text-secondary">
                  {deal.days.map((d) => DAY_LABELS[d]).join(" · ")} only
                </span>
              )}
            </p>
            {deal.description && <p className="text-xs italic text-muted">{deal.description}</p>}
            <p className="text-xs text-muted">{meta.label}</p>
          </div>
        </div>
        {deal.price ? (
          <span className="font-data rounded-full bg-accent px-3 py-1 text-sm font-semibold text-[#241c15]">
            {deal.price}
          </span>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="font-data shrink-0 rounded-full border border-dashed border-line px-3 py-1 text-sm text-muted hover:border-primary hover:text-ink"
          >
            + price
          </button>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-line pt-2.5">
        <VerifyButtons slug={slug} kind="deal" target={deal.item} summary={summary} compact />
        <button
          onClick={() => setEditing(true)}
          aria-label={`Edit ${deal.item}`}
          className="shrink-0 rounded-full px-2 py-0.5 text-xs text-muted hover:text-ink"
        >
          ✏️ Edit
        </button>
      </div>
    </li>
  );
}
