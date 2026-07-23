"use client";

import type { Spot } from "@/lib/types";
import { isLiveNow } from "@/lib/spots";

/** Client-only so the "live right now" state reflects the visitor's clock,
 * not the server render time. */
export default function LiveNow({ spot }: { spot: Spot }) {
  if (!isLiveNow(spot)) return null;
  return (
    <span className="live-dot flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-sm font-semibold text-[#241c15]">
      <span className="h-2 w-2 rounded-full bg-[#241c15]" /> Happy hour is LIVE
    </span>
  );
}
