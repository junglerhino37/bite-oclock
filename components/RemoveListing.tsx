"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Small, deliberate escape hatch on community-added listings: "we added
 * this by mistake." Soft delete server-side — restorable. */
export default function RemoveListing({ slug, name }: { slug: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (busy) return;
    if (
      !confirm(
        `Remove ${name} from the site? Use this only if the listing was added by mistake (e.g. no actual happy hour). It can be restored later.`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/takedown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      if (!res.ok) {
        setError((await res.json()).error ?? "Couldn't remove it.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span>
      <button
        onClick={() => void remove()}
        disabled={busy}
        className="underline decoration-line underline-offset-2 hover:text-danger disabled:opacity-50"
      >
        {busy ? "Removing…" : "Added by mistake? Remove this listing"}
      </button>
      {error && <span className="ml-2 text-danger">{error}</span>}
    </span>
  );
}
