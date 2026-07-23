import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createHash } from "crypto";
import { z } from "zod";
import { getServiceDb } from "@/lib/db";
import { rateLimit, clientKey } from "@/lib/ratelimit";
import type { VoteSummary } from "@/lib/types";

export const runtime = "nodejs";

const VoteSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(80),
  kind: z.enum(["deal", "hours"]),
  /** Deal item name; ignored for hours. */
  target: z.string().max(120).default(""),
  vote: z.union([z.literal(1), z.literal(-1)]),
});

/** One vote per person per target. Signed-in users (Supabase auth token) vote
 * as their user id; anonymous visitors fall back to a hashed IP — good enough
 * to stop casual double-voting, not adversaries (see SECURITY.md). */
async function voterId(req: Request): Promise<string> {
  const db = getServiceDb();
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (db && token) {
    const { data } = await db.auth.getUser(token);
    if (data.user) return `u:${data.user.id}`;
  }
  return `ip:${createHash("sha256").update(clientKey(req)).digest("hex").slice(0, 16)}`;
}

export async function POST(req: Request) {
  if (!rateLimit(`verify:${clientKey(req)}`, 60, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }
  const db = getServiceDb();
  if (!db) return NextResponse.json({ error: "No database configured." }, { status: 501 });

  let body;
  try {
    body = VoteSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid vote." }, { status: 400 });
  }
  const target = body.kind === "hours" ? "" : body.target;
  const voter = await voterId(req);

  const { error } = await db.from("votes").upsert(
    {
      spot_slug: body.slug,
      kind: body.kind,
      target,
      vote: body.vote,
      voter,
      created_at: new Date().toISOString(), // re-voting refreshes "last verified"
    },
    { onConflict: "spot_slug,kind,target,voter" },
  );
  if (error) {
    console.error("vote upsert failed:", error.message);
    return NextResponse.json({ error: "Could not save the vote." }, { status: 502 });
  }

  // Fresh aggregate for this target so the UI can show real numbers.
  const { data } = await db
    .from("votes")
    .select("vote, created_at")
    .eq("spot_slug", body.slug)
    .eq("kind", body.kind)
    .eq("target", target);
  const summary: VoteSummary = { up: 0, down: 0, lastVerifiedAt: null };
  for (const v of data ?? []) {
    if (v.vote > 0) {
      summary.up += 1;
      if (!summary.lastVerifiedAt || v.created_at > summary.lastVerifiedAt)
        summary.lastVerifiedAt = v.created_at;
    } else {
      summary.down += 1;
    }
  }

  revalidatePath("/");
  revalidatePath(`/r/${body.slug}`);
  return NextResponse.json({ ok: true, summary });
}
