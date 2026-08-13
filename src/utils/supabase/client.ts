"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient, Session } from "@supabase/supabase-js";

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

// Validate environment variables at runtime
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing Supabase environment variables. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY) are defined."
  );
}

/**
 * createBrowserClient already stores the session in cookies, chunked and
 * encoded in exactly the format the server client reads back.
 *
 * There used to be a hand-rolled `storage` adapter here. It was dead code —
 * createBrowserClient spreads its own `storage` *after* `options.auth`, so it
 * always won — but it was also wrong: its getItem did `.split("=")[1]`, which
 * truncates base64 padding, and it wrote one unchunked cookie that a large
 * session would silently blow past the 4KB browser limit. Leaving it in place
 * meant any upstream change to that merge order would have logged everyone out.
 */
export const supabase: SupabaseClient = createBrowserClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
);

// Utility function to get the current session with error handling
export const getSession = async (): Promise<Session | null> => {
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error) throw new Error("Failed to fetch session: " + error.message);
    return session;
  } catch (err) {
    console.error("Error in getSession:", err);
    return null;
  }
};

// Utility function to get the current user with profile data
export const getUserProfile = async () => {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError)
      throw new Error("Failed to fetch user: " + userError.message);
    if (!user) return null;

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError)
      throw new Error("Failed to fetch profile: " + profileError.message);

    return { user, profile };
  } catch (err) {
    console.error("Error in getUserProfile:", err);
    return null;
  }
};

// Optional: Subscribe to auth state changes
export const onAuthChange = (
  callback: (event: string, session: Session | null) => void
) => {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(callback);
  return () => subscription.unsubscribe();
};
