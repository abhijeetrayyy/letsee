import { NextResponse } from "next/server";
import { fetchTmdb } from "@/utils/tmdbClient";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

export async function POST(request: Request) {
  try {
    const { query, page, media_type } = await request.json();

    if (!query) {
      return jsonError("Query parameter is required", 400);
    }

    if (!process.env.TMDB_API_KEY) {
      return jsonError("TMDB_API_KEY is missing on the server.", 500);
    }

    const url = `https://api.themoviedb.org/3/search/${media_type}?api_key=${
      process.env.TMDB_API_KEY
    }&query=${encodeURIComponent(query)}&page=${page || 1}`;

    const response = await fetchTmdb(url);

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
    return jsonError("An error occurred while fetching data", 500);
  }
}
