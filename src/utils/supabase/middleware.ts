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

  // Root → /app
  if (pathname === "/") {
    return redirectWithCookies(new URL("/app", request.url));
  }

  if (user) {
    if (PUBLIC_AUTH_ROUTES.includes(pathname)) {
      return redirectWithCookies(new URL("/app", request.url));
    }
    if (pathname === "/update-password") {
      return response;
    }
    // /app/welcome and /app/profile/setup are the two places a user without a
    // handle is allowed to be — everything else bounces them to onboarding.
    const isOnboarding =
      pathname.startsWith("/app/welcome") || pathname.startsWith("/app/profile/setup");

    if (pathname.startsWith("/app") && !isOnboarding) {
      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("username, deleted_at")
        .eq("id", user.id)
        .limit(1)
        .maybeSingle();

      if (!profileError && profile?.deleted_at) {
        return redirectWithCookies(new URL("/login?error=account-deleted", request.url));
      }

      if (!profileError && !profile?.username) {
        return redirectWithCookies(new URL("/app/welcome", request.url));
      }
    }
  }

  if (pathname === "/update-password") {
    return response;
  }

  return response;
}
