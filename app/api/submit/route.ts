import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createHash } from "crypto";
import { SubmissionSchema } from "@/lib/ai/schemas";
import { getServiceDb, UPLOADS_BUCKET } from "@/lib/db";
import { slugifyName } from "@/lib/live";
import { rateLimit, clientKey } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_PHOTO = 10 * 1024 * 1024;
const MAX_PHOTOS = 4;

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

/** Persist a human-reviewed submission (edited extraction + source photo).
 * Multipart: 'payload' = JSON, 'photo' = image (optional).
 * Submissions publish immediately and are kept honest by community
 * verification votes (see "Community verification" in AGENTS.md). */
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

  // Accept several menu photos ('photos'), with the old single 'photo' field
  // still working. Validate each before uploading any.
  const files = [...form.getAll("photos"), form.get("photo")].filter(
    (f): f is File => f instanceof File && f.size > 0,
  );
  if (files.length > MAX_PHOTOS) {
    return NextResponse.json({ error: `At most ${MAX_PHOTOS} photos.` }, { status: 413 });
  }
  const buffers: { buf: Buffer; ext: string; mime: string }[] = [];
  for (const file of files) {
    if (file.size > MAX_PHOTO) {
      return NextResponse.json({ error: "Photo too large (10 MB max)." }, { status: 413 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const kind = sniffImageType(buf);
    if (!kind) {
      return NextResponse.json({ error: "Only JPEG, PNG, or WebP photos." }, { status: 415 });
    }
    buffers.push({ buf, ...kind });
  }
  const photoPaths: string[] = [];
  for (const { buf, ext, mime } of buffers) {
    const path = `pending/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await db.storage
      .from(UPLOADS_BUCKET)
      .upload(path, buf, { contentType: mime });
    if (upErr) console.error("photo upload failed:", upErr.message);
    else photoPaths.push(path); // photos are nice-to-have; the submission still counts
  }

  const slug = payload.spot_slug ?? slugifyName(payload.restaurant_name);
  const { data, error } = await db
    .from("submissions")
    .insert({
      restaurant_name: payload.restaurant_name,
      neighborhood: payload.neighborhood,
      days: payload.days,
      start_time: payload.start,
      end_time: payload.end,
      deals: payload.deals,
      photo_path: photoPaths[0] ?? null,
      // New columns omitted when absent so pre-migration instances still work.
      ...(photoPaths.length > 1 ? { photo_paths: photoPaths } : {}),
      ...(payload.note ? { note: payload.note } : {}),
      ...(payload.spot_slug ? { spot_slug: payload.spot_slug } : {}),
      status: "approved", // publishes immediately; votes are the quality gate
      submitter_ip_hash: createHash("sha256").update(key).digest("hex").slice(0, 16),
    })
    .select("id")
    .single();

  if (error) {
    console.error("submission insert failed:", error.message);
    return NextResponse.json({ error: "Could not save submission." }, { status: 502 });
  }

  // Live right away — no waiting on the 5-minute ISR window.
  revalidatePath("/");
  revalidatePath(`/r/${slug}`);
  return NextResponse.json({ stored: true, id: data.id, slug });
}
