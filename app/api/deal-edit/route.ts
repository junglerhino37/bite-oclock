import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServiceDb, UPLOADS_BUCKET } from "@/lib/db";
import { getAnySpot } from "@/lib/live";
import { rateLimit, clientKey } from "@/lib/ratelimit";
import { CATEGORY_KEYS } from "@/lib/categories";
import { DAYS } from "@/lib/types";
import type { Deal } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_PHOTO = 10 * 1024 * 1024;

const PatchSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(80),
  /** Which deal to touch — its current item name, exact. */
  originalItem: z.string().min(1).max(120),
  action: z.enum(["edit", "remove"]),
  item: z.string().min(1).max(120).optional(),
  price: z.string().max(40).nullable().optional(),
  category: z.enum(CATEGORY_KEYS as [string, ...string[]]).optional(),
  description: z.string().max(240).nullable().optional(),
  days: z.array(z.enum(DAYS as [string, ...string[]])).max(7).optional(),
});

function sniffImageType(buf: Buffer): { mime: string; ext: string } | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return { mime: "image/jpeg", ext: "jpg" };
  if (
    buf.length > 8 &&
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return { mime: "image/png", ext: "png" };
  if (
    buf.length > 12 &&
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  )
    return { mime: "image/webp", ext: "webp" };
  return null;
}

/** Community edit of a single deal (rename/price/description/photo/remove).
 * Lands as a full new version of the spot's menu, so the old state stays in
 * history. Renaming or removing a deal clears its stale verification votes. */
export async function POST(req: Request) {
  if (!rateLimit(`dealedit:${clientKey(req)}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }
  const db = getServiceDb();
  if (!db) return NextResponse.json({ error: "No database configured." }, { status: 501 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }
  let patch;
  try {
    patch = PatchSchema.parse(JSON.parse(String(form.get("payload") ?? "")));
  } catch {
    return NextResponse.json({ error: "Invalid edit." }, { status: 400 });
  }

  const spot = await getAnySpot(patch.slug);
  if (!spot) return NextResponse.json({ error: "Unknown restaurant." }, { status: 404 });
  const idx = spot.deals.findIndex((d) => d.item === patch.originalItem);
  if (idx === -1) {
    return NextResponse.json(
      { error: "That deal changed under you — refresh and try again." },
      { status: 409 },
    );
  }
  if (patch.action === "remove" && spot.deals.length === 1) {
    return NextResponse.json(
      { error: "Can't remove the last deal — update the whole listing instead." },
      { status: 400 },
    );
  }

  let photoPath: string | null = null;
  const photo = form.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > MAX_PHOTO) {
      return NextResponse.json({ error: "Photo too large (10 MB max)." }, { status: 413 });
    }
    const buf = Buffer.from(await photo.arrayBuffer());
    const kind = sniffImageType(buf);
    if (!kind) {
      return NextResponse.json({ error: "Only JPEG, PNG, or WebP photos." }, { status: 415 });
    }
    photoPath = `dishes/${crypto.randomUUID()}.${kind.ext}`;
    const { error: upErr } = await db.storage
      .from(UPLOADS_BUCKET)
      .upload(photoPath, buf, { contentType: kind.mime });
    if (upErr) {
      console.error("dish photo upload failed:", upErr.message);
      photoPath = null;
    }
  }

  const deals = spot.deals
    .map((d, i) => {
      if (i !== idx)
        return {
          item: d.item,
          price: d.price,
          category: d.category,
          description: d.description ?? null,
          days: d.days ?? [],
          photo_path: d.photoPath ?? null,
        };
      if (patch.action === "remove") return null;
      return {
        item: patch.item ?? d.item,
        price: patch.price !== undefined ? patch.price : d.price,
        category: (patch.category as Deal["category"] | undefined) ?? d.category,
        description: patch.description !== undefined ? patch.description : (d.description ?? null),
        days: patch.days ?? d.days ?? [],
        photo_path: photoPath ?? d.photoPath ?? null,
      };
    })
    .filter(Boolean);

  const { error } = await db.from("submissions").insert({
    restaurant_name: spot.name,
    neighborhood: spot.neighborhood,
    days: spot.days,
    start_time: spot.start,
    end_time: spot.end,
    deals,
    spot_slug: patch.slug,
    status: "approved",
  });
  if (error) {
    console.error("deal edit failed:", error.message);
    return NextResponse.json({ error: "Could not save the edit." }, { status: 502 });
  }

  // Stale votes: a renamed or removed deal is a different thing now.
  const renamed = patch.action === "edit" && patch.item && patch.item !== patch.originalItem;
  if (patch.action === "remove" || renamed) {
    await db
      .from("votes")
      .delete()
      .eq("spot_slug", patch.slug)
      .eq("kind", "deal")
      .eq("target", patch.originalItem);
  }

  revalidatePath("/");
  revalidatePath(`/r/${patch.slug}`);
  return NextResponse.json({ ok: true });
}
