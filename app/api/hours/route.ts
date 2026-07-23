import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServiceDb } from "@/lib/db";
import { getAnySpot } from "@/lib/live";
import { rateLimit, clientKey } from "@/lib/ratelimit";
import { DAYS } from "@/lib/types";

export const runtime = "nodejs";

const HoursSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(80),
  days: z.array(z.enum(DAYS as [string, ...string[]])).min(1).max(7),
  start: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable(),
  end: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable(),
});

/** Community edit of a spot's happy-hour days/times. Lands as an hours-only
 * submission version (deals: []) so the previous schedule stays in history,
 * and clears the old hours votes — verification restarts for the new times. */
export async function POST(req: Request) {
  if (!rateLimit(`hours:${clientKey(req)}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }
  const db = getServiceDb();
  if (!db) return NextResponse.json({ error: "No database configured." }, { status: 501 });

  let body;
  try {
    body = HoursSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid hours update." }, { status: 400 });
  }

  const spot = await getAnySpot(body.slug);
  if (!spot) return NextResponse.json({ error: "Unknown restaurant." }, { status: 404 });

  const { error } = await db.from("submissions").insert({
    restaurant_name: spot.name,
    neighborhood: spot.neighborhood,
    days: body.days,
    start_time: body.start,
    end_time: body.end,
    deals: [],
    spot_slug: body.slug,
    status: "approved",
  });
  if (error) {
    console.error("hours update failed:", error.message);
    return NextResponse.json({ error: "Could not save the new hours." }, { status: 502 });
  }

  await db.from("votes").delete().eq("spot_slug", body.slug).eq("kind", "hours");

  revalidatePath("/");
  revalidatePath(`/r/${body.slug}`);
  return NextResponse.json({ ok: true });
}
