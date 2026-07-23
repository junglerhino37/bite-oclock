"use client";

import { useState } from "react";
import type { VoteSummary } from "@/lib/types";
import { timeAgo } from "@/lib/format";
import { getAccessToken } from "@/lib/supabase-browser";

/** "Still current?" voting row — the community replacement for moderation.
 * Shows the last-verified blurb and lets anyone confirm (👍) or flag (👎).
 * Re-voting just updates your existing vote server-side. */
export default function VerifyButtons({
  slug,
  kind,
  target = "",
  summary,
  compact = false,
}: {
  slug: string;
  kind: "deal" | "hours";
  target?: string;
  summary?: VoteSummary;
  compact?: boolean;
}) {
  const [s, setS] = useState<VoteSummary>(summary ?? { up: 0, down: 0, lastVerifiedAt: null });
  const [myVote, setMyVote] = useState<1 | -1 | null>(null);
  const [busy, setBusy] = useState(false);

  async function cast(vote: 1 | -1) {
    if (busy || myVote === vote) return;
    setBusy(true);
    try {
      const token = await getAccessToken();
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ slug, kind, target, vote }),
      });
      const data = await res.json();
      if (res.ok && data.summary) {
        setS(data.summary);
        setMyVote(vote);
      }
    } catch {
      // Network hiccup — leave the counts as they were.
    } finally {
      setBusy(false);
    }
  }

  const stale = s.down > s.up && s.down > 0;
  const blurb = s.lastVerifiedAt
    ? `Verified ${timeAgo(s.lastVerifiedAt)}`
    : "Not verified yet";

  const btn = (vote: 1 | -1, label: string, count: number) => (
    <button
      onClick={() => void cast(vote)}
      disabled={busy}
      aria-pressed={myVote === vote}
      title={vote === 1 ? "Still current" : "Outdated"}
      className={`font-data flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors disabled:opacity-50 ${
        myVote === vote
          ? vote === 1
            ? "border-success bg-success/15 text-success"
            : "border-danger bg-danger/15 text-danger"
          : "border-line bg-surface text-muted hover:text-ink"
      }`}
    >
      <span>{label}</span>
      {count > 0 && <span>{count}</span>}
    </button>
  );

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${compact ? "" : "gap-2"}`}>
      <span
        suppressHydrationWarning
        className={`text-[11px] ${
          stale ? "font-medium text-danger" : s.lastVerifiedAt ? "text-success" : "text-muted"
        }`}
      >
        {stale ? "Flagged as outdated" : blurb}
      </span>
      {btn(1, "👍 current", s.up)}
      {btn(-1, "👎 outdated", s.down)}
    </div>
  );
}
