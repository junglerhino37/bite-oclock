import { NextResponse } from "next/server";
import { getServiceDb } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Daily snapshot of the crowdsourced data (submissions, votes, stats) into
 * the private 'backups' storage bucket — the safety net that makes open
 * community deletes acceptable at this scale. Runs via Vercel cron (9:00
 * UTC ≈ 4 AM Houston). Restore = download the JSON, re-insert rows. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const db = getServiceDb();
  if (!db) return NextResponse.json({ error: "No database configured." }, { status: 501 });

  const [subs, votes, stats] = await Promise.all([
    db.from("submissions").select("*").limit(10000),
    db.from("votes").select("*").limit(50000),
    db.from("site_stats").select("*"),
  ]);
  if (subs.error || votes.error) {
    return NextResponse.json({ error: "Snapshot query failed." }, { status: 502 });
  }

  const day = new Date().toISOString().slice(0, 10);
  const payload = JSON.stringify({
    taken_at: new Date().toISOString(),
    submissions: subs.data,
    votes: votes.data,
    site_stats: stats.data ?? [],
  });
  const { error } = await db.storage
    .from("backups")
    .upload(`backup-${day}.json`, Buffer.from(payload), {
      contentType: "application/json",
      upsert: true,
    });
  if (error) {
    console.error("backup upload failed:", error.message);
    return NextResponse.json({ error: "Backup upload failed." }, { status: 502 });
  }
  return NextResponse.json({
    ok: true,
    file: `backup-${day}.json`,
    submissions: subs.data.length,
    votes: votes.data.length,
  });
}
