"use client";

import { useEffect, useRef, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase-browser";

interface Profile {
  name: string;
  avatar: string | null;
}

/** Header sign-in via Supabase OAuth (Google/Facebook). Renders nothing when
 * the public Supabase env vars aren't configured — the site works signed-out,
 * votes just fall back to anonymous. */
export default function AuthButton() {
  const supabase = getBrowserSupabase();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!supabase) return;
    const apply = (user: { user_metadata: Record<string, unknown>; email?: string } | null) =>
      setProfile(
        user
          ? {
              name:
                (typeof user.user_metadata.full_name === "string" && user.user_metadata.full_name) ||
                (typeof user.user_metadata.name === "string" && user.user_metadata.name) ||
                user.email ||
                "Signed in",
              avatar:
                typeof user.user_metadata.avatar_url === "string"
                  ? user.user_metadata.avatar_url
                  : null,
            }
          : null,
      );
    void supabase.auth.getUser().then(({ data }) => apply(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      apply(session?.user ?? null),
    );
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!supabase) return null;

  const signIn = (provider: "google" | "facebook") =>
    supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.href },
    });

  if (profile) {
    return (
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 rounded-full px-2 py-1 text-muted transition-colors hover:bg-sunken hover:text-ink"
          aria-label={`Account: ${profile.name}`}
        >
          {profile.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar}
              alt=""
              className="h-7 w-7 rounded-full border border-line object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-white">
              {profile.name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </button>
        {open && (
          <div className="absolute right-0 top-10 z-50 w-44 rounded-2xl border border-line bg-surface p-2 shadow-lg">
            <p className="truncate px-3 py-1.5 text-xs text-muted">{profile.name}</p>
            <button
              onClick={() => {
                void supabase.auth.signOut();
                setOpen(false);
              }}
              className="w-full rounded-xl px-3 py-1.5 text-left text-sm text-ink hover:bg-sunken"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-full px-3 py-1.5 text-muted transition-colors hover:bg-sunken hover:text-ink"
      >
        Sign in
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-48 rounded-2xl border border-line bg-surface p-2 shadow-lg">
          <button
            onClick={() => void signIn("google")}
            className="w-full rounded-xl px-3 py-2 text-left text-sm text-ink hover:bg-sunken"
          >
            Continue with Google
          </button>
          <button
            onClick={() => void signIn("facebook")}
            className="w-full rounded-xl px-3 py-2 text-left text-sm text-ink hover:bg-sunken"
          >
            Continue with Facebook
          </button>
          <p className="px-3 pb-1 pt-2 text-[11px] leading-snug text-muted">
            Sign in so your &ldquo;still current&rdquo; votes count once.
          </p>
        </div>
      )}
    </div>
  );
}
