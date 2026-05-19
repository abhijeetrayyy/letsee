import { serverFetchJson } from "@/utils/serverFetch";
import { GenreList } from "@/staticData/genreList";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TMDB_BASE = "https://api.themoviedb.org/3";

type ParsedQuery = {
  genres: number[];
  yearGte: number | null;
  yearLte: number | null;
  actorId: number | null;
  similarToId: number | null;
  keywords: string[];
  mediaType: "movie" | "tv";
  sortBy: string;
};

const genreNameToId = new Map<string, number>();
const genreAliases: Record<string, string> = {
  "sci-fi": "Science Fiction",
  "scifi": "Science Fiction",
  "sci fi": "Science Fiction",
  "action-adventure": "Action & Adventure",
  "action adventure": "Action & Adventure",
  "rom-com": "Romance",
  "romcom": "Romance",
};

for (const g of GenreList.genres) {
  genreNameToId.set(g.name.toLowerCase(), g.id);
}

function findGenreId(token: string): number | null {
  const lower = token.toLowerCase();
  const alias = genreAliases[lower];
  if (alias) return genreNameToId.get(alias.toLowerCase()) ?? null;
  return genreNameToId.get(lower) ?? null;
}

function extractYear(token: string): { gte: number | null; lte: number | null } {
  const decadeMatch = token.match(/^(\d{4})s$/);
  if (decadeMatch) {
    const start = parseInt(decadeMatch[1]);
    return { gte: start, lte: start + 9 };
  }

  const yearMatch = token.match(/^\d{4}$/);
  if (yearMatch) return { gte: parseInt(yearMatch[0]), lte: parseInt(yearMatch[0]) };

  return { gte: null, lte: null };
}

function findActorId(results: { id: number; name: string; known_for_department?: string }[], name: string): number | null {
  const lower = name.toLowerCase();
  const matches = results.filter(
    (p) => p.name.toLowerCase().includes(lower) && (!p.known_for_department || p.known_for_department === "Acting")
  );
  return matches.length > 0 ? matches[0].id : null;
}

async function findSimilarMovie(title: string): Promise<number | null> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;

  const searchUrl = `${TMDB_BASE}/search/movie?api_key=${apiKey}&query=${encodeURIComponent(title)}&language=en-US&page=1`;
  try {
    const data = await serverFetchJson<{ results?: { id: number; title?: string }[] }>(searchUrl);
    return data.results?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function searchActor(name: string): Promise<number | null> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;

  const searchUrl = `${TMDB_BASE}/search/person?api_key=${apiKey}&query=${encodeURIComponent(name)}&language=en-US&page=1`;
  try {
    const data = await serverFetchJson<{ results?: { id: number; name: string; known_for_department?: string }[] }>(searchUrl);
    return findActorId(data.results ?? [], name);
  } catch {
    return null;
  }
}

function parseQuery(query: string): Promise<ParsedQuery> {
  return (async () => {
    const tokens = query.split(/\s+/);
    const result: ParsedQuery = {
      genres: [],
      yearGte: null,
      yearLte: null,
      actorId: null,
      similarToId: null,
      keywords: [],
      mediaType: "movie",
      sortBy: "popularity.desc",
    };

    const joinIndices: number[] = [];
    const processedTokens = new Set<number>();

    for (let i = 0; i < tokens.length; i++) {
      if (processedTokens.has(i)) continue;

      const token = tokens[i].toLowerCase().replace(/[^a-z0-9&\-]/g, "");

      if (token === "tv" || token === "show" || token === "series") {
        result.mediaType = "tv";
        processedTokens.add(i);
        continue;
      }

      if (token === "movie" || token === "film") {
        result.mediaType = "movie";
        processedTokens.add(i);
        continue;
      }

      const genreId = findGenreId(token);
      if (genreId !== null) {
        result.genres.push(genreId);
        processedTokens.add(i);
        continue;
      }

      const year = extractYear(token);
      if (year.gte !== null || year.lte !== null) {
        result.yearGte = year.gte;
        result.yearLte = year.lte;
        processedTokens.add(i);
        continue;
      }

      if (token === "from" && i + 1 < tokens.length) {
        const nextYear = extractYear(tokens[i + 1].replace(/[^0-9s]/g, ""));
        if (nextYear.gte !== null) {
          result.yearGte = nextYear.gte;
          processedTokens.add(i);
          processedTokens.add(i + 1);
          continue;
        }
      }

      if ((token === "before" || token === "pre") && i + 1 < tokens.length) {
        const yearMatch = tokens[i + 1].match(/\d{4}/);
        if (yearMatch) {
          result.yearLte = parseInt(yearMatch[0]) - 1;
          processedTokens.add(i);
          processedTokens.add(i + 1);
          continue;
        }
      }

      if ((token === "after" || token === "post") && i + 1 < tokens.length) {
        const yearMatch = tokens[i + 1].match(/\d{4}/);
        if (yearMatch) {
          result.yearGte = parseInt(yearMatch[0]) + 1;
          processedTokens.add(i);
          processedTokens.add(i + 1);
          continue;
        }
      }

      if (token === "similar" || token === "like") {
        let likeIdx = i;
        if (token === "similar" && i + 1 < tokens.length && tokens[i + 1].toLowerCase() === "to") likeIdx = i + 1;

        if (likeIdx + 1 < tokens.length) {
          const title = tokens.slice(likeIdx + 1).join(" ");
          const movieId = await findSimilarMovie(title);
          if (movieId !== null) {
            result.similarToId = movieId;
            for (let j = i; j < tokens.length; j++) processedTokens.add(j);
          }
        }
        break;
      }

      if (token === "with" && i + 1 < tokens.length) {
        const actorName = tokens.slice(i + 1).join(" ");
        const actorId = await searchActor(actorName);
        if (actorId !== null) {
          result.actorId = actorId;
          for (let j = i; j < tokens.length; j++) processedTokens.add(j);
        }
        break;
      }

      if (!joinIndices.includes(i)) {
        result.keywords.push(token);
      }
    }

    if (result.similarToId && result.sortBy === "popularity.desc") {
      result.sortBy = "vote_average.desc";
    }

    return result;
  })();
}

