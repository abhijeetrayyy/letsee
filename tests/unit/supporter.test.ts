import { describe, expect, it } from "vitest";
import { PERKS, isPerk, priceFor } from "@/lib/people/supporter";

describe("the supporter tier", () => {
  it("costs twenty dollars a year, or its rupee price in India", () => {
    expect(priceFor("US")).toEqual({ currency: "USD", amount: 20, label: "$20" });
    expect(priceFor(null)).toEqual({ currency: "USD", amount: 20, label: "$20" });
    expect(priceFor("in")).toEqual({ currency: "INR", amount: 1700, label: "₹1,700" });
  });

  it("offers the four things, and nothing else counts as one", () => {
    expect(PERKS.map((p) => p.key)).toEqual(["no_mark", "printed_year", "early_access", "all_time_stats"]);
    expect(isPerk("printed_year")).toBe(true);
    expect(isPerk("stickers")).toBe(false);
    expect(isPerk(null)).toBe(false);
  });
});
