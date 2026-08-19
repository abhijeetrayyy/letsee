import type { MetadataRoute } from "next";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { siteUrl } from "@/utils/siteUrl";
import { listPath, reviewPath, seasonPath, titlePath } from "@/utils/urls";

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

/**
 * PostgREST caps a single response at 1000 rows and does it silently — asking
 * for 5000 returns 1000 and no error, which is what `MAX_ROWS = 5000` used to
 * do here. Nothing was visibly wrong because every table was under a thousand
 * rows; the cap would have started truncating the sitemap at the exact moment
 * the sitemap started mattering. `watched_episodes` is already past it at ~9k.
 *
 * So: page explicitly, and stop when a short page says the table is exhausted.
 */
const PAGE = 1000;
const MAX_ROWS = 20000;

/**
 * Every page needs a *total* ordering or range pagination is unsound — rows
 * that tie on the sort key can be returned twice or skipped between pages.
 * That is why each caller below orders by its primary key rather than by
 * `updated_at`, which is neither unique nor stable.
 */
async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  cap: number = MAX_ROWS,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < cap; from += PAGE) {
    const { data, error } = await page(from, Math.min(from + PAGE, cap) - 1);
    // Degrade rather than throw. Throwing here would unwind into the catch
    // below and drop every other dynamic section too, so one failing table
    // would cost the sitemap its profiles, titles and seasons alike. Returning
    // a short list costs only the rows that were actually unreachable.
    if (error) {
      console.error("sitemap: page failed, returning partial list:", error);
      break;
    }
    if (!data?.length) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

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

    const [profiles, lists] = await Promise.all([
      fetchAllRows<{ username: string | null; updated_at: string | null }>((from, to) =>
        supabase
          .from("users")
          .select("username, updated_at")
          .eq("visibility", "public")
          .is("deleted_at", null)
          .not("username", "is", null)
          .order("id")
          .range(from, to),
      ),
      fetchAllRows<{ id: string; name: string | null; updated_at: string | null }>((from, to) =>
        supabase
          .from("user_lists")
          .select("id, name, updated_at")
          .eq("visibility", "public")
          .order("id")
          .range(from, to),
      ),
    ]);

    for (const p of profiles) {
      entries.push({
        url: `${base}/app/profile/${encodeURIComponent(p.username as string)}`,
        lastModified: p.updated_at ? new Date(p.updated_at as string) : now,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }

    for (const l of lists) {
      entries.push({
        url: `${base}${listPath(l.id, l.name)}`,
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
    const titles = await fetchAllRows<{
      item_id: string;
      item_type: string;
      item_name: string | null;
      updated_at: string | null;
    }>((from, to) =>
      supabase
        .from("user_media_status")
        .select("item_id, item_type, item_name, updated_at")
        .not("item_name", "is", null)
        // Composite primary key, so all three columns are needed for a total
        // order. `updated_at` alone ties constantly — the bulk quick-add stamps
        // one timestamp across a whole batch.
        .order("user_id")
        .order("item_id")
        .order("item_type")
        .range(from, to),
    );

    const seen = new Set<string>();
    const tvNames = new Map<string, string>();
    for (const t of titles) {
      const key = `${t.item_type}:${t.item_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (t.item_type === "tv") tvNames.set(String(t.item_id), t.item_name as string);
      entries.push({
        url: `${base}${titlePath(t.item_type as string, t.item_id as string, t.item_name as string)}`,
        lastModified: t.updated_at ? new Date(t.updated_at as string) : now,
        // A film page changes when its availability or its reviews do, which is
        // neither daily nor never.
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }

    /**
     * Every season anyone here has actually watched an episode of.
     *
     * Same rule as the titles above, one level down: a season is listed
     * because somebody tracked it, not because TMDB knows it exists. Listing
     * all ~40 seasons of a show one person sampled once would be padding.
     *
     * Episodes are deliberately *not* listed. There are tens of thousands of
     * them, they would swamp the few hundred URLs that carry this site, and
     * they are reachable by crawl from the season pages anyway. Seasons are the
     * level where the page still has a reason to rank on its own.
     *
     * `watched_episodes` records a show id but no show name, and the slug needs
     * one — so a season is emitted only for a show already named above. A
     * slugless URL would work (the route parses a bare id) but it would be a
     * second address for a page whose canonical carries the slug, which is a
     * duplicate this file has no reason to create.
     *
     * Read as anon, so migration 073's visibility gate applies: seasons known
     * only from private diaries are invisible here, which is correct even
     * though the resulting URL would have been public TMDB content.
     */
    const episodes = await fetchAllRows<{
      show_id: string;
      season_number: number;
      watched_at: string | null;
    }>((from, to) =>
      supabase
        .from("watched_episodes")
        .select("show_id, season_number, watched_at")
        .order("id")
        .range(from, to),
    );

    // Latest engagement per season, not `now` — a lastModified that moves every
    // time the sitemap regenerates tells a crawler nothing.
    const seasonSeen = new Map<string, number>();
    for (const e of episodes) {
      const showId = String(e.show_id);
      if (!tvNames.has(showId)) continue;
      const key = `${showId}:${e.season_number}`;
      const at = e.watched_at ? new Date(e.watched_at).getTime() : 0;
      const prev = seasonSeen.get(key);
      if (prev === undefined || at > prev) seasonSeen.set(key, at);
    }

    for (const [key, at] of seasonSeen) {
      const idx = key.lastIndexOf(":");
      const showId = key.slice(0, idx);
      const seasonNumber = Number(key.slice(idx + 1));
      entries.push({
        url: `${base}${seasonPath(showId, seasonNumber, tvNames.get(showId) as string)}`,
        lastModified: at ? new Date(at) : now,
        changeFrequency: "monthly",
        // Below a title page: a season is a subdivision of one, and should not
        // compete with it for the show's own name.
        priority: 0.6,
      });
    }

    /**
     * Public reviews.
     *
     * These are the only pages on the site whose text exists nowhere else — a
     * TMDB overview is on ten thousand sites, and somebody's paragraph about
     * why Interstellar did not work for them is on one. Leaving them out of the
     * sitemap while listing seven static routes was backwards.
     *
     * The visibility test has to match the page's own, or the sitemap
     * advertises URLs that render a `noindex` fallback. A review is listed only
     * when it has public text, its author's profile is public and not deleted,
     * and that author has not switched public reviews off — the same three
     * conditions `generateMetadata` checks before it will describe one.
     *
     * `users!user_id` is an inner join here rather than a left one, so a review
     * whose author row is filtered out drops rather than arriving with a null.
     */
    const reviews = await fetchAllRows<{
      id: number;
      item_name: string | null;
      watched_at: string | null;
      /**
       * supabase-js infers an embedded relation as an array, while PostgREST
       * returns a bare object for a many-to-one like this. Typed as declared
       * and normalised on read, rather than cast — the shape genuinely differs
       * between what the types promise and what arrives.
       */
      users:
        | { visibility: string | null; deleted_at: string | null; profile_show_public_reviews: boolean | null }[]
        | null;
    }>((from, to) =>
      supabase
        .from("watched_items")
        .select(
          "id, item_name, watched_at, users!user_id!inner(visibility, deleted_at, profile_show_public_reviews)",
        )
        .not("public_review_text", "is", null)
        .eq("users.visibility", "public")
        .is("users.deleted_at", null)
        .order("id")
        .range(from, to),
    );

    for (const r of reviews) {
      const author = Array.isArray(r.users) ? r.users[0] : r.users;
      if (!author || author.profile_show_public_reviews === false) continue;
      entries.push({
        url: `${base}${reviewPath(r.id, r.item_name)}`,
        lastModified: r.watched_at ? new Date(r.watched_at) : now,
        // A review is written once and then argued with; the page changes when
        // its comments do.
        changeFrequency: "monthly",
        priority: 0.5,
      });
    }
  } catch (err) {
    // A sitemap that is missing its dynamic half is worth serving; one that
    // 500s teaches crawlers the URL is broken.
    console.error("sitemap: dynamic entries unavailable:", err);
  }

  return entries;
}
