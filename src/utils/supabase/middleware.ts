import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth/next";

const PUBLIC_AUTH_ROUTES = ["/login", "/signup", "/forgot-password"];

/**
 * "This signed-in person has a handle and isn't deleted", remembered for a few
 * hours so app pages stop reading their `users` row on every navigation — the
 * one database round trip left in this function (300–700 ms measured from
 * India to the Seoul database, on every signed-in page). Its value is the
 * user id *and the session* it vouches for: every sign-in is a new session,
 * so a deleted account that signs back in to reactivate — or another account
 * on the same browser — is always checked afresh. (Keyed on the user alone,
 * someone who deleted their account and signed straight back in was let into
 * the app for up to six hours with the deletion still scheduled.) The account
 * deletion route also clears it, and finding a deleted account clears it.
 * Nothing here is a security boundary: it only routes; RLS decides reads.
 */
const PROFILE_OK = "ls-profile-ok";
const PROFILE_OK_MAX_AGE = 60 * 60 * 6;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

/**
 * Runs on page navigations (matcher excludes /api). Creates a Supabase client that
 * reads cookies from the request and writes refreshed session cookies to the response.
 * Returning that response (or a redirect with cookies copied) ensures the browser
 * receives updated tokens so the session does not expire after a few minutes.
 */
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Response we'll send; cookie handlers will attach refreshed session to this
  let response = NextResponse.next({ request });

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  /**
   * No auth cookie, no session, nothing to refresh — leave before paying for it.
   *
   * Everything this function actually does is inside `if (user)`. A request
   * carrying no Supabase cookie cannot produce a user, so it was creating a
   * client, making a network round trip to Supabase to be told "no session",
   * and returning the response it already had.
   *
   * That is every crawler request, and crawlers are most of the traffic:
   * middleware was 527,753 invocations, 50.1% of the account's total, and this
   * ran on all of them. It is also why Fluid Active CPU sat at 12h against a 4h
   * limit — a Supabase round trip per page view, for visitors who have no
   * account.
   *
   * Matched by prefix rather than by exact name because supabase-ssr chunks
   * large tokens into `sb-<ref>-auth-token.0`, `.1`; an exact-name check would
   * silently stop refreshing exactly the sessions that are big enough to matter.
   */
  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
  if (!hasAuthCookie) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Refreshing rotates the refresh token and revokes the old one, so the
        // rest of this request has to see the new value. Rebuilding the
        // response from the mutated request is the documented pattern.
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  /**
   * Who is this, without asking the auth server.
   *
   * `getUser()` sent every signed-in request to Supabase Auth to be told what
   * the token already says — a round trip per page view, and a per-address
   * rate limit that one busy afternoon of testing from a single machine was
   * enough to reach, after which every API route answered 401 until it reset.
   * The project signs tokens with an ES256 key, so `getClaims()` checks the
   * signature here against the published key (fetched once and cached) and
   * only talks to Auth when the token has expired and needs refreshing —
   * which it still does, writing the new cookies through `setAll` above.
   *
   * What it gives up: a token revoked elsewhere stays usable here until it
   * expires (an hour at most). Nothing below is a security boundary — it
   * routes people to the right page; RLS decides what anyone may read.
   */
  const { data: claimsData, error: authError } = await supabase.auth.getClaims();
  const userId = (claimsData?.claims?.sub as string | undefined) ?? null;
  const sessionKey = userId ? `${userId}:${(claimsData?.claims?.session_id as string | undefined) ?? ""}` : null;

  if (authError && authError.message !== "Auth session missing!") {
    if (process.env.NODE_ENV === "development") {
      console.warn("Session:", authError.message);
    }
  }

  /** Copy session cookies from current response onto a redirect response so browser gets refreshed tokens. */
  function redirectWithCookies(url: URL) {
    const redirectResponse = NextResponse.redirect(url);
    // Spread the whole cookie, not just name/value — dropping path/maxAge/
    // sameSite/httpOnly here produced a session cookie the browser scoped to
    // the current path and discarded on close.
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  }

  if (userId) {
    /**
     * Root → /app, for signed-in users only.
     *
     * This redirect used to sit above this block, so it fired unconditionally
     * and `src/app/page.tsx` — 476 lines of hero, feature grid and sign-up CTAs
     * — could not be reached by anyone. A first-time visitor arriving from a
     * shared link or a search result was thrown straight into the logged-in
     * app shell with nothing explaining what LetSee is. Someone already signed
     * in has no use for the pitch; someone who isn't has nothing else.
     */
    if (pathname === "/update-password") {
      return response;
    }

    // /app/welcome and /app/settings are the two places a user without a
    // handle is allowed to be — everything else bounces them to onboarding.
    const isOnboarding =
      pathname.startsWith("/app/welcome") || pathname.startsWith("/app/settings");
    const isAuthRoute = PUBLIC_AUTH_ROUTES.includes(pathname);

    /**
     * One lookup, hoisted, because the deleted-account answer has to be known
     * before the auth-route redirect rather than after it.
     */
    let profile: { username: string | null; deleted_at: string | null } | null = null;
    // Read and answered — so `profile === null` means there's no row, not that
    // the read failed or was skipped.
    let profileKnown = false;
    const vouched = pathname.startsWith("/app") && !!sessionKey && request.cookies.get(PROFILE_OK)?.value === sessionKey;
    if (!vouched && (pathname === "/" || isAuthRoute || pathname.startsWith("/app"))) {
      const { data, error: profileError } = await supabase
        .from("users")
        .select("username, deleted_at")
        .eq("id", userId)
        .limit(1)
        .maybeSingle();
      if (!profileError) {
        profile = data;
        profileKnown = true;
      }
      if (profile?.username && !profile.deleted_at) {
        response.cookies.set(PROFILE_OK, sessionKey!, {
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          maxAge: PROFILE_OK_MAX_AGE,
        });
      } else if (profile) {
        response.cookies.delete(PROFILE_OK);
      }
    }

    /**
     * A deleted account has exactly one destination, and it is the login
     * screen — that is where reactivation lives.
     *
     * This has to come before the auth-route redirect below, or the two chase
     * each other: /login is a public auth route, so a signed-in user gets sent
     * to /app; /app then sees `deleted_at` and sends them back to
     * /login?error=account-deleted; and round again, forever, with the
     * reactivation offer never getting a frame to render in. Letting /login
     * through is what breaks the cycle.
     */
    if (profile?.deleted_at) {
      if (pathname === "/login") return response;
      return redirectWithCookies(new URL("/login?error=account-deleted", request.url));
    }

    /**
     * Root → /app, for signed-in users only.
     *
     * This redirect used to sit above this block, so it fired unconditionally
     * and `src/app/page.tsx` — 476 lines of hero, feature grid and sign-up CTAs
     * — could not be reached by anyone. A first-time visitor arriving from a
     * shared link or a search result was thrown straight into the logged-in
     * app shell with nothing explaining what LetSee is. Someone already signed
     * in has no use for the pitch; someone who isn't has nothing else.
     */
    // Signed in already: on to where the link meant to take you, when it's
    // somewhere on this site (lib/auth/next), else home.
    if (pathname === "/" || isAuthRoute) {
      return redirectWithCookies(new URL(safeNext(request.nextUrl.searchParams.get("next")), request.url));
    }

    /**
     * Not set up yet: no username, or no profile row at all.
     *
     * Only a row with an empty username was caught here, and nothing creates
     * the row before welcome's first step does (save_my_profile), so a new
     * account that left welcome — or signed in on another device before
     * finishing — could wander every page with no profile behind it, where
     * every write that needs one fails.
     */
    if (pathname.startsWith("/app") && !isOnboarding && profileKnown && !profile?.username) {
      return redirectWithCookies(new URL("/app/welcome", request.url));
    }
  }

  if (pathname === "/update-password") {
    return response;
  }

  return response;
}
