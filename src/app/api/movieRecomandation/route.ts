import { NextRequest, NextResponse } from "next/server";
import { fetchTmdb } from "@/utils/tmdbClient";

export async function POST(req: NextRequest) {
  const requestClone = req.clone();
  const body = await requestClone.json();
  const { id } = body;

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "TMDB_API_KEY is missing on the server." },
      { status: 500 }
    );
  }

  try {
    const url = `https://api.themoviedb.org/3/movie/${id}/recommendations?api_key=${apiKey}&language=en-US&page=1`;
    const response = await fetchTmdb(url);
    if (!response.ok) {
      return NextResponse.json(
        {
          error: "TMDB recommendation request failed.",
          upstream_status: response.status,
          upstream_message: response.statusText,
        },
        { status: 502 }
      );
    }
    const data = await response.json();
    return NextResponse.json(data.results ?? [], { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Unexpected server error.", details: (error as Error).message },
      { status: 500 }
    );
  }
}
