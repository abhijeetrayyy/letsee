/**
 * The viewer's own header identity, read without a function invocation.
 *
 * `/api/navbar` did three things: verify the token, read one row out of
 * `users`, and decide between "anon" / "needs_profile" / "ok". The browser can
 * do all three — `supabase.auth.getSession()` reads (and, when it has expired,
 * refreshes) the token out of the same cookie the route was reading, and the
 * `users` row is reachable under RLS by the person it belongs to.
 *
 * This ran on every page load, for every signed-in visitor, and it is the
 * single most frequent client call in the app.
 *
 * ── On trusting a client-read session ──────────────────────────────────────
 * `getSession()` does not verify the JWT signature; `/api/navbar` did. That
 * difference decides nothing here: the result of this call chooses which
 * *header* to draw. Every byte of actual data behind it is fetched with the
 * same token and gated by RLS in Postgres, which does verify. A forged local
 * session buys a fake avatar and an empty app.
 */

import { supabase } from "@/utils/supabase/client";

export type AuthStatus = "loading" | "anon" | "needs_profile" | "ok";

export type AuthUser = {
  id: string;
  username?: string | null;
  avatar_url?: string | null;
};

export type AuthSnapshot = {
  status: Exclude<AuthStatus, "loading">;
  user: AuthUser | null;
};

const ANON: AuthSnapshot = { status: "anon", user: null };

export async function fetchAuthSnapshot(): Promise<AuthSnapshot> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const userId = session?.user?.id;
  if (!userId) return ANON;

  /**
   * Not `select("*")`: migration 072 revoked table-level SELECT on
   * `public.users` from `authenticated` and re-granted it per column without
   * `email`, so a star select answers 42501.
   */
  const { data, error } = await supabase
    .from("users")
    .select("id, username, avatar_url")
    .eq("id", userId)
    .maybeSingle();

  /**
   * A failed read is not a sign-out.
   *
   * The session is real — it came back from `getSession()` a line ago. If the
   * row read fails (offline, a transient 5xx from PostgREST), reporting "anon"
   * would flip the header to *Log in* for somebody who is signed in, which is
   * the exact false-logout this provider has been fighting. `needs_profile`
   * would be just as wrong, and it redirects. So: signed in, no profile
   * details yet, and the next refresh fills them in.
   */
  if (error) {
    return { status: "ok", user: { id: userId, username: null, avatar_url: null } };
  }

  if (!data?.username) {
    return { status: "needs_profile", user: { id: userId, username: null } };
  }

  return { status: "ok", user: data as AuthUser };
}