function buildTmdbUrl(parsed: ParsedQuery): string {
  const apiKey = process.env.TMDB_API_KEY;
  const endpoint = parsed.mediaType === "movie" ? "discover/movie" : "discover/tv";
  const params = new URLSearchParams({
    api_key: apiKey ?? "",
    language: "en-US",
    sort_by: parsed.sortBy,
    "vote_count.gte": "50",
  });

  if (parsed.genres.length > 0) {
    params.set("with_genres", parsed.genres.join(","));
  }

  if (parsed.yearGte !== null) {
    const key = parsed.mediaType === "movie" ? "primary_release_date.gte" : "first_air_date.gte";
    params.set(key, `${parsed.yearGte}-01-01`);
  }
  if (parsed.yearLte !== null) {
    const key = parsed.mediaType === "movie" ? "primary_release_date.lte" : "first_air_date.lte";
    params.set(key, `${parsed.yearLte}-12-31`);
  }

  if (parsed.actorId !== null) {
    params.set("with_cast", String(parsed.actorId));
  }

  if (parsed.similarToId !== null) {
    return `${TMDB_BASE}/movie/${parsed.similarToId}/recommendations?api_key=${apiKey}&language=en-US&page=1`;
  }

  if (parsed.keywords.length > 0) {
    params.set("with_keywords", parsed.keywords.join(","));
  }

  return `${TMDB_BASE}/${endpoint}?${params.toString()}`;
}

function getDisplayFilters(parsed: ParsedQuery): Record<string, string>[] {
  const filters: Record<string, string>[] = [];

  const genreNames = parsed.genres
    .map((id) => GenreList.genres.find((g: { id: number }) => g.id === id))
    .filter(Boolean)
    .map((g: any) => g.name);

  if (genreNames.length > 0) filters.push({ label: "Genres", value: genreNames.join(", ") });
  if (parsed.yearGte !== null && parsed.yearLte !== null) filters.push({ label: "Years", value: `${parsed.yearGte}-${parsed.yearLte}` });
  else if (parsed.yearGte !== null) filters.push({ label: "From", value: String(parsed.yearGte) });
  else if (parsed.yearLte !== null) filters.push({ label: "Before", value: String(parsed.yearLte) });
  if (parsed.actorId !== null) filters.push({ label: "Cast", value: `Actor #${parsed.actorId}` });
  if (parsed.similarToId !== null) filters.push({ label: "Similar to", value: `Movie #${parsed.similarToId}` });
  if (parsed.mediaType === "tv") filters.push({ label: "Type", value: "TV Shows" });

  return filters;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 });
  }

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "TMDB_API_KEY missing" }, { status: 500 });
  }

  try {
    const parsed = await parseQuery(query);
    const tmdbUrl = buildTmdbUrl(parsed);

    let rawResults: { results?: any[] } = { results: [] };
    if (parsed.similarToId !== null || parsed.genres.length > 0 || parsed.actorId !== null || parsed.yearGte !== null) {
      try {
        rawResults = await serverFetchJson<{ results?: any[] }>(tmdbUrl);
      } catch {
        rawResults = { results: [] };
      }
    }

    let results = rawResults.results ?? [];

    if (results.length === 0 && parsed.genres.length === 0 && parsed.actorId === null) {
      const searchEndpoint = parsed.mediaType === "movie" ? "search/movie" : "search/tv";
      const searchUrl = `${TMDB_BASE}/${searchEndpoint}?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=en-US&page=1`;
      try {
        const searchData = await serverFetchJson<{ results?: any[] }>(searchUrl);
        results = searchData.results ?? [];
      } catch {
        results = [];
      }
    }

    const items = results.slice(0, 20).map((item: any) => ({
      id: String(item.id),
      title: item.title ?? item.name ?? "Unknown",
      type: parsed.mediaType,
      posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
      year: (item.release_date ?? item.first_air_date ?? "").substring(0, 4),
      overview: item.overview ?? "",
      voteAverage: item.vote_average ?? 0,
    }));

    return NextResponse.json({
      query,
      parsed: {
        mediaType: parsed.mediaType,
        genres: parsed.genres,
        yearRange: parsed.yearGte !== null || parsed.yearLte !== null ? `${parsed.yearGte ?? ""}-${parsed.yearLte ?? ""}` : null,
        hasActor: parsed.actorId !== null,
        isSimilar: parsed.similarToId !== null,
      },
      filters: getDisplayFilters(parsed),
      items,
      total: items.length,
    });
  } catch (err) {
    console.error("Natural search error:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
