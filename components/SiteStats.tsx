"use client";

import { useEffect, useState } from "react";

interface Stats {
  visits: number | null;
  happyHours: number | null;
  contributors: number | null;
}

/** Footer counters: visits + community contributions. Counts one visit per
 * browser session; renders nothing until stats arrive (or ever, on a
 * database-less demo instance). */
export default function SiteStats() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        if (!sessionStorage.getItem("bo-visit-counted")) {
          sessionStorage.setItem("bo-visit-counted", "1");
          await fetch("/api/stats", { method: "POST" });
        }
        const res = await fetch("/api/stats");
        if (res.ok) setStats(await res.json());
      } catch {
        // Stats are decoration — fail silently.
      }
    };
    void run();
  }, []);

  if (!stats || (stats.visits === null && stats.happyHours === null)) return null;

  const fmt = (n: number) => n.toLocaleString("en-US");
  return (
    <p className="font-data text-xs text-muted">
      {stats.happyHours !== null && (
        <>
          🍤 {fmt(stats.happyHours)} happy hour{stats.happyHours === 1 ? "" : "s"} added
          {stats.contributors !== null && stats.contributors > 0 && (
            <> by {fmt(stats.contributors)} {stats.contributors === 1 ? "person" : "people"}</>
          )}
        </>
      )}
      {stats.happyHours !== null && stats.visits !== null && " · "}
      {stats.visits !== null && <>👀 visited {fmt(stats.visits)} time{stats.visits === 1 ? "" : "s"}</>}
    </p>
  );
}
