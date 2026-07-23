import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { z } from "zod";
import { getServiceDb, UPLOADS_BUCKET } from "@/lib/db";
import { rateLimit, clientKey } from "@/lib/ratelimit";

export const runtime = "nodejs";

/** v1 moderation auth: a single shared MODERATOR_KEY env var, sent as a header.
 * Deliberately simple until real auth lands (see README roadmap) — constant-time
 * compare, rate-limited, and the key never appears in client code. */
function isModerator(req: Request): boolean {
  const expected = process.env.MODERATOR_KEY;
  const got = req.headers.get("x-moderator-key");
  if (!expected || !got) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  if (!rateLimit(`mod:${clientKey(req)}`, 60, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }
  const db = getServiceDb();
  if (!db) return NextResponse.json({ error: "No database configured." }, { status: 501 });
  if (!isModerator(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { data, error } = await db
    .from("submissions")
    .select("id, restaurant_name, neighborhood, days, start_time, end_time, deals, photo_path, status, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("mod list failed:", error.message);
    return NextResponse.json({ error: "Query failed." }, { status: 502 });
  }
  const withUrls = data.map((s) => ({
    ...s,
    photo_url: s.photo_path
      ? db.storage.from(UPLOADS_BUCKET).getPublicUrl(s.photo_path).data.publicUrl
      : null,
  }));
  return NextResponse.json({ submissions: withUrls });
}

const ActSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
});

export async function POST(req: Request) {
  if (!rateLimit(`mod:${clientKey(req)}`, 60, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }
  const db = getServiceDb();
  if (!db) return NextResponse.json({ error: "No database configured." }, { status: 501 });
  if (!isModerator(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let act;
  try {
    act = ActSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const { error } = await db
    .from("submissions")
    .update({
      status: act.action === "approve" ? "approved" : "rejected",
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", act.id);
  if (error) {
    console.error("mod act failed:", error.message);
    return NextResponse.json({ error: "Update failed." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
