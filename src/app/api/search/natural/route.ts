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
  directorId: number | null;
  similarToId: number | null;
  keywords: string[];
  mediaType: "movie" | "tv";
  minRating: number | null;
  language: string | null;
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
  "romantic comedy": "Romance",
  "buddy comedy": "Comedy",
  "dark comedy": "Comedy",
  "superhero": "Action",
  "super hero": "Action",
};

for (const g of GenreList.genres) {
  genreNameToId.set(g.name.toLowerCase(), g.id);
}

function findGenreId(token: string): number | null {
  const lower = token.toLowerCase();
  const alias = genreAliases[lower];
  if (alias) return genreNameToId.get(alias.toLowerCase()) ?? null;
  if (genreNameToId.has(lower)) return genreNameToId.get(lower)!;
  // Try partial match
  for (const [name, id] of genreNameToId) {
    if (name.includes(lower) || lower.includes(name)) return id;
  }
  return null;
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

function extractRating(token: string): number | null {
  const match = token.match(/^(\d+)[+%]/);
  if (match) return Math.min(10, Math.max(1, parseInt(match[1])));
  if (token === "highly-rated" || token === "top-rated" || token === "best") return 7;
  if (token === "critically-acclaimed" || token === "critically acclaimed" || token === "acclaimed") return 7.5;
  return null;
}

function extractLanguage(token: string): string | null {
  const langMap: Record<string, string> = {
    french: "fr", spanish: "es", german: "de",
    italian: "it", korean: "ko", japanese: "ja",
    hindi: "hi", chinese: "zh", mandarin: "zh",
    russian: "ru", portuguese: "pt",
  };
  return langMap[token.toLowerCase()] ?? null;
}

function findActorOrDirector(
  results: { id: number; name: string; known_for_department?: string }[],
  name: string,
  dept?: string,
): number | null {
  const lower = name.toLowerCase();
  const matches = results.filter(
    (p) =>
      p.name.toLowerCase().includes(lower) &&
      (!dept || p.known_for_department === dept),
  );
  return matches.length > 0 ? matches[0].id : null;
}

async function searchPerson(name: string, dept?: string): Promise<number | null> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;
  const url = `${TMDB_BASE}/search/person?api_key=${apiKey}&query=${encodeURIComponent(name)}&language=en-US&page=1`;
  try {
    const data = await serverFetchJson<{ results?: { id: number; name: string; known_for_department?: string }[] }>(url);
    return findActorOrDirector(data.results ?? [], name, dept);
  } catch {
    return null;
  }
}

