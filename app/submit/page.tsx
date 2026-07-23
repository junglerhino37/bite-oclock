"use client";

import { useState } from "react";
import Link from "next/link";
import type { Extraction } from "@/lib/ai/schemas";
import { CATEGORIES } from "@/lib/categories";
import { DAY_LABELS } from "@/lib/types";
import type { Day } from "@/lib/types";

type Stage = "pick" | "extracting" | "review" | "done";

export default function SubmitPage() {
  const [stage, setStage] = useState<Stage>("pick");
  const [preview, setPreview] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [demo, setDemo] = useState(false);
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
      setExtraction(data.extraction);
      setDemo(Boolean(data.demo));
      setStage("review");
    } catch {
      setError("Network error — try again.");
      setStage("pick");
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 pt-8">
      <header>
        <h1 className="font-display text-3xl font-semibold text-ink">Spot a deal</h1>
        <p className="mt-2 text-sm text-muted">
          Snap the happy hour menu, we&rsquo;ll read it. Everything you submit goes through a quick
          human review before it appears on the site.
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

      {stage === "review" && extraction && (
        <div className="space-y-4">
          {demo && (
            <p className="rounded-xl bg-sunken px-4 py-3 text-xs text-muted">
              Demo mode: this instance has no AI key, so this is sample output. The flow is
              identical with a real key.
            </p>
          )}
          <div className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="font-display text-lg font-semibold text-ink">
              Here&rsquo;s what we read — look right?
            </h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Restaurant</dt>
                <dd className="text-ink">{extraction.restaurant_candidates.join(" / ") || "Unknown"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">When</dt>
                <dd className="font-data text-ink">
                  {extraction.happy_hour_days.map((d) => DAY_LABELS[d as Day]).join(" ") || "?"}
                  {" · "}
                  {extraction.start ?? "?"}–{extraction.end ?? "?"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Deals</dt>
                <dd>
                  <ul className="mt-1 space-y-1">
                    {extraction.deals.map((d, i) => (
                      <li key={i} className="flex items-center gap-2 text-ink">
                        <span>{CATEGORIES[d.category as keyof typeof CATEGORIES]?.emoji}</span>
                        <span>{d.item}</span>
                        {d.price && (
                          <span className="font-data rounded-full bg-accent px-2 py-px text-xs font-semibold text-[#241c15]">
                            {d.price}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            </dl>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setStage("done")}
              className="flex-1 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-hover"
            >
              Looks right — submit for review
            </button>
            <button
              onClick={() => {
                setStage("pick");
                setExtraction(null);
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
            Thanks for feeding Houston. A moderator will review your submission shortly.
            {" "}
            <em>
              (This demo instance doesn&rsquo;t persist submissions yet — the moderation queue
              lands with the Supabase hookup. See the README roadmap.)
            </em>
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
