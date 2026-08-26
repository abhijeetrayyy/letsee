import { NextRequest } from "next/server";
import { fetchTmdb } from "@/utils/tmdbClient";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

/** TMDB's search endpoints. Anything else 404s upstream, so it is rejected here. */
const ALLOWED_MEDIA_TYPES = new Set(["multi", "movie", "tv", "person"]);

/**
 * ── This was a POST, and being a POST was costing money ───────────────────
 *
 * Nothing here writes anything. It reads a query string, asks TMDB, and hands
 * back the answer — the same answer, to everybody, for as long as TMDB's own
 * result set holds. That is a GET in every sense except the one that matters
 * for the bill: **no CDN caches a POST.** Not Vercel's, not any other. A POST
 * is treated as a state change by definition, so every keystroke-completed
 * search on the home page reached the origin, spent an invocation, and spent
 * a TMDB round trip, even when the person before had searched the same word a
 * second earlier.
 *
 * As a GET it can be cached, and the cache key is the URL, so "Interstellar"
 * is fetched once and served from the edge to everyone who types it next.
 * There is nothing to weigh here: the same response, produced the same way,
 * for a fraction of the requests.
 *
 * Half an hour, matching `/api/search`. A TMDB search for a given string
 * returns the same films all day.
 *
 * ── Two smaller things fixed on the way past ─────────────────────────────
 *
 * `media_type` was interpolated straight into the upstream path. The values
 * come from a `<select>`, so this was never exploited, but "the client only
 * ever sends good values" is not a property this file can check and is not
 * one worth relying on when the fix is a four-element set. Anything else now
 * gets a 400 here instead of a 404 from TMDB — and, more to the point, an
 * arbitrary path can no longer be used to mint unbounded distinct cache
 * entries.
 *
 * The upstream-failure branch returned a bare `NextResponse.json`, which has
 * no `Cache-Control` at all. `jsonError` sets `no-store`, which is what a
 * failure needs: a cached 502 is served to everyone who asks next.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const query = (searchParams.get("query") ?? "").trim();
    const page = Number(searchParams.get("page")) || 1;
    const mediaType = searchParams.get("media_type") ?? "multi";

    if (!query) {
      return jsonError("Query parameter is required", 400);
    }

    if (!ALLOWED_MEDIA_TYPES.has(mediaType)) {
      return jsonError("Unsupported media_type", 400);
    }

    if (!process.env.TMDB_API_KEY) {
      return jsonError("TMDB_API_KEY is missing on the server.", 500);
    }

    const url = `https://api.themoviedb.org/3/search/${mediaType}?api_key=${
      process.env.TMDB_API_KEY
    }&query=${encodeURIComponent(query)}&page=${page}`;

    // `fetchTmdb` defaults to `no-store` when no revalidate is given, so this
    // call was re-hitting TMDB even for a repeat of the identical search. The
    // half hour matches the CDN window below: there is no sense caching the
    // response at the edge for thirty minutes while re-fetching its contents
    // on every miss.
    const response = await fetchTmdb(url, { revalidate: 1800 });

    if (!response.ok) {
      return jsonError(
        `TMDB API request failed (${response.status} ${response.statusText})`,
        502
      );
    }

    const data = await response.json();

    return jsonSuccess(
      {
        results: data.results,
        total_pages: data.total_pages,
        total_results: data.total_results,
        page: data.page,
      },
      { maxAge: 1800, staleWhileRevalidate: 600 }
    );
  } catch (error) {
    console.error("Error in search API:", error);
    return jsonError("An error occurred while fetching data", 500);
  }
}
