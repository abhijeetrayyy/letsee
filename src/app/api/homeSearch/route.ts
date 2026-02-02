import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { query, page, media_type } = await request.json();

    if (!query) {
      return NextResponse.json(
        { error: "Query parameter is required" },
        { status: 400 }
      );
    }

    if (!process.env.TMDB_API_KEY) {
      return NextResponse.json(
        { error: "TMDB_API_KEY is missing on the server." },
        { status: 500 }
      );
    }

    // Fetch data from TMDB API
    const url = `https://api.themoviedb.org/3/search/${media_type}?api_key=${
      process.env.TMDB_API_KEY
    }&query=${encodeURIComponent(query)}&page=${page || 1}`;

    const response = await fetch(url);

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "TMDB API request failed.",
          upstream_status: response.status,
          upstream_message: response.statusText,
        },
        { status: 502 }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      results: data.results,
      total_pages: data.total_pages,
      total_results: data.total_results,
      page: data.page,
    });
  } catch (error) {
    console.error("Error in search API:", error);
    return NextResponse.json(
      { error: "An error occurred while fetching data" },
      { status: 500 }
    );
  }
}
