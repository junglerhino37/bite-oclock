import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit, clientKey } from "@/lib/ratelimit";

export const runtime = "nodejs";

/** Issues a Supabase signed upload URL so the browser uploads image bytes
 * directly to storage — they never pass through our functions.
 * The server picks the path; the client only gets to fill the slot.
 * Returns 501 until Supabase env vars are configured (see .env.example). */
export async function POST(req: Request) {
  if (!rateLimit(`sign:${clientKey(req)}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Uploads not configured on this instance (set SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)." },
      { status: 501 },
    );
  }

  // service_role key: server-side only, never shipped to the browser.
  const supabase = createClient(url, serviceKey);
  const path = `pending/${crypto.randomUUID()}`;
  const { data, error } = await supabase.storage.from("uploads").createSignedUploadUrl(path);
  if (error) {
    console.error("sign failed:", error.message);
    return NextResponse.json({ error: "Could not create upload slot." }, { status: 502 });
  }
  return NextResponse.json({ path: data.path, token: data.token });
}
