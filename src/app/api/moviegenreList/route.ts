import axios from "axios";
import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "TMDB_API_KEY is missing on the server." },
      { status: 500 }
    );
  }

  try {
    const response = await axios.get(
      "https://api.themoviedb.org/3/genre/movie/list",
      { params: { api_key: apiKey } }
    );
    return NextResponse.json(response.data.genres, { status: 200 });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      return NextResponse.json(
        {
          error: "TMDB request failed.",
          upstream_status: error.response?.status,
          upstream_message: error.response?.statusText,
        },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: "Error fetching genres" },
      { status: 500 }
    );
  }
}

