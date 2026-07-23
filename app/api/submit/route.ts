import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { SubmissionSchema } from "@/lib/ai/schemas";
import { getServiceDb, UPLOADS_BUCKET } from "@/lib/db";
import { rateLimit, clientKey } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_PHOTO = 10 * 1024 * 1024;

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

/** Persist a human-reviewed submission (edited extraction + source photo) as
 * PENDING for moderation. Multipart: 'payload' = JSON, 'photo' = image (optional). */
export async function POST(req: Request) {
  const key = clientKey(req);
  if (!rateLimit(`submit:${key}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  let payload;
  try {
    payload = SubmissionSchema.parse(JSON.parse(String(form.get("payload") ?? "")));
  } catch {
    return NextResponse.json({ error: "Invalid submission payload." }, { status: 400 });
  }

  const db = getServiceDb();
  if (!db) {
    // No database on this instance — the review flow still works end to end,
    // but nothing can persist. The UI surfaces this honestly.
    return NextResponse.json({ stored: false, demo: true });
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
    photoPath = `pending/${crypto.randomUUID()}.${kind.ext}`;
    const { error: upErr } = await db.storage
      .from(UPLOADS_BUCKET)
      .upload(photoPath, buf, { contentType: kind.mime });
    if (upErr) {
      console.error("photo upload failed:", upErr.message);
      photoPath = null; // photo is nice-to-have; the submission still counts
    }
  }

  const { data, error } = await db
    .from("submissions")
    .insert({
      restaurant_name: payload.restaurant_name,
      neighborhood: payload.neighborhood,
      days: payload.days,
      start_time: payload.start,
      end_time: payload.end,
      deals: payload.deals,
      photo_path: photoPath,
      submitter_ip_hash: createHash("sha256").update(key).digest("hex").slice(0, 16),
    })
    .select("id")
    .single();

  if (error) {
    console.error("submission insert failed:", error.message);
    return NextResponse.json({ error: "Could not save submission." }, { status: 502 });
  }
  return NextResponse.json({ stored: true, id: data.id });
}
