import { NextResponse } from "next/server";
import { getServiceDb } from "@/lib/db";
import { rateLimit, clientKey } from "@/lib/ratelimit";

export const runtime = "nodejs";

/** Footer stats: total visits, community happy hours, distinct contributors.
 * All nulls when no database is configured — the footer hides itself. */
export async function GET() {
  const db = getServiceDb();
  if (!db) return NextResponse.json({ visits: null, happyHours: null, contributors: null });

  const [visitsRes, subsRes] = await Promise.all([
    db.from("site_stats").select("value").eq("key", "visits").maybeSingle(),
    db.from("submissions").select("submitter_ip_hash").eq("status", "approved").limit(5000),
  ]);

  const visits = visitsRes.data?.value ?? null;
  const subs = subsRes.data ?? null;
  const contributors = subs
    ? new Set(subs.map((s) => s.submitter_ip_hash).filter(Boolean)).size
    : null;
  return NextResponse.json({
    visits,
    happyHours: subs ? subs.length : null,
    contributors,
  });
}

const EVENTS = new Set(["visits", "nav"]);

/** Event counters: visits (one per browser session, client-guarded) and
 * nav ("Take me there" taps — the intent-to-go metric). */
export async function POST(req: Request) {
  if (!rateLimit(`stats:${clientKey(req)}`, 120, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }
  const db = getServiceDb();
  if (!db) return NextResponse.json({ ok: false });
  let event = "visits";
  try {
    const body = await req.json();
    if (typeof body?.event === "string" && EVENTS.has(body.event)) event = body.event;
  } catch {
    // beacon posts may have no/odd body — count as a visit-shaped no-op
  }
  const { error } = await db.rpc("bump_stat", { k: event });
  if (error) console.error("stat bump failed:", error.message);
  return NextResponse.json({ ok: !error });
}
