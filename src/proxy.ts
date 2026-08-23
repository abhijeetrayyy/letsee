import type { NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

/**
 * Runs only for requests that actually carry a session.
 *
 * Middleware was 527,753 invocations — 50.1% of the account's total — and for a
 * request with no auth cookie it did nothing: `updateSession` returns early,
 * because everything it does lives inside `if (user)` and a cookieless request
 * cannot produce one. Every crawler and every signed-out visitor was paying for
 * an invocation to reach a `return`.
 *
 * The `has` conditions move that decision into the matcher, where not matching
 * costs nothing rather than costing an invocation that returns early.
 *
 * ── Why everything below is written out longhand ───────────────────────────
 * It has to be. Next parses this object at compile time and rejects anything it
 * cannot read statically — `source: PAGES` and `` key: `${NAME}.0` `` both fail
 * the build with "must be a string". Tidying these into constants is a change
 * that looks harmless and is not.
 *
 * ── Why two entries ────────────────────────────────────────────────────────
 * supabase-ssr names its cookie `sb-<project-ref>-auth-token`, and when the
 * token is too large for one cookie it splits it into `${key}.${i}` —
 * `…-auth-token.0`, `.1`, … A chunked session therefore has no cookie under the
 * bare name, and an unchunked one has no `.0`, so both must be listed or one of
 * the two cases silently stops being refreshed.
 *
 * ── The failure mode, stated plainly ───────────────────────────────────────
 * If these names stop matching reality — most likely by pointing the app at a
 * different Supabase project — signed-in users stop having their tokens
 * refreshed and are signed out when the current one expires. Nothing errors;
 * people quietly lose their session. `tests/invariants/proxy-matcher.test.ts`
 * fails the build if the ref here and the one in the environment disagree.
 */
export const config = {
  matcher: [
    {
      source: "/((?!api/|_next/static|_next/image|favicon.ico).*)",
      has: [{ type: "cookie", key: "sb-schsrkmuheekofxewioa-auth-token" }],
    },
    {
      source: "/((?!api/|_next/static|_next/image|favicon.ico).*)",
      has: [{ type: "cookie", key: "sb-schsrkmuheekofxewioa-auth-token.0" }],
    },
  ],
};
