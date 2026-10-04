import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { roomedAmong } from "@/utils/tonightRooms";

const ME = "11111111-1111-4111-8111-111111111111";
const ANA = "22222222-2222-4222-8222-222222222222";
const PRIV = "33333333-3333-4333-8333-333333333333";
const BLOCKER = "44444444-4444-4444-8444-444444444444";

/**
 * A stand-in for the two things asked: which accounts are public, and what
 * `is_my_person` says (follows or messages either way, and no block either way).
 */
function fake(publicIds: string[], yours: string[]) {
  const asked: string[] = [];
  const client = {
    from: () => {
      let ids: string[] = [];
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.eq = () => q;
      q.in = (_c: string, v: string[]) => {
        ids = v;
        asked.push(...v);
        return q;
      };
      q.is = () => Promise.resolve({ data: ids.filter((id) => publicIds.includes(id)).map((id) => ({ id })) });
      return q;
    },
    rpc: (_fn: string, args: { p_other: string }) => {
      asked.push(args.p_other);
      return Promise.resolve({ data: yours.includes(args.p_other) });
    },
  };
  return { client: client as unknown as SupabaseClient, asked };
}

describe("who Tonight counts as sharing a room with you", () => {
  it("admits someone who is yours and public — not a private account, nor someone who blocked you", async () => {
    // PRIV is yours but private; BLOCKER is public but is_my_person says no (they blocked you).
    const { client } = fake([ANA, BLOCKER], [ANA, PRIV]);
    expect([...(await roomedAmong(client, ME, [ANA, PRIV, BLOCKER]))]).toEqual([ANA]);
  });
  it("never asks about anything but an account id", async () => {
    const { client, asked } = fake([], []);
    const out = await roomedAmong(client, ME, ["x),sender_id.neq.(y", ME, "not-a-uuid"]);
    expect(out.size).toBe(0);
    expect(asked).toEqual([]);
  });
});
