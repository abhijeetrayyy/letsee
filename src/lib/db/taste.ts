/**
 * Taste overlap, read from the browser.
 *
 * `/api/compatibility` was a Vercel function whose entire contribution was
 * holding a cookie client in front of an RPC that is pinned to `auth.uid()`
 * anyway — so the guard it appeared to add was already inside the function,
 * and the route was a round trip bought for nothing. It ran on every profile
 * view, which is the busiest signed-in page type on the site.
 *
 * It also did one thing besides forwarding, and that thing is deleted rather
 * than moved: it pulled four unbounded genre selects — the caller's whole
 * `watched_items` and `favorite_items`, and the same for the person being
 * viewed — to compute a "% genre overlap" figure. Three problems with it, and
 * they compound:
 *
 *   1. PostgREST caps a result set at 1000 rows, so on any real library the
 *      number was computed from a silently truncated sample. Migration 089
 *      found and fixed this exact bug elsewhere.
 *   2. With ~20 genres, every active user scores high against every other
 *      active user. The route's own comment called it "a blunt instrument…
 *      flavour, not evidence".
 *   3. It was rendered as the headline — a big percentage in a ring — directly
 *      above the rarity evidence that actually means something. The weakest
 *      signal in the panel had the strongest typography.
 *
 * So the percentage is gone, the four selects with it, and what remains is the
 * sentence naming a film the two of you have both seen.
 */

import { supabase } from "@/utils/supabase/client";
import {
  getPairwiseCompatibility,
  getTasteMatches,
  type PairwiseCompatibility,
  type TasteMatch,
} from "@/utils/tasteMatch";

export type { PairwiseCompatibility, TasteMatch };

/** The caller's overlap with one other person. One indexed row, normally. */
export function fetchTastePair(otherUserId: string): Promise<PairwiseCompatibility> {
  return getPairwiseCompatibility(supabase, otherUserId);
}

/** People whose taste resembles the caller's — precomputed nightly. */
export function fetchMyNeighbours(limit = 10): Promise<TasteMatch[]> {
  return getTasteMatches(supabase, limit);
}
