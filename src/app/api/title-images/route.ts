import { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/utils/apiResponse";
import { fetchTmdbJson, tmdbConfigured } from "@/utils/tmdbClient";

import { guard } from "@/lib/limits/guard";
const TMDB = "https://api.themoviedb.org/3";

/**
 * GET /api/title-images?type=movie|tv&id= — the posters TMDB holds for a title.
 *
 * Letterboxd charges its Patron tier for choosing a poster. The images are
 * public TMDB data; the choice is the identity act. Identical for every
 * caller, so it is shared-cached for a day like the other TMDB proxies.
 */
type Image = { file_path: string; iso_639_1: string | null; vote_average: number; width: number; height: number };

export async function GET(req: NextRequest) {
  const limited = await guard("tmdb", req);
  if (limited) return limited;
  if (!tmdbConfigured()) return jsonError("TMDB is not configured", 500);

  const type = req.nextUrl.searchParams.get("type") === "tv" ? "tv" : "movie";
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!/^\d+$/.test(id)) return jsonError("id is required", 400);

  try {
    const data = await fetchTmdbJson<{ posters?: Image[] }>(
      `${TMDB}/${type}/${id}/images?include_image_language=en,null,hi,ja,ko,fr,es,de,it`,
      { timeoutMs: 8000, revalidate: 86400 },
    );
    const posters = (data.posters ?? [])
      .filter((p) => p.file_path)
      .sort((a, b) => b.vote_average - a.vote_average)
      .slice(0, 24)
      .map((p) => ({ path: p.file_path, language: p.iso_639_1, width: p.width, height: p.height }));
    return jsonSuccess({ posters }, { maxAge: 86400 });
  } catch {
    return jsonError("Couldn't load the posters", 502);
  }
}
