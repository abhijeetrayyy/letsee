import { NextRequest } from "next/server";
import { serverFetchJson } from "@/utils/serverFetch";
import { jsonSuccess, jsonError } from "@/utils/apiResponse";
import { rankBecause, type BecauseCandidate, type BecauseItem } from "@/utils/title/because";

/**
 * "Because you love …": titles to watch next from one favourite.
 *
 * TMDB's own `recommendations` list, taken alone, was strange company — for a
 * 2010 Bombay crime film it offered 1940s Hollywood noir. So the favourite is
 * read once with both of TMDB's lists appended, and the two are ranked
 * together against it (`rankBecause`): its language, its era, its genres, and
 * whether anyone has heard of the candidate.
 *
 * The answer depends on the title and nothing else — never on who asks — so it
 * is cached at the edge like the collection route: the first person whose
 * favourite is Past Lives pays one invocation, everyone after reads the CDN.
 * Home chooses which favourite to ask about, and drops what the reader already
 * has, in the browser.
 */
type TmdbResult = BecauseCandidate & { adult?: boolean };
type TmdbTitle = {
  original_language?: string | null;
  release_date?: string | null;
  first_air_date?: string | null;
  genres?: { id: number }[];
  recommendations?: { results?: TmdbResult[] };
  similar?: { results?: TmdbResult[] };
};

export async function GET(request: NextRequest) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return jsonError("TMDB API key is missing on the server.", 500);

  const params = new URL(request.url).searchParams;
  const type = params.get("type");
  const id = params.get("id");
  if ((type !== "movie" && type !== "tv") || !id || !/^\d+$/.test(id)) {
    return jsonError("Missing or invalid title.", 400);
  }

  let data: TmdbTitle;
  try {
    data = await serverFetchJson(`https://api.themoviedb.org/3/${type}/${id}?api_key=${apiKey}&append_to_response=recommendations,similar`, { timeoutMs: 8000 });
  } catch (err) {
    return jsonError((err as Error).message ?? "Failed to fetch recommendations.", 502);
  }

  const items: BecauseItem[] = rankBecause(
    {
      id: Number(id),
      language: data.original_language ?? null,
      year: Number((data.release_date ?? data.first_air_date ?? "").slice(0, 4)) || null,
      genreIds: (data.genres ?? []).map((g) => g.id),
    },
    (data.recommendations?.results ?? []).filter((r) => !r.adult),
    (data.similar?.results ?? []).filter((r) => !r.adult),
    type,
  );

  // A day at the edge, a week stale: recommendations drift slowly.
  return jsonSuccess({ items }, { maxAge: 86400, staleWhileRevalidate: 604800 });
}
