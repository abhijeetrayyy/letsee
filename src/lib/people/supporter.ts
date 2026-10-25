/**
 * The supporter tier, pre-sold before it's built (docs/IDEAS_2026-10.md §6.2,
 * migration 127): what it costs where you are, and the four things it would
 * bring. Everything free today stays free; these are additions, not a gate.
 */

export type Perk = "no_mark" | "printed_year" | "early_access" | "all_time_stats";

export const PERKS: { key: Perk; title: string; line: string }[] = [
  { key: "no_mark", title: "Pictures without the mark", line: "Your stubs and months, shared as pictures with no small “letsee” in the corner." },
  { key: "printed_year", title: "Your year, printed", line: "Twelve month cards of your year in film, printed and posted to you once a year." },
  { key: "early_access", title: "Early access", line: "New things before everyone else, and a say in what gets built next." },
  { key: "all_time_stats", title: "All-time stats", line: "Your whole history in numbers — directors, decades, countries, and who you watch with most." },
];

export type Price = { currency: "USD" | "INR"; amount: number; label: string };

/** Twenty dollars a year; in India, the rupee price it's shown at. The two migration 127 accepts. */
export function priceFor(region: string | null | undefined): Price {
  return region?.toUpperCase() === "IN" ? { currency: "INR", amount: 1700, label: "₹1,700" } : { currency: "USD", amount: 20, label: "$20" };
}

export function isPerk(v: unknown): v is Perk {
  return PERKS.some((p) => p.key === v);
}
