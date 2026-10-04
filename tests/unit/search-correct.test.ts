import { describe, expect, it } from "vitest";
import { buildVocabulary, correctQuery, editDistance } from "@/lib/search/correct";

const vocab = buildVocabulary([
  "Interstellar",
  "The Dark Knight",
  "The Dark Knight Rises",
  "Breaking Bad",
  "Spirited Away",
  "Naruto Shippuden",
  "Christopher Nolan",
  "The Shawshank Redemption",
  "Dune",
  "Dune: Part Two",
  "It",
  "Up",
  "Blade Runner 2049",
]);

describe("did you mean", () => {
  it("fixes a misspelt title", () => {
    expect(correctQuery("intersteller", vocab)).toBe("interstellar");
    expect(correctQuery("the dark knigt", vocab)).toBe("the dark knight");
    expect(correctQuery("shawshenk redemtion", vocab)).toBe("shawshank redemption");
    expect(correctQuery("breakin bad", vocab)).toBe("breaking bad");
  });
  it("fixes swapped letters and names", () => {
    expect(correctQuery("naurto", vocab)).toBe("naruto");
    expect(correctQuery("christpher nolan", vocab)).toBe("christopher nolan");
  });
  it("leaves what it can't improve alone", () => {
    expect(correctQuery("interstellar", vocab)).toBeNull();
    expect(correctQuery("dune", vocab)).toBeNull();
    expect(correctQuery("blade runner 2049", vocab)).toBeNull();
    expect(correctQuery("xq", vocab)).toBeNull();
    expect(correctQuery("zzzzzzzz", vocab)).toBeNull();
  });
  it("doesn't touch short words or numbers", () => {
    expect(correctQuery("ut", vocab)).toBeNull();
    expect(correctQuery("2048", vocab)).toBeNull();
  });
  it("counts a swap as one edit", () => {
    expect(editDistance("naurto", "naruto", 2)).toBe(1);
    expect(editDistance("knigt", "knight", 2)).toBe(1);
  });
});
