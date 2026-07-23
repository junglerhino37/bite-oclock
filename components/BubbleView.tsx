"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  forceSimulation,
  forceCollide,
  forceRadial,
  forceX,
  forceY,
  type Simulation,
} from "d3-force";
import Link from "next/link";
import type { Spot } from "@/lib/types";
import { CATEGORIES } from "@/lib/categories";
import {
  formatTimeRange,
  houstonNow,
  latestVerifiedAt,
  minDealPrice,
  spotDistanceMiles,
  type LatLng,
} from "@/lib/spots";
import { timeAgo } from "@/lib/format";

type Status = "live" | "soon" | "done" | "off" | "unknown";
type Layout = "time" | "axis";
type Tool = "explore" | "pop";

interface BubbleNode {
  slug: string;
  name: string;
  emoji: string;
  color: string;
  r: number;
  status: Status;
  /** "ends 6 PM" / "starts 5:30 PM" / "done today" / "not today" / "hours vary" */
  timeLabel: string;
  /** Fraction of the happy hour still remaining (live only) — drives the ring. */
  frac: number;
  fromPrice: number | null;
  spot: Spot;
  tx?: number;
  ty?: number;
  x?: number;
  y?: number;
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function fmtTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour12} ${suffix}` : `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

function statusOf(spot: Spot, now: Date): { status: Status; timeLabel: string; frac: number } {
  const { day, minutes } = houstonNow(now);
  const dealToday = spot.deals.some((d) => d.days?.includes(day));
  if (!spot.days.includes(day) && !dealToday)
    return { status: "off", timeLabel: "not today", frac: 0 };
  if (!spot.start) return { status: "unknown", timeLabel: "hours vary", frac: 0 };
  const s = toMin(spot.start);
  // Open-ended windows ("after 4 PM") run until close of day.
  const e = spot.end ? toMin(spot.end) : 24 * 60;
  if (minutes < s) return { status: "soon", timeLabel: `starts ${fmtTime(spot.start)}`, frac: 0 };
  if (minutes >= e) return { status: "done", timeLabel: "done today", frac: 0 };
  return {
    status: "live",
    timeLabel: spot.end ? `ends ${fmtTime(spot.end)}` : `since ${fmtTime(spot.start)}`,
    frac: Math.max(0.04, (e - minutes) / Math.max(1, e - s)),
  };
}

/** The bubble field is a clock: live happy hours gravitate to the center with
 * amber rings that drain as time runs out; "starts soon" orbits the middle;
 * done-for-today fades to the rim. Pop mode turns choosing into elimination,
 * and the value map re-arranges the same bubbles onto price × distance axes. */
