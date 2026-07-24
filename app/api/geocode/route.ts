import { NextResponse } from "next/server";
import { geocodeSpot } from "@/lib/geocode";
import { rateLimit, clientKey } from "@/lib/ratelimit";

export const runtime = "nodejs";

/** Live address lookup for the review screen — type a restaurant name that
 * isn't printed on the menu and the address fills itself in for confirmation
 * before publishing. */
export async function GET(req: Request) {
  if (!rateLimit(`geocode:${clientKey(req)}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }
  const q = new URL(req.url).searchParams.get("q")?.trim().slice(0, 160);
  if (!q || q.length < 3) return NextResponse.json({ result: null });
  const result = await geocodeSpot(q, null);
  return NextResponse.json({ result });
}
