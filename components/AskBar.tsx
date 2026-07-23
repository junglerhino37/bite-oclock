"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DealFilter, Spot } from "@/lib/types";
import { EMPTY_FILTER } from "@/lib/types";
import type { Category } from "@/lib/categories";
import { CATEGORIES, isCategory } from "@/lib/categories";
import { bestNameMatch, normalizeName } from "@/lib/match";

interface AddIntent {
  restaurant_name: string;
  item: string | null;
  price: string | null;
  category: Category | null;
  description: string | null;
  url: string | null;
}

interface PendingAdd {
  add: AddIntent;
  /** Closest existing listing, when the typed name is (nearly) one we know. */
  match: Spot | null;
}

/** "julep" → the Julep listing even with a typo or missing "The". */
const bestMatch = (name: string, spots: Spot[]): Spot | null => bestNameMatch(name, spots);

function prettyUrl(url: string): string {
  try {
    const u = new URL(url);
    return (u.hostname + u.pathname).replace(/^www\./, "").replace(/\/$/, "");
  } catch {
    return url;
  }
}

/** Natural-language bar. Searches become filters (standalone pages hand the
 * question to the home page via ?q=); "add $1 oysters at julep" or "add a
 * link to bar boheme <url>" become confirm-then-publish cards. */
export default function AskBar({
  onFilter,
  spots,
}: {
  /** Present on the home page; absent = standalone (restaurant pages). */
  onFilter?: (f: DealFilter) => void;
  spots: Spot[];
}) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAdd | null>(null);
  const [published, setPublished] = useState<{ slug: string; name: string } | null>(null);
  const autoRan = useRef(false);

  async function ask(qOverride?: string) {
    const q = (qOverride ?? question).trim();
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
      if (data.intent === "add" && data.add && (data.add.item || data.add.url)) {
        const add: AddIntent = {
          ...data.add,
          category:
            data.add.item && !isCategory(String(data.add.category))
              ? "barfood"
              : data.add.category,
        };
        const match = bestMatch(add.restaurant_name, spots);
        if (!add.item && !match) {
          setNote(
            `Couldn't find "${add.restaurant_name}" to attach that link to — check the spelling, or create the listing first (add a deal or snap its menu).`,
          );
          return;
        }
        setPending({ add, match });
        return;
      }
      if (!onFilter) {
        // Standalone (restaurant page): run the search on the home page.
        router.push(`/?q=${encodeURIComponent(q)}`);
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

  // Home page: run a query handed over from a standalone bar (/?q=...).
  useEffect(() => {
    if (!onFilter || autoRan.current) return;
    autoRan.current = true;
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) {
      setQuestion(q);
      window.history.replaceState(null, "", window.location.pathname);
      void ask(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function publish() {
    if (!pending || busy) return;
    setBusy(true);
    setNote(null);
    const { add, match } = pending;
    // With a deal: merge into the existing menu (same-named deal replaced).
    // Link-only: empty deals = overlay that keeps the menu and adds the link.
    const newDeal = add.item
      ? [
          {
            item: add.item,
            price: add.price,
            category: add.category ?? "barfood",
            description: add.description,
          },
        ]
      : [];
    const deals = match
      ? [
          ...match.deals.filter(
            (d) => !add.item || normalizeName(d.item) !== normalizeName(add.item),
          ),
          ...newDeal,
        ]
      : newDeal;
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
          deals: add.item ? deals : [],
          note: null,
          source_url: add.url,
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

  const dealChip = (add: AddIntent) =>
    add.item ? (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-sunken px-2.5 py-1 text-sm text-ink">
        {CATEGORIES[add.category ?? "barfood"].emoji} {add.item}
        {add.price && (
          <span className="font-data rounded-full bg-accent px-1.5 py-px text-xs font-semibold text-[#241c15]">
            {add.price}
          </span>
        )}
      </span>
    ) : null;

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
          onClick={() => void ask()}
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
              ?{" "}
              {pending.add.item ? (
                <>This adds {dealChip(pending.add)} to its happy hour.</>
              ) : (
                <>This links its page:</>
              )}
              {pending.add.url && (
                <span className="font-data mt-1 block truncate text-xs text-muted">
                  🔗 {prettyUrl(pending.add.url)}
                </span>
              )}
            </p>
          ) : (
            <p className="text-sm text-ink">
              <span className="font-display font-semibold">{pending.add.restaurant_name}</span>{" "}
              isn&rsquo;t listed yet. Create it with {dealChip(pending.add)}? You can add hours
              and a menu photo afterwards.
              {pending.add.url && (
                <span className="font-data mt-1 block truncate text-xs text-muted">
                  🔗 {prettyUrl(pending.add.url)}
                </span>
              )}
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
