import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Server-side Supabase client using the service_role key (bypasses RLS —
 * every route using this must do its own authorization checks).
 * Returns null when the instance isn't configured; callers degrade to
 * demo behavior, mirroring how the AI endpoints handle a missing key. */
export function getServiceDb(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export const UPLOADS_BUCKET = "uploads";
