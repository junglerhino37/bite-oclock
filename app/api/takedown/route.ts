import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServiceDb } from "@/lib/db";
import { slugifyName } from "@/lib/live";
import { getSpots } from "@/lib/spots";
import { rateLimit, clientKey } from "@/lib/ratelimit";

export const runtime = "nodejs";

const Schema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(80),
});

/** Community-scale takedown: anyone may remove a community-added listing
 * (mistakes happen — "oops, that place has no happy hour"). SOFT delete:
 * every submission flips to 'rejected', nothing is destroyed, and a daily
 * backup exists besides — restore by flipping status back. Seed listings
 * can't be removed this way. Revisit with accounts/flags at real scale. */
export async function POST(req: Request) {
  if (!rateLimit(`takedown:${clientKey(req)}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }
  const db = getServiceDb();
  if (!db) return NextResponse.json({ error: "No database configured." }, { status: 501 });

  let body;
  try {
    body = Schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (getSpots().some((s) => s.slug === body.slug)) {
    return NextResponse.json(
      { error: "Curated listings can't be removed here." },
      { status: 403 },
    );
  }

  const { data, error } = await db
    .from("submissions")
    .select("id, restaurant_name, spot_slug")
    .eq("status", "approved");
  if (error || !data) {
    return NextResponse.json({ error: "Query failed." }, { status: 502 });
  }
  const ids = data
    .filter((r) => (r.spot_slug?.trim() || slugifyName(r.restaurant_name)) === body.slug)
    .map((r) => r.id);
  if (ids.length === 0) {
    return NextResponse.json({ error: "Nothing to remove." }, { status: 404 });
  }
  const { error: upErr } = await db
    .from("submissions")
    .update({ status: "rejected", reviewed_at: new Date().toISOString() })
    .in("id", ids);
  if (upErr) {
    return NextResponse.json({ error: "Couldn't remove the listing." }, { status: 502 });
  }

  revalidatePath("/");
  revalidatePath(`/r/${body.slug}`);
  return NextResponse.json({ ok: true, removed: ids.length });
}
