"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Day, Spot } from "@/lib/types";
import { DAYS, DAY_LABELS } from "@/lib/types";

/** Inline "these hours are wrong" editor. Saves a new hours version for the
 * spot (the old schedule stays in its history) and refreshes the page. */
export default function HoursEditor({ spot }: { spot: Spot }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<Day[]>(spot.days);
  const [start, setStart] = useState(spot.start ?? "15:00");
  const [end, setEnd] = useState(spot.end ?? "18:00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (busy) return;
    if (days.length === 0) {
      setError("Pick at least one day.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/hours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: spot.slug, days, start: start || null, end: end || null }),
      });
      if (!res.ok) {
        setError((await res.json()).error ?? "Couldn't save the new hours.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm text-muted transition-colors hover:text-ink"
      >
        ✏️ Hours changed? Fix them
      </button>
    );
  }

  return (
    <div className="w-full space-y-3 rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        Set the current happy hour
      </p>
      <div className="flex flex-wrap gap-1.5">
        {DAYS.map((d) => {
          const on = days.includes(d);
          return (
            <button
              key={d}
              type="button"
              onClick={() => setDays(on ? days.filter((x) => x !== d) : [...days, d])}
              className={`font-data rounded-full px-3 py-1.5 text-sm transition-colors ${
                on ? "bg-secondary text-white" : "bg-sunken text-muted hover:text-ink"
              }`}
            >
              {DAY_LABELS[d]}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2 text-sm">
        <label className="flex items-center gap-2 text-muted">
          from
          <input
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="rounded-xl border border-line bg-surface px-2 py-1.5 text-ink"
          />
        </label>
        <label className="flex items-center gap-2 text-muted">
          to
          <input
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="rounded-xl border border-line bg-surface px-2 py-1.5 text-ink"
          />
        </label>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={() => void save()}
          disabled={busy}
          className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save new hours"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-full border border-line bg-surface px-4 py-1.5 text-sm text-ink hover:bg-sunken"
        >
          Cancel
        </button>
      </div>
      <p className="text-[11px] text-muted">
        The old schedule stays in this spot&rsquo;s history, and verification restarts for the
        new times.
      </p>
    </div>
  );
}
