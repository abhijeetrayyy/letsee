import { NextRequest } from "next/server";
import { parseBrowseParams } from "@/utils/browseUrl";
import { jsonSuccess } from "@/utils/apiResponse";
import { loadResults, resolveLabels } from "@/lib/search/browse.server";

/**
 * GET /api/browse?type=&genre=&lang=&decade=&sort=&keyword=&company=&network=&collection=&page=
 *
 * One page of browse results and the names of the filters behind it. The same
 * for every visitor, so the CDN keeps it for an hour keyed on the query —
 * Search sends the canonical form (`browseQueryString`), so the same filters
 * always hit the same entry. This replaced `/app/browse`, a server render on
 * every view.
 */
export async function GET(req: NextRequest) {
  const p = parseBrowseParams(Object.fromEntries(req.nextUrl.searchParams));
  const [labels, { items, totalPages, total }] = await Promise.all([resolveLabels(p), loadResults(p)]);
  return jsonSuccess(
    {
      labels,
      totalPages,
      total,
      page: p.page,
      items: items
        .filter((i) => !i.adult)
        .map((i) => ({
          id: i.id,
          title: i.title ?? i.name ?? "",
          poster_path: i.poster_path ?? null,
          date: i.release_date ?? i.first_air_date ?? null,
        })),
    },
    { maxAge: 3600 },
  );
}
