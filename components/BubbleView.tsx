"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  forceSimulation,
  forceCollide,
  forceX,
  forceY,
  forceManyBody,
  type Simulation,
} from "d3-force";
import Link from "next/link";
import type { Spot } from "@/lib/types";
import { CATEGORIES, CATEGORY_KEYS, type Category } from "@/lib/categories";
import { isLiveNow } from "@/lib/spots";

interface BubbleNode {
  id: string;
  kind: "category" | "spot";
  label: string;
  emoji: string;
  color: string;
  r: number;
  live: boolean;
  href?: string;
  category?: Category;
  x?: number;
  y?: number;
}

const MIN_R = 34; // ≥44px diameter touch target once padding counts
const MAX_RATIO = 4;

/** Playful packed-bubble browse view — d3-force drives positions, divs render
 * (fine below ~60 bubbles; DESIGN.md says move to canvas beyond that).
 * Level 1: category bubbles sized by deal count. Tap → level 2: that
 * category's spots. Filters re-pack the field; re-packing IS the feedback. */
export default function BubbleView({ spots }: { spots: Spot[] }) {
  const [expanded, setExpanded] = useState<Category | null>(null);
  const [positions, setPositions] = useState<BubbleNode[]>([]);
  const simRef = useRef<Simulation<BubbleNode, undefined> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const nodes = useMemo<BubbleNode[]>(() => {
    if (expanded) {
      const meta = CATEGORIES[expanded];
      const members = spots.filter((s) => s.deals.some((d) => d.category === expanded));
      const counts = members.map((s) => s.deals.length);
      const max = Math.max(1, ...counts);
      return members.map((s) => ({
        id: s.id,
        kind: "spot" as const,
        label: s.name,
        emoji: meta.emoji,
        color: meta.color,
        r: Math.max(MIN_R, Math.min(MIN_R * 2.2, MIN_R + (s.deals.length / max) * 28)),
        live: isLiveNow(s),
        href: `/r/${s.slug}`,
      }));
    }
    const withCounts = CATEGORY_KEYS.map((c) => ({
      c,
      count: spots.filter((s) => s.deals.some((d) => d.category === c)).length,
    })).filter((x) => x.count > 0);
    const max = Math.max(1, ...withCounts.map((x) => x.count));
    return withCounts.map(({ c, count }) => {
      const meta = CATEGORIES[c];
      const scale = Math.sqrt(count / max); // radius ∝ sqrt(count)
      const r = Math.max(MIN_R, Math.min(MIN_R * MAX_RATIO, 30 + scale * 62));
      return {
        id: `cat-${c}`,
        kind: "category" as const,
        label: meta.label,
        emoji: meta.emoji,
        color: meta.color,
        r,
        live: spots.some((s) => s.deals.some((d) => d.category === c) && isLiveNow(s)),
        category: c,
      };
    });
  }, [spots, expanded]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const cx = width / 2;
    const cy = height / 2;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const simNodes: BubbleNode[] = nodes.map((n, i) => ({
      ...n,
      x: cx + Math.cos((i / Math.max(1, nodes.length)) * Math.PI * 2) * 40,
      y: cy + Math.sin((i / Math.max(1, nodes.length)) * Math.PI * 2) * 40,
    }));

    const clamp = () =>
      simNodes.map((n) => ({
        ...n,
        x: Math.max(n.r, Math.min(width - n.r, n.x ?? cx)),
        y: Math.max(n.r, Math.min(height - n.r, n.y ?? cy)),
      }));

    simRef.current?.stop();
    const sim = forceSimulation(simNodes)
      .stop() // we drive ticks ourselves — d3's rAF timer stalls in hidden tabs
      .force("x", forceX(cx).strength(0.06))
      .force("y", forceY(cy).strength(0.08))
      .force("charge", forceManyBody().strength(4))
      .force("collide", forceCollide<BubbleNode>((d) => d.r + 3).strength(0.9));

    // Settle the pack synchronously so bubbles always appear immediately.
    sim.tick(160);
    setPositions(clamp());
    simRef.current = sim;

    if (reduced) return () => sim.stop();

    // Progressive enhancement: replay the packing as a springy entrance.
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
  }, [nodes]);

  return (
    <div>
      <div className="mb-3 flex min-h-8 items-center gap-2">
        {expanded ? (
          <>
            <button
              onClick={() => setExpanded(null)}
              className="rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink hover:bg-sunken"
            >
              ← All categories
            </button>
            <span className="font-display text-lg text-ink">
              {CATEGORIES[expanded].emoji} {CATEGORIES[expanded].label}
            </span>
          </>
        ) : (
          <p className="text-sm text-muted">
            Bigger bubble = more deals. Tap a category to dive in — amber dot means a happy hour is
            live right now.
          </p>
        )}
      </div>
      <div
        ref={containerRef}
        className="relative h-[65vh] min-h-[420px] overflow-hidden rounded-2xl border border-line bg-sunken/50"
      >
        {positions.length === 0 && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-muted">
            Nothing here… yet. Clear a filter, or be the first to add a deal.
          </p>
        )}
        {positions.map((n) => {
          const inner = (
            <span
              className="flex h-full w-full flex-col items-center justify-center rounded-full border-2 text-center leading-tight transition-transform hover:scale-105"
              style={{
                background: `${n.color}26`,
                borderColor: n.color,
                transitionTimingFunction: "var(--ease-spring)",
              }}
            >
              <span style={{ fontSize: Math.max(16, n.r * 0.42) }}>{n.emoji}</span>
              <span
                className={`px-1 font-medium text-ink ${n.kind === "category" ? "font-display" : ""}`}
                style={{ fontSize: Math.max(9, Math.min(13, n.r * 0.16)) }}
              >
                {n.label.length > 22 ? `${n.label.slice(0, 20)}…` : n.label}
              </span>
              {n.live && (
                <span className="live-dot absolute right-[12%] top-[12%] h-3 w-3 rounded-full bg-accent" />
              )}
            </span>
          );
          const style: React.CSSProperties = {
            position: "absolute",
            width: n.r * 2,
            height: n.r * 2,
            transform: `translate(${(n.x ?? 0) - n.r}px, ${(n.y ?? 0) - n.r}px)`,
          };
          return n.kind === "category" ? (
            <button
              key={n.id}
              style={style}
              onClick={() => setExpanded(n.category!)}
              aria-label={`Browse ${n.label}`}
              className="relative"
            >
              {inner}
            </button>
          ) : (
            <Link key={n.id} href={n.href!} style={style} aria-label={n.label} className="relative">
              {inner}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
