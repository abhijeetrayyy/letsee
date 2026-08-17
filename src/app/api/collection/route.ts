import { NextRequest } from "next/server";
import { serverFetchJson } from "@/utils/serverFetch";
import { jsonSuccess, jsonError } from "@/utils/apiResponse";

/**
 * The films in a collection, in the order they were released.
 *
 * A route rather than a server fetch on the movie page, for two measured
 * reasons. `/collection/{id}` is its own resource — it is not an
 * append_to_response key, so it cannot ride along on the call the page already
 * makes, and fetching it there would put a serial TMDB round trip (120ms of
 * throttle slot before the request even leaves) in front of every movie page's
 * first byte. Measured across 80 popular and top-rated films, only 40% belong
 * to a collection at all, so 60% of pages would pay that for nothing. Fetching
 * from the client means the other 60% never make the call and the 40% that do
 * make it after the page has painted.
 *
 * Sorting happens here because TMDB does not do it: of ten well-known
 * collections checked live, FIVE came back out of order — Star Wars puts
 * Episode VIII after IX, Harry Potter interleaves 4/5 with 6/7, and The Fast
 * and the Furious returns its eleven films in near-random order. A strip that
 * claims to be a release order has to actually be one, and doing it once on
 * the server keeps every caller from having to remember.
 */

type TmdbPart = {
  id?: number;
  title?: string;
  poster_path?: string | null;
  release_date?: string | null;
  vote_average?: number | null;
  overview?: string | null;
};

type TmdbCollection = {
  id?: number;
  name?: string;
  overview?: string | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  parts?: TmdbPart[];
};

export type CollectionPart = {
  id: number;
  title: string;
  posterPath: string | null;
  releaseDate: string | null;
  voteAverage: number | null;
};

export type CollectionResponse = {
  id: number;
  name: string;
  overview: string | null;
  posterPath: string | null;
  parts: CollectionPart[];
};

export async function GET(request: NextRequest) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return jsonError("TMDB API key is missing on the server.", 500);
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^\d+$/.test(id)) {
    return jsonError("Missing or invalid collection id.", 400);
  }

  let data: TmdbCollection;
  try {
    data = await serverFetchJson<TmdbCollection>(
      `https://api.themoviedb.org/3/collection/${id}?api_key=${apiKey}`,
      { timeoutMs: 8000 },
    );
  } catch (err) {
    return jsonError((err as Error).message ?? "Failed to fetch collection.", 502);
  }

  const parts: CollectionPart[] = (data.parts ?? [])
    .filter((p): p is TmdbPart & { id: number } => typeof p.id === "number")
    .map((p) => ({
      id: p.id,
      title: p.title?.trim() || "Untitled",
      posterPath: p.poster_path ?? null,
      // Dates arrive as bare `YYYY-MM-DD` here, unlike the release_dates
      // endpoint's full timestamps. Kept as the raw string so the client parses
      // it the same way it parses every other TMDB date.
      releaseDate: p.release_date?.slice(0, 10) || null,
      voteAverage: typeof p.vote_average === "number" ? p.vote_average : null,
    }))
    .sort((a, b) => {
      // Undated films are announced-but-unscheduled sequels. They belong at the
      // end of the run, not sorted into 1970 by an empty string comparison.
      if (!a.releaseDate && !b.releaseDate) return a.title.localeCompare(b.title);
      if (!a.releaseDate) return 1;
      if (!b.releaseDate) return -1;
      return a.releaseDate.localeCompare(b.releaseDate);
    });

  return jsonSuccess<CollectionResponse>(
    {
      id: data.id ?? Number(id),
      name: data.name?.trim() || "Collection",
      overview: data.overview?.trim() || null,
      posterPath: data.poster_path ?? null,
      parts,
    },
    // Identical for every visitor and effectively static — a collection gains a
    // film every few years — so this is one of the few routes that genuinely
    // belongs in a shared cache.
    { maxAge: 86400 },
  );
}
