import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * A server-side Supabase client that reads no cookies.
 *
 * ── Why this exists as its own file ────────────────────────────────────────
 * The deployment pause of 23 August has one root cause that has now appeared
 * three times in this codebase (`sitemap.ts`, `relatedData.ts`,
 * `lists/[listId]/page.tsx`): a server component reaches for `createClient()`
 * out of habit, `createClient()` calls `cookies()`, and reading a cookie opts
 * the entire route out of caching. Nothing errors. Nothing warns. The page
 * simply starts costing a full render on every single hit, and the only way to
 * find out is to read the `Cache-Control` header in production.
 *
 * Writing the fix out by hand each time — six lines of `createSupabaseClient`
 * with the right two env var fallbacks and the right auth options — is what
 * made it easier to type `createClient()` and move on. So it is one import.
 *
 * ── When to use it ─────────────────────────────────────────────────────────
 * Whenever the answer does not depend on *who* is asking: a sitemap, an
 * aggregate over everybody, structured data describing a public page, a TMDB
 * lookup. If two different signed-in people would see the same bytes, this is
 * the client to use, and using it is what allows the route to be cached.
 *
 * ── What it is not ─────────────────────────────────────────────────────────
 * It is not `createAdminClient()`. This carries the anon key and is fully
 * subject to RLS — which is the point. Reading as `anon` means the database
 * enforces "a stranger may see this" independently of whatever the calling
 * code believes, so a mistake in the caller's own visibility filter is caught
 * by the row policy rather than published to a shared cache.
 *
 * `persistSession` and `autoRefreshToken` are off because there is no session
 * to persist and no token to refresh; left on, the client keeps a refresh
 * timer alive in a serverless invocation that is about to be frozen.
 */
export function createAnonClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase environment variables. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY) are defined."
    );
  }

  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
