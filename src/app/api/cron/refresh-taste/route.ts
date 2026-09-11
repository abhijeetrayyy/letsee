import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import { jsonError } from "@/utils/apiResponse";
import { guardCron } from "@/utils/cronAuth";

export const dynamic = "force-dynamic";
/** The rarity rebuild is the only unbounded statement here, and it is one scan. */
export const maxDuration = 60;

/**
 * Rebuild the taste caches. Once a night, in place of once per page view.
 *
 * ── What this is paying for ────────────────────────────────────────────────
 * Before 093, three of the busiest surfaces in the app each began by
 * aggregating the entire community: the compatibility panel on every profile,
 * the "people like you" directory, and the audience count on every title page.
 * All three read `user_title_affinity`, which is a three-way UNION ALL over the
 * whole of `user_media_status`, `favorite_items` and `user_ratings`.
 *
 * That is free at three users and fatal at three thousand, and this application
 * has already been taken off the air once by its own hosting bill. So the
 * community-wide arithmetic happens here, on a schedule, and the request path
 * reads rows.
 *
 * ── The three passes, in order, because they depend on each other ──────────
 *   1. `refresh_title_reach`      — the corpus size and each title's rarity.
 *   2. `refresh_user_taste`       — each person's norm, which is defined in
 *                                   terms of the rarity from step 1.
 *   3. `refresh_taste_neighbours` — top twenty per person, which needs both.
 *
 * Steps 2 and 3 only touch users whose library actually moved since the last
 * run — `library_version` is bumped by a statement-level trigger on write, and
 * each cached artefact records the version it was built against. On a quiet
 * night they do nothing at all.
 *
 * ── Why the limits ─────────────────────────────────────────────────────────
 * Both sweeps are bounded so one run cannot outgrow the function's wall clock.
 * Whatever is left over is still stale on the next run and is picked up then,
 * ordered by how much churn the user has, so the most-changed libraries are
 * always first in the queue. A backlog degrades the freshness of a number
 * nobody can perceive is stale; it never fails a request.
 *
 * Rarity is deliberately NOT rebuilt incrementally. A full scan once a day is
 * simple and obviously correct, and the door is open to touching `title_reach`
 * per title later if that scan ever stops being cheap.
 */

/** Users whose norm is recomputed per run. */
const NORM_BATCH = 2000;
/** Users whose neighbour list is recomputed per run — the expensive pass. */
const NEIGHBOUR_BATCH = 500;

export async function GET(request: Request) {
  const denied = guardCron(request);
  if (denied) return denied;

  const supabase = createAdminClient();
  const started = Date.now();

  /**
   * Sequential, not parallel, and that is not a missed optimisation: step 2
   * reads what step 1 writes, and step 3 reads both. Running them together
   * would compute norms against yesterday's rarity.
   */
  const reach = await supabase.rpc("refresh_title_reach");
  if (reach.error) {
    console.error("refresh_title_reach:", reach.error);
    return jsonError(`Rarity rebuild failed: ${reach.error.message}`, 500);
  }

  const norms = await supabase.rpc("refresh_user_taste", { p_limit: NORM_BATCH });
  if (norms.error) {
    console.error("refresh_user_taste:", norms.error);
    return jsonError(`Norm rebuild failed: ${norms.error.message}`, 500);
  }

  /**
   * A failure here is reported but does not fail the run.
   *
   * Steps 1 and 2 are what the request path actually reads — the compatibility
   * panel and the title audience both work the moment those land. Neighbours
   * only feed a directory that is explicitly allowed to be a night behind, so
   * losing this pass degrades one surface rather than leaving the caches in a
   * half-built state that the next run would have to detect.
   */
  const neighbours = await supabase.rpc("refresh_taste_neighbours", {
    p_limit: NEIGHBOUR_BATCH,
  });
  if (neighbours.error) console.error("refresh_taste_neighbours:", neighbours.error);

  return NextResponse.json(
    {
      titlesReached: Number(reach.data ?? 0),
      normsRecomputed: Number(norms.data ?? 0),
      neighboursRecomputed: neighbours.error ? null : Number(neighbours.data ?? 0),
      neighboursError: neighbours.error?.message ?? null,
      // A run that hits its batch ceiling has more waiting. Worth seeing in a
      // log before it becomes a permanent backlog.
      normsTruncated: Number(norms.data ?? 0) >= NORM_BATCH,
      neighboursTruncated: Number(neighbours.data ?? 0) >= NEIGHBOUR_BATCH,
      ms: Date.now() - started,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
