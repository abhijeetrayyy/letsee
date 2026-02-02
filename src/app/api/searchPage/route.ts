import { NextRequest, NextResponse } from "next/server";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: NextRequest) {
  try {
    const { query, media_type, page, include_adult, language } =
      await request.json();

    if (!query) {
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
    const includeAdult = Boolean(include_adult);
    const lang = typeof language === "string" ? language : "en-US";
    const isKeywordId = /^\d+$/.test(String(query));

    let url: URL;
    if (normalizedMediaType === "keyword" && isKeywordId) {
      // Use /discover/movie for keyword id search
      url = new URL("https://api.themoviedb.org/3/discover/movie");
      url.searchParams.append("with_keywords", String(query));
    } else if (normalizedMediaType === "keyword") {
      // Use /search/keyword for keyword text search
      url = new URL("https://api.themoviedb.org/3/search/keyword");
      url.searchParams.append("query", String(query));
    } else {
      // Use /search/{endpoint} for other media types
      let endpoint = "multi";
      if (normalizedMediaType === "movie") endpoint = "movie";
      else if (normalizedMediaType === "tv") endpoint = "tv";
      else if (normalizedMediaType === "person") endpoint = "person";

      url = new URL(`https://api.themoviedb.org/3/search/${endpoint}`);
      url.searchParams.append("query", String(query));
    }

    url.searchParams.append("api_key", process.env.TMDB_API_KEY || "");
    url.searchParams.append("page", safePage.toString());
    url.searchParams.append("include_adult", includeAdult ? "true" : "false");
    url.searchParams.append("language", lang);

    const retryableStatus = new Set([429, 500, 502, 503, 504]);
    const maxAttempts = 2;
    let response: Response | null = null;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      try {
        response = await fetch(url.toString(), {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok && retryableStatus.has(response.status)) {
          if (attempt < maxAttempts) {
            await sleep(attempt * 500);
            continue;
          }
        }

        break;
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxAttempts) {
          await sleep(attempt * 500);
          continue;
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    if (!response) {
      return NextResponse.json(
        {
          error: "Search service is unavailable.",
          details: lastError?.message || "Fetch failed",
        },
        { status: 502 }
      );
    }

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

    // Normalize the response to match SearchResponse interface
    let results = data.results ?? [];
    if (normalizedMediaType === "keyword" && !isKeywordId) {
      results = results.map((item: any) => ({
        ...item,
        media_type: "keyword",
      }));
    } else if (normalizedMediaType === "keyword" && isKeywordId) {
      results = results.map((item: any) => ({
        ...item,
        media_type: "movie",
      }));
    } else if (normalizedMediaType !== "multi") {
      results = results.map((item: any) => ({
        ...item,
        media_type: normalizedMediaType,
      }));
    }

    const normalizedData = {
      results,
      total_pages: data.total_pages,
      total_results: data.total_results,
    };

    return NextResponse.json(normalizedData, { status: 200 });
  } catch (error) {
    console.error("Search API Error:", error);
    return NextResponse.json(
      {
        error: "Search service is unavailable.",
        details:
          (error as Error).message || "An error occurred while fetching data",
      },
      { status: 500 }
    );
  }
}
