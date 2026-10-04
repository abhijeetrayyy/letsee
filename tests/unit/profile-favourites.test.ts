import { describe, expect, it } from "vitest";
import { listWords, sharedFavourites, topGenres } from "@/lib/profile/favourites";

describe("what someone's favourites say", () => {
  it("counts each favourite once per genre, most first", () => {
    const favs = [{ genres: ["Drama", "Romance"] }, { genres: ["Drama", "Comedy"] }, { genres: ["Drama"] }, { genres: ["Comedy"] }];
    expect(topGenres(favs)).toEqual(["drama", "comedy", "romance"]);
    expect(topGenres(favs, 1)).toEqual(["drama"]);
  });
  it("folds series genres into film ones and leaves out formats", () => {
    const favs = [{ genres: ["Sci-Fi & Fantasy"] }, { genres: ["Science Fiction", "Kids"] }, { genres: ["Action & Adventure", "Action"] }];
    expect(topGenres(favs)).toEqual(["sci-fi", "action", "adventure"]);
    expect(topGenres([{ genres: ["Kids", "TV Movie"] }])).toEqual([]);
  });
  it("says a list the way a person would", () => {
    expect(listWords(["drama"])).toBe("drama");
    expect(listWords(["drama", "comedy"])).toBe("drama and comedy");
    expect(listWords(["drama", "comedy", "romance"])).toBe("drama, comedy and romance");
    expect(listWords([])).toBe("");
  });
  it("finds the favourites you share, telling films from series", () => {
    const theirs = [
      { itemId: "1", itemType: "movie" as const },
      { itemId: "2", itemType: "tv" as const },
      { itemId: "3", itemType: "movie" as const },
    ];
    expect(sharedFavourites(theirs, new Set(["movie:3", "movie:2"])).map((f) => f.itemId)).toEqual(["3"]);
  });
});
