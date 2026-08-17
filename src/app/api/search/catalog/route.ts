import { unstable_cache } from "next/cache";
import { tmdbFetchJson } from "@/utils/tmdb";
import { jsonSuccess, jsonError } from "@/utils/apiResponse";
import { normalizeQuery, type IndexRow } from "@/utils/searchIndex";

/**
 * The public half of the local search index.
 *
 * **Named `catalog`, not `index`, and that matters.** As
 * `src/app/api/search/index/route.ts` this shadowed its own parent in
 * production: Vercel's filesystem routing treats `search/index` as the index
 * handler for `search/`, so `/api/search?query=margin` returned this
 * catalogue payload instead of search results — 200, valid JSON, completely
 * wrong. Next's dev server routes the two separately, so it worked locally and
 * only broke once deployed.
 *
 * Identical for every visitor, which is the entire reason it is a separate
 * route from `/api/library/index`. `jsonSuccess` defaults to
 * `private, no-store` because most routes here are session-scoped; this one is
 * the documented exception, so it passes a positive `maxAge` and becomes
 * CDN-cacheable. Getting that backwards in either direction is expensive: a
 * public header on the library route would serve one user's titles to another,
 * and a missing one here would cost ~33 TMDB calls per anonymous visitor.
 *
 * This is also the half that makes type-ahead work when signed out, which is
 * currently at zero.
 */

export const revalidate = 3600;

const BASE = "https://api.themoviedb.org/3";
const KEY = process.env.TMDB_API_KEY;

/** 10 pages × 20 results × 2 media types, plus 2 pages of people. */
const TITLE_PAGES = 10;
const PERSON_PAGES = 2;
const TTL = 3600;

type TmdbList = {
  results?: {
    id: number;
    title?: string;
    name?: string;
    release_date?: string;
    first_air_date?: string;
    poster_path?: string | null;
    profile_path?: string | null;
  }[];
};

function year(value: string | undefined): number | null {
  const y = Number((value ?? "").slice(0, 4));
  return Number.isInteger(y) && y > 1870 ? y : null;
}

/**
 * Build the row set. Wrapped in `unstable_cache` by the handler, and that
 * wrapper is not optional.
 *
 * `fetchTmdb` calls `waitForSlot()` *before* every request, so its 120ms
 * rate-limit gap is paid whether or not Next serves the response from the Data
 * Cache. Measured, that put this route at a flat **3.95s on every request** —
 * 33 calls × 120ms — with the fetch cache working perfectly and making no
 * difference. Caching the whole function is what actually skips the loop.
 */
async function buildRows(): Promise<IndexRow[]> {
  const urls: { url: string; t: IndexRow["t"] }[] = [];
  for (let page = 1; page <= TITLE_PAGES; page++) {
    urls.push({ url: `${BASE}/movie/popular?api_key=${KEY}&page=${page}`, t: "movie" });
    urls.push({ url: `${BASE}/tv/popular?api_key=${KEY}&page=${page}`, t: "tv" });
  }
  for (let page = 1; page <= PERSON_PAGES; page++) {
    urls.push({ url: `${BASE}/person/popular?api_key=${KEY}&page=${page}`, t: "person" });
  }

  // `revalidate` must be top level — tmdbClient reads it there and ignores a
  // `next: { revalidate }` object. Uncached, this route would be 33 TMDB calls
  // on every request rather than once an hour.
  const pages = await Promise.all(
    urls.map(({ url, t }) =>
      tmdbFetchJson<TmdbList>(url, `search-index:${t}`, { revalidate: TTL })
        .then((r) => ({ t, data: r.data }))
        .catch(() => ({ t, data: null })),
    ),
  );

  const rows: IndexRow[] = [];
  const seen = new Set<string>();
  for (const { t, data } of pages) {
    for (const item of data?.results ?? []) {
      const name = item.title ?? item.name ?? "";
      const k = `${t}:${item.id}`;
      if (!name || seen.has(k)) continue;
      seen.add(k);
      rows.push({
        k,
        n: name,
        s: normalizeQuery(name),
        t,
        y: t === "person" ? null : year(item.release_date ?? item.first_air_date),
        p: (t === "person" ? item.profile_path : item.poster_path) ?? null,
      });
    }
  }

  return rows;
}

export async function GET() {
  if (!KEY) return jsonError("TMDB_API_KEY is missing on the server.", 500);

  const rows = await unstable_cache(buildRows, ["search-index-v2"], {
    revalidate: TTL,
  })();

  // A partial index beats none — one failed page out of 22 should thin the
  // suggestions, not empty them. But an entirely empty result means every call
  // failed, and serving that would be worse than saying so.
  if (rows.length === 0) return jsonError("Could not build the search index.", 502);

  return jsonSuccess({ v: 1, rows }, { maxAge: TTL, staleWhileRevalidate: 1800 });
}
