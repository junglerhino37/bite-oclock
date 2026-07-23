import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

/** Browser-side Supabase client (anon key + RLS) for Google/Facebook sign-in.
 * Null when the public env vars aren't set — auth UI hides itself and voting
 * falls back to anonymous (IP-keyed) votes. */
export function getBrowserSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && key ? createClient(url, key) : null;
  return client;
}

/** Access token for the signed-in user, if any — sent with votes so one
 * account = one vote regardless of network. */
export async function getAccessToken(): Promise<string | null> {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
