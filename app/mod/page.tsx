"use client";

import { useEffect, useState } from "react";
import { CATEGORIES, type Category } from "@/lib/categories";
import { DAY_LABELS, type Day } from "@/lib/types";

interface Sub {
  id: string;
  restaurant_name: string;
  neighborhood: string | null;
  days: Day[];
  start_time: string | null;
  end_time: string | null;
  deals: { item: string; price: string | null; category: Category; description: string | null }[];
  photo_url: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export default function ModPage() {
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("mod-key");
    if (saved) {
      setKey(saved);
      void load(saved);
    }
  }, []);

  async function load(k: string) {
    setError(null);
    const res = await fetch("/api/mod", { headers: { "x-moderator-key": k } });
    const data = await res.json();
    if (!res.ok) {
      setAuthed(false);
      sessionStorage.removeItem("mod-key");
      setError(data.error ?? "Couldn't load the queue.");
      return;
    }
    sessionStorage.setItem("mod-key", k);
    setAuthed(true);
    setSubs(data.submissions);
  }

  async function act(id: string, action: "approve" | "reject") {
    setBusy(id);
    try {
      const res = await fetch("/api/mod", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-moderator-key": key },
        body: JSON.stringify({ id, action }),
      });
      if (res.ok) {
        setSubs((s) =>
          s.map((x) =>
            x.id === id ? { ...x, status: action === "approve" ? "approved" : "rejected" } : x,
          ),
        );
      } else {
        setError((await res.json()).error ?? "Action failed.");
      }
    } finally {
      setBusy(null);
    }
  }

  if (!authed) {
    return (
      <div className="mx-auto max-w-sm space-y-4 pt-16 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink">Moderation</h1>
        <p className="text-sm text-muted">Enter the moderator key for this instance.</p>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && key && load(key)}
          placeholder="Moderator key"
          className="w-full rounded-full border border-line bg-surface px-4 py-2.5 text-sm text-ink focus:border-primary focus:outline-none"
        />
        <button
          onClick={() => key && load(key)}
          className="rounded-full bg-secondary px-6 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          Open the queue
        </button>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    );
  }

  const pending = subs.filter((s) => s.status === "pending");
  const decided = subs.filter((s) => s.status !== "pending");

  return (
    <div className="mx-auto max-w-2xl space-y-6 pt-8">
      <header className="flex items-baseline justify-between">
        <h1 className="font-display text-3xl font-semibold text-ink">Moderation queue</h1>
        <p className="font-data text-sm text-muted">{pending.length} pending</p>
      </header>
      {error && <p className="text-sm text-danger">{error}</p>}

      {pending.length === 0 && (
        <p className="rounded-2xl border-2 border-dashed border-line bg-surface px-6 py-12 text-center text-sm text-muted">
          Queue&rsquo;s clear. Houston is fed. 🎉
        </p>
      )}

      {[...pending, ...decided].map((s) => (
        <article key={s.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="flex gap-4 p-5">
            {s.photo_url ? (
              <a href={s.photo_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.photo_url}
                  alt="Menu photo"
                  className="h-28 w-28 rounded-xl object-cover"
                />
              </a>
            ) : (
              <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-xl bg-sunken text-3xl">
                📄
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-display truncate text-lg font-semibold text-ink">
                  {s.restaurant_name}
                </h2>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    s.status === "pending"
                      ? "bg-accent text-[#241c15]"
                      : s.status === "approved"
                        ? "bg-success/15 text-success"
                        : "bg-danger/15 text-danger"
                  }`}
                >
                  {s.status}
                </span>
              </div>
              <p className="font-data mt-0.5 text-xs text-muted">
                {s.neighborhood ?? "no neighborhood"} ·{" "}
                {s.days.map((d) => DAY_LABELS[d] ?? d).join(" ") || "no days"} ·{" "}
                {s.start_time?.slice(0, 5) ?? "?"}–{s.end_time?.slice(0, 5) ?? "?"}
              </p>
              <ul className="mt-2 space-y-1 text-sm text-ink">
                {s.deals.map((d, i) => (
                  <li key={i} className="truncate">
                    {CATEGORIES[d.category]?.emoji} {d.item}
                    {d.price ? ` — ${d.price}` : ""}
                    {d.description && <span className="text-muted"> · {d.description}</span>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {s.status === "pending" && (
            <div className="flex gap-2 border-t border-line bg-sunken/50 px-5 py-3">
              <button
                onClick={() => act(s.id, "approve")}
                disabled={busy === s.id}
                className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-40"
              >
                Approve → publish
              </button>
              <button
                onClick={() => act(s.id, "reject")}
                disabled={busy === s.id}
                className="rounded-full border border-line bg-surface px-4 py-1.5 text-sm text-ink hover:text-danger disabled:opacity-40"
              >
                Reject
              </button>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