export default function BubbleView({
  spots,
  origin = null,
  onRequestOrigin,
}: {
  spots: Spot[];
  /** Visitor location, when known — powers the value map's distance axis. */
  origin?: LatLng | null;
  onRequestOrigin?: () => void;
}) {
  const [layout, setLayout] = useState<Layout>("time");
  const [tool, setTool] = useState<Tool>("explore");
  const [popped, setPopped] = useState<Set<string>>(new Set());
  /** Mid-cascade "surprise me" visuals — bubbles shrink away without paying
   * for a full re-simulation per pop; the sim re-packs once at the end. */
  const [popping, setPopping] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Spot | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [positions, setPositions] = useState<BubbleNode[]>([]);
  const simRef = useRef<Simulation<BubbleNode, undefined> | null>(null);
  const surpriseRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // The field drifts with real time — rings drain, bubbles migrate.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  // New filter results invalidate eliminations.
  useEffect(() => {
    setPopped(new Set());
    setSelected(null);
  }, [spots]);

  const alive = useMemo(() => spots.filter((s) => !popped.has(s.slug)), [spots, popped]);

  const nodes = useMemo<BubbleNode[]>(() => {
    // Survivors grow as the field thins — elimination feels like progress.
    const boost = Math.min(1.6, Math.sqrt(spots.length / Math.max(1, alive.length)));
    const pool =
      layout === "axis" ? alive.filter((s) => s.lat !== null && s.lng !== null) : alive;
    return pool.map((s) => {
      const meta = CATEGORIES[s.deals[0]?.category ?? "barfood"];
      const st = statusOf(s, now);
      const base =
        layout === "axis"
          ? 26 + Math.min(8, s.deals.length * 1.5)
          : (st.status === "live" ? 46 : st.status === "soon" ? 36 : 27) +
            Math.min(st.status === "live" ? 14 : 6, s.deals.length * 2);
      return {
        slug: s.slug,
        name: s.name,
        emoji: meta.emoji,
        color: meta.color,
        r: Math.max(22, Math.min(66, base * (layout === "axis" ? 1 : boost))),
        status: st.status,
        timeLabel: st.timeLabel,
        frac: st.frac,
        fromPrice: minDealPrice(s),
        spot: s,
      };
    });
  }, [alive, spots.length, layout, now]);

  const axisReady = layout === "time" || origin !== null;
  const hiddenInAxis = layout === "axis" ? alive.length - nodes.length : 0;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !axisReady) return;
    const { width, height } = el.getBoundingClientRect();
    const cx = width / 2;
    const cy = height / 2;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const simNodes: BubbleNode[] = nodes.map((n, i) => {
      if (layout === "axis" && origin) {
        const dists = nodes.map((m) => spotDistanceMiles(m.spot, origin) ?? 0);
        const maxD = Math.max(1, ...dists);
        const prices = nodes.map((m) => m.fromPrice).filter((p): p is number => p !== null);
        const maxP = Math.max(5, ...prices);
        const d = spotDistanceMiles(n.spot, origin) ?? maxD;
        const p = n.fromPrice;
        const pad = 56;
        return {
          ...n,
          tx: pad + (d / maxD) * (width - pad * 2),
          // Cheap lives at the bottom — the bottom-left corner is "go here".
          ty: p === null ? pad : height - pad - (Math.min(p, maxP) / maxP) * (height - pad * 2),
          x: cx,
          y: cy,
        };
      }
      return {
        ...n,
        x: cx + Math.cos((i / Math.max(1, nodes.length)) * Math.PI * 2) * 60,
        y: cy + Math.sin((i / Math.max(1, nodes.length)) * Math.PI * 2) * 60,
      };
    });

    const clamp = () =>
      simNodes.map((n) => ({
        ...n,
        x: Math.max(n.r, Math.min(width - n.r, n.x ?? cx)),
        y: Math.max(n.r, Math.min(height - n.r, n.y ?? cy)),
      }));

    simRef.current?.stop();
    const ringOf = (n: BubbleNode) =>
      n.status === "live" ? 30 : n.status === "soon" ? Math.min(width, height) * 0.31 : Math.min(width, height) * 0.46;
    const sim = forceSimulation(simNodes).stop(); // manual ticks — rAF stalls in hidden tabs
    if (layout === "axis") {
      sim
        .force("x", forceX<BubbleNode>((d) => d.tx ?? cx).strength(0.6))
        .force("y", forceY<BubbleNode>((d) => d.ty ?? cy).strength(0.6))
        .force("collide", forceCollide<BubbleNode>((d) => d.r + 2).strength(0.85));
    } else {
      sim
        .force("radial", forceRadial<BubbleNode>((d) => ringOf(d), cx, cy).strength(0.35))
        .force("x", forceX(cx).strength(0.03))
        .force("y", forceY(cy).strength(0.04))
        .force("collide", forceCollide<BubbleNode>((d) => d.r + 3).strength(0.9));
    }

    sim.tick(180);
    setPositions(clamp());
    simRef.current = sim;

    if (reduced) return () => sim.stop();
    sim.alpha(0.9).alphaDecay(0.05);
    let raf = 0;
    const step = () => {
      if (sim.alpha() > sim.alphaMin()) {
        sim.tick();
        setPositions(clamp());
        raf = requestAnimationFrame(step);
      }
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      sim.stop();
    };
  }, [nodes, layout, origin, axisReady]);

  const pop = (slug: string) => {
    setPopped((p) => new Set([...p, slug]));
    const remaining = alive.filter((s) => s.slug !== slug);
    if (remaining.length === 1) setSelected(remaining[0]);
  };

  const surprise = () => {
    if (surpriseRef.current) return;
    const candidates = alive.filter((s) => {
      const st = statusOf(s, now).status;
      return st === "live" || st === "soon";
    });
    const from = candidates.length >= 2 ? candidates : alive;
    if (from.length < 2) return;
    const winner = from[Math.floor(Math.random() * from.length)];
    const losers = alive.filter((s) => s.slug !== winner.slug);
    let i = 0;
    surpriseRef.current = setInterval(() => {
      if (i >= losers.length) {
        if (surpriseRef.current) clearInterval(surpriseRef.current);
        surpriseRef.current = null;
        setPopping(new Set());
        setPopped((p) => new Set([...p, ...losers.map((l) => l.slug)]));
        setSelected(winner);
        return;
      }
      const slug = losers[i].slug;
      setPopping((p) => new Set([...p, slug]));
      i += 1;
    }, 110);
  };
  useEffect(
    () => () => {
      if (surpriseRef.current) clearInterval(surpriseRef.current);
    },
    [],
  );

  const chip = (active: boolean) =>
    `rounded-full px-3 py-1 text-sm transition-colors ${
      active ? "bg-secondary text-white" : "border border-line bg-surface text-muted hover:text-ink"
    }`;

  const selectedMeta = selected ? statusOf(selected, now) : null;
  const selectedVerified = selected ? latestVerifiedAt(selected) : null;
  const selectedDist = selected ? spotDistanceMiles(selected, origin) : null;

  return (
    <div>
      <div className="mb-3 flex min-h-8 flex-wrap items-center gap-2">
        <div className="inline-flex gap-1 rounded-full border border-line bg-surface p-0.5">
          <button onClick={() => setLayout("time")} className={chip(layout === "time")}>
            🕐 By time
          </button>
          <button onClick={() => setLayout("axis")} className={chip(layout === "axis")}>
            💸 Price × distance
          </button>
        </div>
        <span className="flex-1" />
        <button
          onClick={() => setTool(tool === "pop" ? "explore" : "pop")}
          className={chip(tool === "pop")}
        >
          🫧 Pop to narrow
        </button>
        <button onClick={surprise} className={chip(false)}>
          🎲 Surprise me
        </button>
        {popped.size > 0 && (
          <button
            onClick={() => {
              setPopped(new Set());
              setSelected(null);
            }}
            className="rounded-full px-2 py-1 text-sm text-muted underline decoration-line underline-offset-4 hover:text-ink"
          >
            ↺ Restore {popped.size}
          </button>
        )}
      </div>
      <p className="mb-3 text-sm text-muted">
        {tool === "pop"
          ? "Pop what you don't want — last bubble standing is dinner."
          : layout === "axis"
            ? "Down = cheaper, left = closer. The bottom-left corner is where you want to be."
            : "Live happy hours sit in the middle — the amber ring drains as time runs out. Tap to peek."}
      </p>

      <div
        ref={containerRef}
        className="relative h-[65vh] min-h-[420px] overflow-hidden rounded-2xl border border-line bg-sunken/50"
      >
        {layout === "axis" && !origin && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-center">
            <p className="max-w-xs text-sm text-muted">
              The value map plots every spot by price and distance from you.
            </p>
            <button
              onClick={onRequestOrigin}
              className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:bg-primary-hover"
            >
              📍 Use my location
            </button>
          </div>
        )}
        {axisReady && positions.length === 0 && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-muted">
            Nothing here… yet. Clear a filter, or be the first to add a deal.
          </p>
        )}
        {layout === "axis" && origin && (
          <>
            <span className="font-data absolute bottom-2 left-3 text-[11px] text-muted">
              ← closer · cheaper ↓
            </span>
            <span className="font-data absolute right-3 top-2 text-[11px] text-muted">
              farther → · pricier ↑
            </span>
          </>
        )}
        {axisReady &&
          positions.map((n) => {
            const deg = Math.round(n.frac * 360);
            const ring =
              n.status === "live"
                ? `conic-gradient(var(--accent) ${deg}deg, ${n.color}33 ${deg}deg)`
                : n.status === "soon"
                  ? `repeating-conic-gradient(${n.color} 0deg 14deg, transparent 14deg 30deg)`
                  : `${n.color}2e`;
            const dim = n.status === "done" || n.status === "off";
            const isPopping = popping.has(n.slug);
            return (
              <button
                key={n.slug}
                onClick={() => (tool === "pop" ? pop(n.slug) : setSelected(n.spot))}
                aria-label={`${n.name} — ${n.timeLabel}`}
                className="absolute rounded-full transition-opacity duration-300"
                style={{
                  width: n.r * 2,
                  height: n.r * 2,
                  transform: `translate(${(n.x ?? 0) - n.r}px, ${(n.y ?? 0) - n.r}px)`,
                  padding: 3,
                  background: isPopping ? "transparent" : ring,
                  opacity: isPopping ? 0 : dim ? 0.45 : 1,
                }}
              >
                <span
                  className="relative flex h-full w-full flex-col items-center justify-center rounded-full text-center leading-tight transition-transform hover:scale-105"
                  style={{
                    background: `color-mix(in srgb, ${n.color} 16%, var(--surface))`,
                    transitionTimingFunction: "var(--ease-spring)",
                    transform: isPopping ? "scale(0)" : undefined,
                    transitionDuration: "250ms",
                  }}
                >
                  <span style={{ fontSize: Math.max(13, n.r * 0.32) }}>{n.emoji}</span>
                  <span
                    className="px-1 font-medium text-ink"
                    style={{ fontSize: Math.max(9, Math.min(13, n.r * 0.18)) }}
                  >
                    {n.name.length > 20 ? `${n.name.slice(0, 18)}…` : n.name}
                  </span>
                  {n.r > 30 && n.fromPrice !== null && (
                    <span className="font-data text-muted" style={{ fontSize: 10 }}>
                      from ${n.fromPrice % 1 === 0 ? n.fromPrice : n.fromPrice.toFixed(2)}
                    </span>
                  )}
                  {n.r > 38 && (
                    <span className="font-data text-muted" style={{ fontSize: 10 }}>
                      {n.timeLabel}
                    </span>
                  )}
                  {n.status === "live" && (
                    <span className="live-dot absolute right-[10%] top-[10%] h-2.5 w-2.5 rounded-full bg-accent" />
                  )}
                </span>
              </button>
            );
          })}
      </div>
      {layout === "axis" && hiddenInAxis > 0 && (
        <p className="mt-2 text-xs text-muted">
          {hiddenInAxis} spot{hiddenInAxis === 1 ? "" : "s"} without a mapped location aren&rsquo;t
          shown here.
        </p>
      )}

      {selected && (
        <div className="mt-3 rounded-2xl border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-lg font-semibold text-ink">
              {CATEGORIES[selected.deals[0]?.category ?? "barfood"].emoji} {selected.name}
            </span>
            {selectedMeta?.status === "live" ? (
              <span className="live-dot rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-[#241c15]">
                LIVE · {selectedMeta.timeLabel}
              </span>
            ) : (
              <span className="rounded-full bg-sunken px-2.5 py-0.5 text-xs text-muted">
                {selectedMeta?.timeLabel}
              </span>
            )}
            <span className="font-data text-xs text-muted">{formatTimeRange(selected)}</span>
            {selectedDist !== null && (
              <span className="font-data text-xs text-muted">📍 {selectedDist.toFixed(1)} mi</span>
            )}
            <span suppressHydrationWarning className="text-xs text-muted">
              {selectedVerified ? `✓ verified ${timeAgo(selectedVerified)}` : "not verified yet"}
            </span>
            <span className="flex-1" />
            <button
              onClick={() => setSelected(null)}
              aria-label="Close preview"
              className="rounded-full px-2 text-muted hover:text-ink"
            >
              ✕
            </button>
          </div>
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {selected.deals.slice(0, 5).map((d, i) => (
              <li
                key={i}
                className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs"
                style={{ background: `${CATEGORIES[d.category].color}1a`, color: "var(--text)" }}
              >
                {d.item}
                {d.price && (
                  <span className="font-data rounded-full bg-accent px-1.5 py-px text-[10px] font-semibold text-[#241c15]">
                    {d.price}
                  </span>
                )}
              </li>
            ))}
            {selected.deals.length > 5 && (
              <li className="rounded-full bg-sunken px-2.5 py-1 text-xs text-muted">
                +{selected.deals.length - 5} more
              </li>
            )}
          </ul>
          <Link
            href={`/r/${selected.slug}`}
            className="mt-3 inline-block rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-hover"
          >
            Full page →
          </Link>
        </div>
      )}
    </div>
  );
}