async function findSimilarMovie(title: string): Promise<number | null> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;
  const url = `${TMDB_BASE}/search/movie?api_key=${apiKey}&query=${encodeURIComponent(title)}&language=en-US&page=1`;
  try {
    const data = await serverFetchJson<{ results?: { id: number }[] }>(url);
    return data.results?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

function parseQuery(query: string): Promise<ParsedQuery> {
  return (async () => {
    const tokens = query.split(/\s+/);
    const result: ParsedQuery = {
      genres: [], yearGte: null, yearLte: null,
      actorId: null, directorId: null, similarToId: null,
      keywords: [], mediaType: "movie", minRating: null,
      language: null, sortBy: "popularity.desc",
    };

    const processedTokens = new Set<number>();

    for (let i = 0; i < tokens.length; i++) {
      if (processedTokens.has(i)) continue;
      const token = tokens[i].toLowerCase().replace(/[^a-z0-9&\-+%]/g, "");

      // Media type
      if (["tv", "show", "series", "tv show", "tv series"].includes(token)) {
        result.mediaType = "tv"; processedTokens.add(i); continue;
      }
      if (["movie", "film", "movies", "films"].includes(token)) {
        result.mediaType = "movie"; processedTokens.add(i); continue;
      }

      // Rating
      const rating = extractRating(token);
      if (rating !== null) {
        result.minRating = rating;
        result.sortBy = "vote_average.desc";
        processedTokens.add(i); continue;
      }

      // Language
      const lang = extractLanguage(token);
      if (lang !== null) {
        result.language = lang; processedTokens.add(i); continue;
      }

      // Genre
      const genreId = findGenreId(token);
      if (genreId !== null) {
        result.genres.push(genreId); processedTokens.add(i); continue;
      }

      // Year patterns
      const year = extractYear(token);
      if (year.gte !== null || year.lte !== null) {
        result.yearGte = year.gte; result.yearLte = year.lte;
        processedTokens.add(i); continue;
      }

      // "from YEAR"
      if (token === "from" && i + 1 < tokens.length) {
        const next = extractYear(tokens[i + 1].replace(/[^0-9s]/g, ""));
        if (next.gte !== null) {
          result.yearGte = next.gte;
          processedTokens.add(i); processedTokens.add(i + 1); continue;
        }
      }

      // "before / pre YEAR"
      if ((token === "before" || token === "pre" || token === "prior") && i + 1 < tokens.length) {
        const m = tokens[i + 1].match(/\d{4}/);
        if (m) { result.yearLte = parseInt(m[0]) - 1; processedTokens.add(i); processedTokens.add(i + 1); continue; }
      }

      // "after / post YEAR"
      if ((token === "after" || token === "post" || token === "since") && i + 1 < tokens.length) {
        const m = tokens[i + 1].match(/\d{4}/);
        if (m) { result.yearGte = parseInt(m[0]) + 1; processedTokens.add(i); processedTokens.add(i + 1); continue; }
      }

      // "rated N+" or "score N+"
      if ((token === "rated" || token === "score" || token === "rating") && i + 1 < tokens.length) {
        const m = tokens[i + 1].match(/(\d+)[+%]/);
        if (m) { result.minRating = Math.min(10, parseInt(m[1])); result.sortBy = "vote_average.desc"; processedTokens.add(i); processedTokens.add(i + 1); continue; }
      }

      // "directed by NAME"
      if ((token === "directed" || token === "director") && i + 1 < tokens.length) {
        const dirIdx = token === "directed" && i + 2 < tokens.length && tokens[i + 1].toLowerCase() === "by" ? i + 2 : i + 1;
        const name = tokens.slice(dirIdx).join(" ");
        const id = await searchPerson(name, "Directing");
        if (id !== null) {
          result.directorId = id;
          for (let j = i; j < tokens.length; j++) processedTokens.add(j);
        }
        break;
      }

      // "similar to / like TITLE"
      if (token === "similar" || token === "like" || token === "recommended") {
        let start = i;
        if (token === "similar" && i + 1 < tokens.length && tokens[i + 1].toLowerCase() === "to") start = i + 1;
        if (start + 1 < tokens.length) {
          const title = tokens.slice(start + 1).join(" ");
          const movieId = await findSimilarMovie(title);
          if (movieId !== null) {
            result.similarToId = movieId;
            for (let j = i; j < tokens.length; j++) processedTokens.add(j);
          }
        }
        break;
      }

      // "with ACTOR"
      if ((token === "with" || token === "starring" || token === "featuring") && i + 1 < tokens.length) {
        const name = tokens.slice(i + 1).join(" ");
        const actorId = await searchPerson(name, "Acting");
        if (actorId !== null) {
          result.actorId = actorId;
          for (let j = i; j < tokens.length; j++) processedTokens.add(j);
        }
        break;
      }

      // "by DIRECTOR"
      if (token === "by" && i + 1 < tokens.length) {
        const name = tokens.slice(i + 1).join(" ");
        const dirId = await searchPerson(name, "Directing");
        if (dirId !== null) {
          result.directorId = dirId;
          for (let j = i; j < tokens.length; j++) processedTokens.add(j);
        }
        break;
      }

      result.keywords.push(token);
    }

    if (result.similarToId && result.sortBy === "popularity.desc") {
      result.sortBy = "vote_average.desc";
    }

    return result;
  })();
}

function buildTmdbUrl(parsed: ParsedQuery): string {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return "";

  if (parsed.similarToId !== null) {
    const ep = parsed.mediaType === "movie" ? "movie" : "tv";
    return `${TMDB_BASE}/${ep}/${parsed.similarToId}/recommendations?api_key=${apiKey}&language=en-US&page=1`;
  }

  const endpoint = parsed.mediaType === "movie" ? "discover/movie" : "discover/tv";
  const params = new URLSearchParams({
    api_key: apiKey, language: "en-US",
    sort_by: parsed.sortBy, "vote_count.gte": "50",
  });

  if (parsed.genres.length > 0) params.set("with_genres", [...new Set(parsed.genres)].join(","));
  if (parsed.minRating !== null) params.set("vote_average.gte", String(parsed.minRating));
  if (parsed.language !== null) {
    params.set("with_original_language", parsed.language);
  }

  if (parsed.yearGte !== null) {
    const key = parsed.mediaType === "movie" ? "primary_release_date.gte" : "first_air_date.gte";
    params.set(key, `${parsed.yearGte}-01-01`);
  }
  if (parsed.yearLte !== null) {
    const key = parsed.mediaType === "movie" ? "primary_release_date.lte" : "first_air_date.lte";
    params.set(key, `${parsed.yearLte}-12-31`);
  }

  if (parsed.actorId !== null) params.set("with_cast", String(parsed.actorId));
  if (parsed.directorId !== null) params.set("with_crew", String(parsed.directorId));
  if (parsed.keywords.length > 0) params.set("with_keywords", parsed.keywords.join(","));

  return `${TMDB_BASE}/${endpoint}?${params.toString()}`;
}

function interpretation(parsed: ParsedQuery): string[] {
  const parts: string[] = [];
  if (parsed.mediaType === "tv") parts.push("TV shows");
  const genres = parsed.genres
    .map((id) => GenreList.genres.find((g: { id: number }) => g.id === id))
    .filter(Boolean)
    .map((g: any) => g.name);
  if (genres.length > 0) parts.push(genres.join(", "));
  if (parsed.actorId !== null) parts.push("starring a specific actor");
  if (parsed.directorId !== null) parts.push("by a specific director");
  if (parsed.yearGte !== null && parsed.yearLte !== null) parts.push(`from ${parsed.yearGte}-${parsed.yearLte}`);
  else if (parsed.yearGte !== null) parts.push(`from ${parsed.yearGte}`);
  else if (parsed.yearLte !== null) parts.push(`before ${parsed.yearLte}`);
  if (parsed.minRating !== null) parts.push(`rated ${parsed.minRating}+`);
  if (parsed.language !== null) parts.push(`in ${parsed.language}`);
  if (parsed.similarToId !== null) parts.push("similar to a specific title");
  return parts;
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
    const interpreted = interpretation(parsed);
    const tmdbUrl = buildTmdbUrl(parsed);

    let items: any[] = [];
    let totalResults = 0;

    if (parsed.similarToId !== null || parsed.genres.length > 0 || parsed.actorId !== null || parsed.directorId !== null || parsed.yearGte !== null || parsed.minRating !== null || parsed.language !== null) {
      try {
        const data = await serverFetchJson<{ results?: any[]; total_results?: number }>(tmdbUrl);
        items = (data.results ?? []).slice(0, 20);
        totalResults = data.total_results ?? items.length;
      } catch { /* fall through */ }
    }

    if (items.length === 0 && parsed.genres.length === 0 && parsed.actorId === null && parsed.directorId === null) {
      const endpoint = parsed.mediaType === "movie" ? "search/movie" : "search/tv";
      const url = `${TMDB_BASE}/${endpoint}?api_key=${apiKey}&query=${encodeURIComponent(query)}&language=en-US&page=1`;
      try {
        const data = await serverFetchJson<{ results?: any[]; total_results?: number }>(url);
        items = (data.results ?? []).slice(0, 20);
        totalResults = data.total_results ?? items.length;
      } catch { items = []; }
    }

    const mapped = items.map((item: any) => ({
      id: String(item.id),
      title: item.title ?? item.name ?? "Unknown",
      mediaType: parsed.mediaType,
      posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : null,
      backdropUrl: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : null,
      year: (item.release_date ?? item.first_air_date ?? "").substring(0, 4),
      overview: item.overview ?? "",
      voteAverage: item.vote_average ?? 0,
      voteCount: item.vote_count ?? 0,
      genreIds: item.genre_ids ?? [],
    }));

    return NextResponse.json({
      query,
      interpretation: interpreted,
      parsed: {
        mediaType: parsed.mediaType,
        genres: parsed.genres,
        yearRange: parsed.yearGte !== null || parsed.yearLte !== null,
        hasActor: parsed.actorId !== null,
        hasDirector: parsed.directorId !== null,
        isSimilar: parsed.similarToId !== null,
        minRating: parsed.minRating,
        language: parsed.language,
      },
      items: mapped,
      total: totalResults,
      matched: mapped.length,
    });
  } catch (err) {
    console.error("Natural search error:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
