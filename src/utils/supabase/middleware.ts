import { createServerClient, type CookieOptions } from "@supabase/ssr";
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
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: "", ...options });
        response.cookies.set({ name, value: "", maxAge: 0, ...options });
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
    response.cookies.getAll().forEach(({ name, value }) => {
      redirectResponse.cookies.set(name, value);
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
