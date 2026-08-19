import type { MetadataRoute } from "next";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { siteUrl } from "@/utils/siteUrl";
import { titlePath } from "@/utils/urls";

/**
 * Static routes plus every public profile and public list.
 *
 * Only `visibility = 'public'` rows are listed. A followers-only or private
 * profile must not be advertised — a sitemap is a published list of URLs, and
 * naming one would leak the existence of an account that chose not to be found
 * even though the page itself would correctly refuse to render.
 *
 * Read with a bare anon-key client — no cookies, no session.
 *
 * Two reasons, and the first is not optional: the cookie-reading server client
 * opts the whole route into dynamic rendering, so `sitemap.xml` could not be
 * cached and the `catch` below was quietly swallowing a "Dynamic server usage"
 * error on every build, shipping a sitemap with only its static half. The
 * second is that a sitemap has no viewer, so reading it as `anon` is both
 * honest and useful: RLS becomes a second opinion on the visibility filter
 * rather than something this file is trusted to get right alone.
 *
 * Capped, because a sitemap has a 50,000-URL limit and this database will not
 * approach it for a long time — but an uncapped query against a growing table
 * is a slow route waiting to happen. Splitting into a sitemap index is the
 * change to make when the cap starts binding.
 */
export const revalidate = 3600;

const MAX_ROWS = 5000;

const STATIC_PATHS: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/app", priority: 0.9, changeFrequency: "daily" },
  { path: "/app/browse", priority: 0.8, changeFrequency: "daily" },
  { path: "/app/search", priority: 0.5, changeFrequency: "monthly" },
  { path: "/app/person", priority: 0.5, changeFrequency: "weekly" },
  { path: "/app/clubs", priority: 0.6, changeFrequency: "weekly" },
  { path: "/app/tonight", priority: 0.7, changeFrequency: "weekly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();

  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map((s) => ({
    url: `${base}${s.path}`,
    lastModified: now,
    changeFrequency: s.changeFrequency,
    priority: s.priority,
  }));

  try {
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY)!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const [{ data: profiles }, { data: lists }] = await Promise.all([
      supabase
        .from("users")
        .select("username, updated_at")
        .eq("visibility", "public")
        .is("deleted_at", null)
        .not("username", "is", null)
        .limit(MAX_ROWS),
      supabase
        .from("user_lists")
        .select("id, updated_at")
        .eq("visibility", "public")
        .limit(MAX_ROWS),
    ]);

    for (const p of profiles ?? []) {
      entries.push({
        url: `${base}/app/profile/${encodeURIComponent(p.username as string)}`,
        lastModified: p.updated_at ? new Date(p.updated_at as string) : now,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }

    for (const l of lists ?? []) {
      entries.push({
        url: `${base}/app/lists/${l.id}`,
        lastModified: l.updated_at ? new Date(l.updated_at as string) : now,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }

    /**
     * Every title anyone here has actually engaged with.
     *
     * This is the half of the sitemap that matters for a film site: the profile
     * and list pages are a handful, and the title pages are thousands. Listing
     * them is what turns "a site that exists" into "a site with pages worth
     * indexing".
     *
     * Drawn from `user_media_status` rather than from TMDB, and that is the
     * whole point — a catalogue of 900,000 films nobody here has touched is
     * spam, and would be crawled as such. A title in this list is one somebody
     * watched, rated or shelved, so the page has something on it that exists
     * nowhere else.
     *
     * Deduplicated on `type:id`, because a title tracked by four hundred people
     * is still one URL.
     */
    const { data: titles } = await supabase
      .from("user_media_status")
      .select("item_id, item_type, item_name, updated_at")
      .not("item_name", "is", null)
      .order("updated_at", { ascending: false })
      .limit(MAX_ROWS);

    const seen = new Set<string>();
    for (const t of titles ?? []) {
      const key = `${t.item_type}:${t.item_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push({
        url: `${base}${titlePath(t.item_type as string, t.item_id as string, t.item_name as string)}`,
        lastModified: t.updated_at ? new Date(t.updated_at as string) : now,
        // A film page changes when its availability or its reviews do, which is
        // neither daily nor never.
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  } catch (err) {
    // A sitemap that is missing its dynamic half is worth serving; one that
    // 500s teaches crawlers the URL is broken.
    console.error("sitemap: dynamic entries unavailable:", err);
  }

  return entries;
}
