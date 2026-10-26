import { describe, expect, it } from "vitest";
import { crewForSummaries, groupCrew, keyCrew, type CrewMember } from "@components/detail/CrewBlock";
import { toWorkCredits, type Credit } from "@/utils/person/model";
import { trimReleaseDates, trimVideos } from "@/utils/title/trim";

/**
 * What title and person pages send to the browser (25 Oct 2026): only what
 * their components read, and only as many as they show — with the same result
 * on screen.
 */
describe("a film page's crew", () => {
  // A big film's crew: a long tail in every department, a few ranked jobs, people with several jobs.
  const crew: CrewMember[] = [
    { id: 1, name: "Christopher Nolan", job: "Director", department: "Directing", profile_path: "/n.jpg" },
    { id: 1, name: "Christopher Nolan", job: "Writer", department: "Writing", profile_path: "/n.jpg" },
    { id: 1, name: "Christopher Nolan", job: "Producer", department: "Production", profile_path: "/n.jpg" },
    { id: 2, name: "Emma Thomas", job: "Producer", department: "Production", profile_path: "/t.jpg" },
    ...Array.from({ length: 30 }, (_, i) => ({ id: 100 + i, name: `Producer ${i}`, job: "Associate Producer", department: "Production", profile_path: null })),
    ...Array.from({ length: 40 }, (_, i) => ({ id: 200 + i, name: `Grip ${i}`, job: "Key Grip", department: "Camera", profile_path: null })),
    { id: 3, name: "Wally Pfister", job: "Director of Photography", department: "Camera", profile_path: "/p.jpg" },
    { id: 4, name: "Hans Zimmer", job: "Original Music Composer", department: "Sound", profile_path: "/z.jpg" },
    { id: 5, name: "Lee Smith", job: "Editor", department: "Editing", profile_path: "/s.jpg" },
    ...Array.from({ length: 25 }, (_, i) => ({ id: 300 + i, name: `Sound ${i}`, job: "Boom Operator", department: "Sound", profile_path: null })),
    ...Array.from({ length: 20 }, (_, i) => ({ id: 400 + i, name: `Art ${i}`, job: "Set Decoration", department: "Art", profile_path: null })),
  ];

  it("keeps far less of it", () => {
    expect(crewForSummaries(crew).length).toBeLessThan(crew.length / 3);
  });

  it("shows the same departments, the same people and the same key faces", () => {
    const trimmed = crewForSummaries(crew);
    expect(groupCrew(trimmed)).toEqual(groupCrew(crew));
    expect(keyCrew(trimmed)).toEqual(keyCrew(crew));
    // The director and writer lines read only those jobs.
    const jobs = (list: CrewMember[], names: string[]) => list.filter((c) => names.includes(c.job ?? "")).map((c) => c.id);
    expect(jobs(trimmed, ["Director", "Screenplay", "Writer", "Story"])).toEqual(jobs(crew, ["Director", "Screenplay", "Writer", "Story"]));
  });
});

describe("a person's work", () => {
  const credit = (over: Partial<Credit>): Credit => ({
    key: `movie-${over.id}`,
    id: 1,
    mediaType: "movie",
    title: "T",
    posterPath: "/p.jpg",
    date: "2006-08-18",
    year: 2006,
    voteAverage: 5.477,
    voteCount: 2080,
    characters: [],
    order: 0,
    episodeCount: 0,
    jobs: [],
    departments: [],
    bucket: "performance",
    isCrew: false,
    flags: { voice: false, uncredited: false, video: false },
    ...over,
  });

  it("sends the grid what it reads, and leaves the empties out", () => {
    const { work } = toWorkCredits([credit({ id: 326, title: "Snakes on a Plane", characters: ["Neville Flynn"] })]);
    expect(work).toEqual([{ id: 326, mediaType: "movie", title: "Snakes on a Plane", posterPath: "/p.jpg", date: "2006-08-18", voteAverage: 5.5, voteCount: 2080, characters: ["Neville Flynn"] }]);
  });

  it("keeps episodes past one, the jobs, and that it's crew work", () => {
    const { work } = toWorkCredits([
      credit({ id: 1, mediaType: "tv", characters: ["Himself"], episodeCount: 12 }),
      credit({ id: 2, jobs: ["Producer"], isCrew: true }),
      credit({ id: 3, characters: ["Cameo"], episodeCount: 1 }),
    ]);
    expect(work[0].episodeCount).toBe(12);
    expect(work[1]).toMatchObject({ jobs: ["Producer"], isCrew: true });
    expect(work[2].episodeCount).toBeUndefined();
  });

  it("counts every title for what you've seen, but only shows the work", () => {
    const { work, otherTitles } = toWorkCredits([credit({ id: 1, characters: ["A"] }), credit({ id: 2, bucket: "archive" as Credit["bucket"] }), credit({ id: 3, mediaType: "tv", bucket: "self" as Credit["bucket"] })]);
    expect(work.map((w) => w.id)).toEqual([1]);
    expect(otherTitles).toEqual([{ id: 2, mediaType: "movie" }, { id: 3, mediaType: "tv" }]);
  });
});

describe("a film's dates and videos", () => {
  it("keeps what the release rail and the identity line read", () => {
    const out = trimReleaseDates([
      { iso_3166_1: "IN", release_dates: [{ certification: "UA", release_date: "2010-07-23T00:00:00.000Z", type: 3, note: "", descriptors: [], iso_639_1: "" }] },
      { iso_3166_1: "US", release_dates: [{ certification: "", release_date: "2010-07-16T00:00:00.000Z", type: 3, note: "Premiere", descriptors: [] }] },
    ]);
    expect(out).toEqual([
      { iso_3166_1: "IN", release_dates: [{ release_date: "2010-07-23T00:00:00.000Z", type: 3, certification: "UA" }] },
      { iso_3166_1: "US", release_dates: [{ release_date: "2010-07-16T00:00:00.000Z", type: 3, note: "Premiere" }] },
    ]);
  });

  it("keeps the five fields the video shelf reads", () => {
    expect(trimVideos([{ key: "YoHD9XEInc0", name: "Trailer", site: "YouTube", type: "Trailer", official: true, size: 1080, iso_639_1: "en", published_at: "x", id: "y" } as never])).toEqual([
      { key: "YoHD9XEInc0", name: "Trailer", site: "YouTube", type: "Trailer", official: true },
    ]);
  });
});
