import axios from "axios";
import { NextRequest, NextResponse } from "next/server";
 
export async function POST(req: NextRequest) {
  const requestClone = req.clone();
  const body = await requestClone.json();
  const genreId = body.genre;

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "TMDB_API_KEY is missing on the server." },
      { status: 500 }
    );
  }

  try {
    const response = await axios.get(
      `https://api.themoviedb.org/3/discover/movie`,
      { params: { api_key: apiKey, with_genres: genreId.id } }
    );

    return NextResponse.json(response.data.results, { status: 200 });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      return NextResponse.json(
        {
          error: "TMDB movie request failed.",
          upstream_status: error.response?.status,
          upstream_message: error.response?.statusText,
        },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}