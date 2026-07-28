import { NextRequest, NextResponse } from "next/server";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";

export async function GET(request: NextRequest) {
  const apiKey = process.env.OMDB_API_KEY;
  const { searchParams } = new URL(request.url);
  const imdbId = searchParams.get("i");
  const title = searchParams.get("t");

  if (!apiKey) {
    return jsonError("OMDB_API_KEY is missing on the server.", 500);
  }

  if (!imdbId && !title) {
    return jsonError("Missing OMDB query (i or t).", 400);
  }

  const url = new URL("https://www.omdbapi.com/");
  if (imdbId) {
    url.searchParams.set("i", imdbId);
  }
  if (title) {
    url.searchParams.set("t", title);
  }
  url.searchParams.set("apikey", apiKey);

  try {
    const response = await fetch(url.toString(), { cache: "no-store" });
    if (!response.ok) {
      return NextResponse.json(
        {
          error: "OMDb request failed.",
          upstream_status: response.status,
          upstream_message: response.statusText,
        },
        { status: 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "OMDb service unavailable.",
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
