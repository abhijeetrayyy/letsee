import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getAuthUserId } from "@/utils/apiAuth";
import { fetchTmdb } from "@/utils/tmdbClient";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

const TMDB_API_KEY = process.env.TMDB_API_KEY;

type Candidate = {
  id: string;
  itemType: "movie" | "tv";
  name: string;
  posterPath: string | null;
  year: string | null;
  voteAverage: number;
  genres: string[];
};

/**
 * GET /api/quick-add/feed?source=popular|top_rated|trending&type=movie|tv
 *                        &genre=28&decade=1990&page=1&query=...
 *
 * Candidates for the quick-add grid. Anything already on the viewer's lists is
 * filtered out server-side — the whole point is a wall of titles you can tick
 * without having to remember what you've already logged.
 */
export async function GET(req: NextRequest) {
  if (!TMDB_API_KEY) return jsonError("TMDB_API_KEY missing", 500);

  const userId = await getAuthUserId();
  if (!userId) return jsonError("Not authenticated", 401);

  const p = req.nextUrl.searchParams;
  const type = p.get("type") === "tv" ? "tv" : "movie";
  const source = p.get("source") ?? "popular";
  const page = Math.max(1, Math.min(500, Number(p.get("page") ?? 1)));
  const genre = p.get("genre");
  const decade = p.get("decade");
  const query = p.get("query")?.trim();

  let url: string;
  if (query) {
    url = `https://api.themoviedb.org/3/search/${type}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=${page}&include_adult=false`;
  } else if (source === "trending") {
    url = `https://api.themoviedb.org/3/trending/${type}/week?api_key=${TMDB_API_KEY}&page=${page}`;
  } else {
    // discover gives us genre and decade filters that /popular can't.
    const sort = source === "top_rated" ? "vote_average.desc" : "popularity.desc";
    const params = new URLSearchParams({
      api_key: TMDB_API_KEY,
      sort_by: sort,
      page: String(page),
      include_adult: "false",
      "vote_count.gte": source === "top_rated" ? "500" : "50",
    });
    if (genre) params.set("with_genres", genre);
    if (decade) {
      const start = Number(decade);
      const dateField = type === "tv" ? "first_air_date" : "primary_release_date";
      params.set(`${dateField}.gte`, `${start}-01-01`);
      params.set(`${dateField}.lte`, `${start + 9}-12-31`);
    }
    url = `https://api.themoviedb.org/3/discover/${type}?${params.toString()}`;
  }

  // TMDB drops connections often enough that an uncaught throw here turned
  // into a 500, which the grid rendered as "you've logged everything".
  let data: any;
  let supabase;
  try {
    const [res, client] = await Promise.all([fetchTmdb(url), createClient()]);
    if (!res.ok) return jsonError("TMDB request failed", 502);
    data = await res.json();
    supabase = client;
  } catch {
    return jsonError("Couldn't reach TMDB. Try again.", 502);
  }

  const results = Array.isArray(data?.results) ? data.results : [];

  // Skip anything already tracked or favourited.
  const [{ data: tracked }, { data: favs }] = await Promise.all([
    supabase.from("user_media_status").select("item_id").eq("user_id", userId),
    supabase.from("favorite_items").select("item_id").eq("user_id", userId),
  ]);
  const seen = new Set<string>([
    ...(tracked ?? []).map((r) => String(r.item_id)),
    ...(favs ?? []).map((r) => String(r.item_id)),
  ]);

  const genreMap = await getGenreMap(type);

  const items: Candidate[] = results
    .filter((r: any) => !seen.has(String(r.id)) && r.poster_path)
    .map((r: any) => {
      const date = type === "tv" ? r.first_air_date : r.release_date;
      return {
        id: String(r.id),
        itemType: type as "movie" | "tv",
        name: (type === "tv" ? r.name : r.title) ?? "Untitled",
        posterPath: r.poster_path ?? null,
        year: date ? String(date).slice(0, 4) : null,
        voteAverage: Number(r.vote_average ?? 0),
        genres: (r.genre_ids ?? [])
          .map((id: number) => genreMap.get(id))
          .filter(Boolean) as string[],
      };
    });

  return jsonSuccess(
    { items, page, totalPages: Math.min(Number(data?.total_pages ?? 1), 500) },
    { maxAge: 0 },
  );
}

const genreCache = new Map<string, Map<number, string>>();

async function getGenreMap(type: "movie" | "tv"): Promise<Map<number, string>> {
  const cached = genreCache.get(type);
  if (cached) return cached;
  const map = new Map<number, string>();
  try {
    const res = await fetchTmdb(
      `https://api.themoviedb.org/3/genre/${type}/list?api_key=${TMDB_API_KEY}`,
    );
    if (res.ok) {
      const json = await res.json();
      for (const g of json?.genres ?? []) map.set(Number(g.id), String(g.name));
    }
  } catch {
    // Genres are a nice-to-have here; an empty map is fine.
  }
  genreCache.set(type, map);
  return map;
}
