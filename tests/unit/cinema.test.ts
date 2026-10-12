import { describe, expect, it } from "vitest";
import { cinemaShelf } from "@/lib/people/cinema";

const person = (id: string) => ({ id, username: id, avatarUrl: null });
const people = new Map(["a", "b", "c"].map((id) => [id, person(id)]));
const titles = new Map([
  ["movie:1", { name: "Dune", image: null }],
  ["movie:2", { name: "Past Lives", image: null }],
  ["movie:3", { name: "Old", image: null }],
]);
const regionOf = new Map([["a", "IN"], ["b", "IN"], ["c", "US"]]);
const v = (user_id: string, item_id: string, watched_on: string, place = "cinema") => ({ user_id, item_id, item_type: "movie", watched_on, place });

describe("seen at the cinema", () => {
  const rows = [v("a", "1", "2026-10-10"), v("b", "1", "2026-10-11"), v("a", "2", "2026-10-12"), v("c", "3", "2026-10-12"), v("a", "3", "2026-08-01"), v("b", "2", "2026-10-12", "home")];

  it("keeps to your region, the last month, and the cinema", () => {
    const shelf = cinemaShelf(rows, people, titles, regionOf, "IN", "2026-09-13");
    expect(shelf.map((t) => `${t.itemName}:${t.people.length}`)).toEqual(["Dune:2", "Past Lives:1"]);
  });

  it("is anyone's when you have no region", () => {
    expect(cinemaShelf(rows, people, titles, regionOf, "", "2026-09-13").map((t) => t.itemName)).toEqual(["Dune", "Past Lives", "Old"]);
  });
});
