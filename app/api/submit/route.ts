import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createHash } from "crypto";
import { SubmissionSchema } from "@/lib/ai/schemas";
import { getServiceDb, UPLOADS_BUCKET } from "@/lib/db";
import { geocodeSpot } from "@/lib/geocode";
import { getAllSpots, slugifyName } from "@/lib/live";
import { bestNameMatch } from "@/lib/match";
import { rateLimit, clientKey } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_PHOTO = 10 * 1024 * 1024;
const MAX_PHOTOS = 4;

/** Validate a submitted link and strip ad-tracking params. Rejects anything
 * that isn't a public http(s) host (no IPs/localhost — we fetch it below). */
function cleanSourceUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase();
  if (
    !host.includes(".") ||
    host === "localhost" ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
    host.includes(":") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  )
    return null;
  for (const k of [...u.searchParams.keys()]) {
    if (/^(utm_|gad_|gclid|gclsrc|gbraid|wbraid|fbclid|mc_|igshid|msclkid)/i.test(k)) {
      u.searchParams.delete(k);
    }
  }
  u.username = "";
  u.password = "";
  const s = u.toString();
  return s.length <= 500 ? s : null;
}

/** Fallback metadata fetcher for bot-protected sites (Cloudflare 403s plain
 * server fetches). Microlink's free tier renders the page and returns its
 * og:image; only the public restaurant URL is sent. */
async function fetchViaMicrolink(url: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const img = data?.data?.image?.url ?? null;
    return typeof img === "string" && img.startsWith("http") && img.length <= 800 ? img : null;
  } catch {
    return null;
  }
}

/** Find a new spot's address + coordinates via OpenStreetMap's Nominatim
 * (one request per submission, identified UA, per their usage policy).
 * Results outside greater Houston are discarded — a wrong pin is worse than
 * no pin. Best-effort: failure just means no address yet. */

/** Grab the page's og:image so the listing gets a food photo from the
 * restaurant's own site. Best-effort: any failure just means no image. */
async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (compatible; bite-oclock/1.0)" },
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("text/html")) return null;
    const html = (await res.text()).slice(0, 400_000);
    const m =
      html.match(
        /<meta[^>]+(?:property|name)=["']og:image(?::secure_url|:url)?["'][^>]*content=["']([^"']+)["']/i,
      ) ??
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']og:image(?::secure_url|:url)?["']/i,
      );
    if (!m?.[1]) return null;
    const abs = new URL(m[1].replace(/&amp;/g, "&"), url).toString();
    return abs.startsWith("http") && abs.length <= 800 ? abs : null;
  } catch {
    return null;
  }
}

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
  // Deal-less submissions are link/hours-only overlays — they need a target.
  if (payload.deals.length === 0 && !payload.spot_slug) {
    return NextResponse.json({ error: "Keep at least one deal." }, { status: 400 });
  }
  const sourceUrl = payload.source_url ? cleanSourceUrl(payload.source_url) : null;
  if (payload.source_url && !sourceUrl) {
    return NextResponse.json({ error: "That link doesn't look like a public URL." }, { status: 400 });
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

  const imageUrl = sourceUrl
    ? ((await fetchOgImage(sourceUrl)) ?? (await fetchViaMicrolink(sourceUrl)))
    : null;

  // One listing per physical restaurant: clients confirm fuzzy matches in the
  // UI, but a strong name match (exact/substring — "Boheme" ⊂ "Bar Boheme")
  // gets attached here too, so no API path can mint a near-duplicate.
  let spotSlug = payload.spot_slug ?? null;
  if (!spotSlug) {
    const match = bestNameMatch(payload.restaurant_name, await getAllSpots(), 1);
    if (match) spotSlug = match.slug;
  }

  // Brand-new spots must arrive with an exact location — no pin, no listing.
  const geo = spotSlug
    ? null
    : await geocodeSpot(payload.restaurant_name, payload.address ?? null);
  if (!spotSlug && !geo) {
    return NextResponse.json(
      {
        error: `Couldn't pin down ${payload.restaurant_name}'s location — add its street address so it gets an exact spot on the map.`,
      },
      { status: 422 },
    );
  }

  const slug = spotSlug ?? slugifyName(payload.restaurant_name);
  const { data, error } = await db
    .from("submissions")
    .insert({
      restaurant_name: payload.restaurant_name,
      // Nobody types neighborhoods — the location knows where it is.
      neighborhood: payload.neighborhood || geo?.neighborhood || null,
      days: payload.days,
      start_time: payload.start,
      end_time: payload.end,
      deals: payload.deals,
      photo_path: photoPaths[0] ?? null,
      // New columns omitted when absent so pre-migration instances still work.
      ...(photoPaths.length > 1 ? { photo_paths: photoPaths } : {}),
      ...(payload.note ? { note: payload.note } : {}),
      ...(spotSlug ? { spot_slug: spotSlug } : {}),
      ...(sourceUrl ? { source_url: sourceUrl } : {}),
      ...(imageUrl ? { image_url: imageUrl } : {}),
      ...(geo ? { address: geo.address, lat: geo.lat, lng: geo.lng } : {}),
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
