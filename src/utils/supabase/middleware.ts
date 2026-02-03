import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "./server";

const PUBLIC_AUTH_ROUTES = ["/login", "/signup", "/forgot-password"];

/**
 * Runs only on page navigations (matcher excludes /api). Refreshes session cookie
 * and handles redirects. Profile (username) check is done in app layout to avoid
 * a DB query on every request.
 */
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError && authError.message !== "Auth session missing!") {
    if (process.env.NODE_ENV === "development") {
      console.warn("Session:", authError.message);
    }
  }

  // Root → /app
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  if (user) {
    // Send authenticated users away from login/signup/forgot-password
    if (PUBLIC_AUTH_ROUTES.includes(pathname)) {
      return NextResponse.redirect(new URL("/app", request.url));
    }
    if (pathname === "/update-password") {
      return NextResponse.next();
    }
    // Redirect to profile setup if no username (only on /app routes; proxy excludes /api so this runs per page, not per fetch)
    if (pathname.startsWith("/app") && !pathname.startsWith("/app/profile/setup")) {
      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("username")
        .eq("id", user.id)
        .limit(1)
        .maybeSingle();
      if (!profileError && !profile?.username) {
        return NextResponse.redirect(new URL("/app/profile/setup", request.url));
      }
    }
  }

  if (pathname === "/update-password") {
    return NextResponse.next();
  }

  return NextResponse.next();
}
