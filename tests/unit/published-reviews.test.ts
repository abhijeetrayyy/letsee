import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publishedReviewText } from "@/utils/publishedReviews";

function fake(rows: { item_id: string; item_type: string; body: string | null }[]) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "not"]) q[m] = () => q;
  q.order = () => Promise.resolve({ data: rows });
  return { from: () => q } as unknown as SupabaseClient;
}

describe("the words a review shows", () => {
  it("are the published take's, newest last wins, blank ones dropped", async () => {
    const out = await publishedReviewText(
      fake([
        { item_id: "1", item_type: "movie", body: "first" },
        { item_id: "1", item_type: "movie", body: "  later  " },
        { item_id: "2", item_type: "tv", body: "   " },
      ]),
      "u",
      [{ item_id: "1", item_type: "movie" }, { item_id: "2", item_type: "tv" }],
    );
    expect([...out.entries()]).toEqual([["movie:1", "later"]]);
  });
  it("asks for nothing when there's nothing to look up", async () => {
    expect((await publishedReviewText(fake([]), "u", [])).size).toBe(0);
  });
});
