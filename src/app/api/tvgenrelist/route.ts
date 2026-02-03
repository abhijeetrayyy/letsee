import { NextResponse } from "next/server";
import { fetchTmdb } from "@/utils/tmdbClient";

export async function GET() {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "TMDB_API_KEY is missing on the server." },
      { status: 500 }
    );
  }

  try {
    const response = await fetchTmdb(
      `https://api.themoviedb.org/3/genre/tv/list?api_key=${apiKey}`,
      { revalidate: 86400 }
    );
    if (!response.ok) {
      return NextResponse.json(
        {
          error: "TMDB request failed.",
          upstream_status: response.status,
          upstream_message: response.statusText,
        },
        { status: 502 }
      );
    }
    const data = await response.json();
    return NextResponse.json(data.genres ?? [], { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Error fetching genres", details: (error as Error).message },
      { status: 500 }
    );
  }
}
