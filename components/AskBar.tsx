"use client";

import { useState } from "react";
import type { DealFilter } from "@/lib/types";
import { EMPTY_FILTER } from "@/lib/types";
import type { Category } from "@/lib/categories";
import { isCategory } from "@/lib/categories";

/** Natural-language search: the server translates the question into a
 * constrained filter (never SQL) and we apply it to the browse view. */
export default function AskBar({ onFilter }: { onFilter: (f: DealFilter) => void }) {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function ask() {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNote(data.error ?? "Something went wrong.");
        return;
      }
      const f = data.filter;
      onFilter({
        ...EMPTY_FILTER,
        categories: (f.categories ?? []).filter((c: string): c is Category => isCategory(c)),
        neighborhood: f.neighborhood ?? null,
        day: f.day ?? null,
        liveNow: Boolean(f.live_now),
        foodTerms: f.food_terms ?? [],
      });
      setNote(
        data.demo
          ? "Filtered with keyword matching (demo mode — no AI key configured on this instance)."
          : "Filtered by AI — results below.",
      );
    } catch {
      setNote("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          maxLength={300}
          placeholder='Ask anything — "cheap oysters near Montrose on a Tuesday"'
          className="min-w-0 flex-1 rounded-full border border-line bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none"
        />
        <button
          onClick={ask}
          disabled={busy || !question.trim()}
          className="shrink-0 rounded-full bg-secondary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "Thinking…" : "Ask"}
        </button>
      </div>
      {note && <p className="mt-2 text-xs text-muted">{note}</p>}
    </div>
  );
}
