import { NextRequest, NextResponse } from "next/server";
import { fetchTmdb } from "@/utils/tmdbClient";

export async function POST(request: NextRequest) {
  try {
    const {
      query,
      media_type,
      page,
      include_adult,
      language,
      year,
      genre,
      keyword,
      watch_region,
      watch_providers,
    } = await request.json();

    const hasDiscoverFilters = Boolean(
      (typeof year === "string" && year.trim()) ||
      (typeof genre === "string" && genre.trim()) ||
      (typeof keyword === "string" && keyword.trim()) ||
      (typeof watch_providers === "string" && String(watch_providers).trim())
    );
    const mediaIsMovieOrTvOrMulti =
      media_type === "movie" || media_type === "tv" || media_type === "multi";
    if (!query && !(hasDiscoverFilters && mediaIsMovieOrTvOrMulti)) {
      return NextResponse.json(
        { error: "Search query is required" },
        { status: 400 }
      );
    }

    if (!process.env.TMDB_API_KEY) {
      return NextResponse.json(
        { error: "TMDB_API_KEY is missing on the server." },
        { status: 500 }
      );
    }

    const normalizedMediaType =
      media_type === "movie" ||
      media_type === "tv" ||
      media_type === "person" ||
      media_type === "keyword"
        ? media_type
        : "multi";
    const safePage = Number(page) || 1;
    const includeAdult = include_adult === true;
    const lang = typeof language === "string" && language.trim() ? language.trim() : "en-US";
    const isKeywordId = /^\d+$/.test(String(query));
    const yearVal = typeof year === "string" ? year.trim() : "";
    const genreVal = typeof genre === "string" ? genre.trim() : "";
    const keywordVal = typeof keyword === "string" ? keyword.trim() : "";
    const regionVal = typeof watch_region === "string" && watch_region.trim() ? watch_region.trim() : "US";
    const providersVal = typeof watch_providers === "string" ? watch_providers.trim() : "";

    const useDiscover =
      (normalizedMediaType === "movie" ||
        normalizedMediaType === "tv" ||
        normalizedMediaType === "multi") &&
      (yearVal !== "" || genreVal !== "" || keywordVal !== "" || providersVal !== "");

    const useDiscoverMulti =
      useDiscover && normalizedMediaType === "multi";

    let url: URL;

    const appendDiscoverParams = (target: URL, type: "movie" | "tv") => {
      target.searchParams.append("api_key", process.env.TMDB_API_KEY || "");
      target.searchParams.append("page", safePage.toString());
      target.searchParams.append("language", lang);
      target.searchParams.append("include_adult", includeAdult ? "true" : "false");
      target.searchParams.append("sort_by", "popularity.desc");
      if (yearVal) {
        if (type === "movie") {
          target.searchParams.append("primary_release_year", yearVal);
        } else {
          target.searchParams.append("first_air_date_year", yearVal);
        }
      }
      if (genreVal) {
        target.searchParams.append("with_genres", genreVal);
      }
      if (keywordVal) {
        target.searchParams.append("with_keywords", keywordVal);
      }
      if (lang && lang !== "en-US") {
        const isoLang = lang.split("-")[0];
        if (isoLang) target.searchParams.append("with_original_language", isoLang);
      }
      if (providersVal) {
        target.searchParams.append("watch_region", regionVal);
        target.searchParams.append("with_watch_providers", providersVal);
      }
      if (isKeywordId && String(query).trim()) {
        target.searchParams.append("with_keywords", String(query));
      }
    };

    if (useDiscoverMulti) {
      // Fetch discover/movie and discover/tv in parallel, merge results (10 + 10 per page)
      const urlMovie = new URL("https://api.themoviedb.org/3/discover/movie");
      const urlTv = new URL("https://api.themoviedb.org/3/discover/tv");
      appendDiscoverParams(urlMovie, "movie");
      appendDiscoverParams(urlTv, "tv");

      const [resMovie, resTv] = await Promise.all([
        fetchTmdb(urlMovie.toString()),
        fetchTmdb(urlTv.toString()),
      ]);

      if (!resMovie.ok || !resTv.ok) {
        const failed = !resMovie.ok ? "movie" : "tv";
        let upstreamMessage = "";
        try {
          const payload = await (!resMovie.ok ? resMovie : resTv).json();
          upstreamMessage = payload?.status_message || payload?.error || "";
        } catch {
          upstreamMessage = "";
        }
        return NextResponse.json(
          {
            error: `TMDB discover (${failed}) failed.`,
            upstream_status: !resMovie.ok ? resMovie.status : resTv.status,
            upstream_message: upstreamMessage,
          },
          { status: 502 }
        );
      }

      const dataMovie = await resMovie.json();
      const dataTv = await resTv.json();
      const resultsMovie = (dataMovie.results ?? []).map((item: Record<string, unknown>) => ({
        ...item,
        media_type: "movie" as const,
      }));
      const resultsTv = (dataTv.results ?? []).map((item: Record<string, unknown>) => ({
        ...item,
        media_type: "tv" as const,
      }));
      // Interleave: 10 movie, 10 tv per page for variety
      const merged: Record<string, unknown>[] = [];
      const perType = 10;
      for (let i = 0; i < perType; i += 1) {
        if (resultsMovie[i]) merged.push(resultsMovie[i]);
        if (resultsTv[i]) merged.push(resultsTv[i]);
      }
      const totalMovie = dataMovie.total_results ?? 0;
      const totalTv = dataTv.total_results ?? 0;
      const totalPagesMovie = dataMovie.total_pages ?? 1;
      const totalPagesTv = dataTv.total_pages ?? 1;
      const totalPages = Math.max(totalPagesMovie, totalPagesTv);

      return NextResponse.json(
        {
          results: merged,
          total_pages: totalPages,
          total_results: totalMovie + totalTv,
        },
        { status: 200 }
      );
    }

    if (useDiscover) {
      const endpoint = normalizedMediaType === "movie" ? "discover/movie" : "discover/tv";
      url = new URL(`https://api.themoviedb.org/3/${endpoint}`);
      appendDiscoverParams(url, normalizedMediaType as "movie" | "tv");
    } else if (normalizedMediaType === "keyword" && isKeywordId) {
      url = new URL("https://api.themoviedb.org/3/discover/movie");
      url.searchParams.append("with_keywords", String(query));
      url.searchParams.append("api_key", process.env.TMDB_API_KEY || "");
      url.searchParams.append("page", safePage.toString());
      url.searchParams.append("include_adult", includeAdult ? "true" : "false");
      url.searchParams.append("language", lang);
    } else if (normalizedMediaType === "keyword") {
      url = new URL("https://api.themoviedb.org/3/search/keyword");
      url.searchParams.append("query", String(query));
      url.searchParams.append("api_key", process.env.TMDB_API_KEY || "");
      url.searchParams.append("page", safePage.toString());
      url.searchParams.append("language", lang);
      url.searchParams.append("include_adult", includeAdult ? "true" : "false");
    } else {
      let endpoint = "multi";
      if (normalizedMediaType === "movie") endpoint = "movie";
      else if (normalizedMediaType === "tv") endpoint = "tv";
      else if (normalizedMediaType === "person") endpoint = "person";
      url = new URL(`https://api.themoviedb.org/3/search/${endpoint}`);
      url.searchParams.append("query", String(query));
      url.searchParams.append("api_key", process.env.TMDB_API_KEY || "");
      url.searchParams.append("page", safePage.toString());
      url.searchParams.append("include_adult", includeAdult ? "true" : "false");
      url.searchParams.append("language", lang);
    }

    const response = await fetchTmdb(url.toString(), {
      timeoutMs: 10000,
      maxAttempts: 3,
    });

    if (!response.ok) {
      let upstreamMessage = "";
      try {
        const payload = await response.json();
        upstreamMessage = payload?.status_message || payload?.error || "";
      } catch {
        upstreamMessage = "";
      }
      return NextResponse.json(
        {
          error: "TMDB API request failed.",
          upstream_status: response.status,
          upstream_message: upstreamMessage || response.statusText,
        },
        { status: 502 }
      );
    }

    const data = await response.json();
    let results = data.results ?? [];

    if (useDiscover) {
      results = results.map((item: Record<string, unknown>) => ({
        ...item,
        media_type: normalizedMediaType,
      }));
    } else if (normalizedMediaType === "keyword" && !isKeywordId) {
      results = results.map((item: Record<string, unknown>) => ({ ...item, media_type: "keyword" }));
    } else if (normalizedMediaType === "keyword" && isKeywordId) {
      results = results.map((item: Record<string, unknown>) => ({ ...item, media_type: "movie" }));
    } else if (normalizedMediaType !== "multi") {
      results = results.map((item: Record<string, unknown>) => ({ ...item, media_type: normalizedMediaType }));
    }

    return NextResponse.json(
      {
        results,
        total_pages: data.total_pages ?? 1,
        total_results: data.total_results ?? 0,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Search API Error:", error);
    return NextResponse.json(
      {
        error: "Search service is unavailable.",
        details: (error as Error).message ?? "An error occurred while fetching data",
      },
      { status: 500 }
    );
  }
}
