"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DealFilter, Spot } from "@/lib/types";
import { EMPTY_FILTER } from "@/lib/types";
import type { Category } from "@/lib/categories";
import { CATEGORIES, isCategory } from "@/lib/categories";

interface AddIntent {
  restaurant_name: string;
  item: string;
  price: string | null;
  category: Category;
  description: string | null;
}

interface PendingAdd {
  add: AddIntent;
  /** Closest existing listing, when the typed name is (nearly) one we know. */
  match: Spot | null;
}

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/^(the|a)\s+/, "")
    .replace(/[^a-z0-9]+/g, "");
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return dp[b.length];
}

/** "julep" → the Julep listing even with a typo or missing "The". */
function bestMatch(name: string, spots: Spot[]): Spot | null {
  const n = normalizeName(name);
  if (!n) return null;
  let best: Spot | null = null;
  let bestScore = Infinity;
  for (const spot of spots) {
    const c = normalizeName(spot.name);
    let score: number;
    if (c === n) score = 0;
    else if (c.startsWith(n) || n.startsWith(c) || c.includes(n)) score = 1;
    else {
      const d = levenshtein(n, c);
      score = d <= Math.max(2, Math.floor(n.length / 4)) ? 2 + d : Infinity;
    }
    if (score < bestScore) {
      bestScore = score;
      best = spot;
    }
  }
  return bestScore === Infinity ? null : best;
}

/** Natural-language bar: search questions become filters; "add $1 oysters at
 * julep" becomes a confirm-then-publish card (did-you-mean against known
 * spots, or a brand-new listing when nothing matches). */
export default function AskBar({
  onFilter,
  spots,
}: {
  onFilter: (f: DealFilter) => void;
  spots: Spot[];
}) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAdd | null>(null);
  const [published, setPublished] = useState<{ slug: string; name: string } | null>(null);

  async function ask() {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setNote(null);
    setPending(null);
    setPublished(null);
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
      if (data.intent === "add" && data.add && isCategory(String(data.add.category))) {
        setPending({ add: data.add, match: bestMatch(data.add.restaurant_name, spots) });
        return;
      }
      const f = data.filter ?? {};
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

  async function publish() {
    if (!pending || busy) return;
    setBusy(true);
    setNote(null);
    const { add, match } = pending;
    // Adding to an existing spot keeps its menu: same-named deal is replaced,
    // everything else carries into the new version.
    const deals = match
      ? [
          ...match.deals.filter(
            (d) => normalizeName(d.item) !== normalizeName(add.item),
          ),
          { item: add.item, price: add.price, category: add.category, description: add.description },
        ]
      : [{ item: add.item, price: add.price, category: add.category, description: add.description }];
    try {
      const form = new FormData();
      form.append(
        "payload",
        JSON.stringify({
          restaurant_name: match?.name ?? add.restaurant_name,
          spot_slug: match?.slug ?? null,
          neighborhood: match?.neighborhood ?? null,
          days: match?.days ?? [],
          start: match?.start ?? null,
          end: match?.end ?? null,
          deals,
          note: null,
        }),
      );
      const res = await fetch("/api/submit", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setNote(data.error ?? "Couldn't publish that.");
        return;
      }
      setPending(null);
      setQuestion("");
      if (data.stored && typeof data.slug === "string") {
        setPublished({ slug: data.slug, name: match?.name ?? add.restaurant_name });
        router.refresh();
      } else {
        setNote(
          "Demo instance — no database configured, so nothing was saved. The flow is identical with credentials.",
        );
      }
    } catch {
      setNote("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  const dealChip = (add: AddIntent) => (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-sunken px-2.5 py-1 text-sm text-ink">
      {CATEGORIES[add.category].emoji} {add.item}
      {add.price && (
        <span className="font-data rounded-full bg-accent px-1.5 py-px text-xs font-semibold text-[#241c15]">
          {add.price}
        </span>
      )}
    </span>
  );

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          maxLength={300}
          placeholder='Ask or add — "cheap oysters near Montrose" · "add $1 oysters at Julep"'
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

      {pending && (
        <div className="mt-3 space-y-3 rounded-2xl border border-line bg-surface p-4">
          {pending.match ? (
            <p className="text-sm text-ink">
              Did you mean{" "}
              <span className="font-display font-semibold">{pending.match.name}</span>
              {pending.match.address ? (
                <span className="text-muted"> ({pending.match.address})</span>
              ) : (
                <span className="text-muted"> ({pending.match.neighborhood})</span>
              )}
              ? This adds {dealChip(pending.add)} to its happy hour.
            </p>
          ) : (
            <p className="text-sm text-ink">
              <span className="font-display font-semibold">{pending.add.restaurant_name}</span>{" "}
              isn&rsquo;t listed yet. Create it with {dealChip(pending.add)}? You can add hours
              and a menu photo afterwards.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void publish()}
              disabled={busy}
              className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-40"
            >
              {busy ? "Publishing…" : pending.match ? "Yes — publish it" : "Add it — publish"}
            </button>
            <button
              onClick={() => setPending(null)}
              disabled={busy}
              className="rounded-full border border-line bg-surface px-4 py-1.5 text-sm text-ink hover:bg-sunken"
            >
              No, cancel
            </button>
          </div>
        </div>
      )}

      {published && (
        <p className="mt-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink">
          🏆 Published —{" "}
          <Link
            href={`/r/${published.slug}`}
            className="font-medium underline decoration-line underline-offset-2 hover:text-primary"
          >
            see {published.name}&rsquo;s page
          </Link>{" "}
          or vote on it below.
        </p>
      )}

      {note && <p className="mt-2 text-xs text-muted">{note}</p>}
    </div>
  );
}
