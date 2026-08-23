import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_AUTH_ROUTES = ["/login", "/signup", "/forgot-password"];

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

  // Refresh session if expired; this may call set()/remove() and update response
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

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

  if (user) {
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

    // /app/welcome and /app/profile/setup are the two places a user without a
    // handle is allowed to be — everything else bounces them to onboarding.
    const isOnboarding =
      pathname.startsWith("/app/welcome") || pathname.startsWith("/app/profile/setup");
    const isAuthRoute = PUBLIC_AUTH_ROUTES.includes(pathname);

    /**
     * One lookup, hoisted, because the deleted-account answer has to be known
     * before the auth-route redirect rather than after it.
     */
    let profile: { username: string | null; deleted_at: string | null } | null = null;
    if (pathname === "/" || isAuthRoute || pathname.startsWith("/app")) {
      const { data, error: profileError } = await supabase
        .from("users")
        .select("username, deleted_at")
        .eq("id", user.id)
        .limit(1)
        .maybeSingle();
      if (!profileError) profile = data;
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
    if (pathname === "/" || isAuthRoute) {
      return redirectWithCookies(new URL("/app", request.url));
    }

    if (pathname.startsWith("/app") && !isOnboarding && profile && !profile.username) {
      return redirectWithCookies(new URL("/app/welcome", request.url));
    }
  }

  if (pathname === "/update-password") {
    return response;
  }

  return response;
}
