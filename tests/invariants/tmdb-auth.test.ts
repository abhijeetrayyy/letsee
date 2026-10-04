import { describe, expect, it } from "vitest";
import { read, rel, sourceFiles } from "./schema";

/**
 * TMDB authenticates with a bearer header set in one place, `tmdbClient.ts`.
 *
 * It used to be `?api_key=` built into some sixty URL templates, and a URL is
 * the one part of a request Next will print: every response too large for the
 * data cache logged `Failed to set fetch cache <full URL>`, key and all, into
 * production logs. A key in a URL is a key in a log line, so none is allowed.
 */
describe("the TMDB credential never appears in a URL", () => {
  const code = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("builds no api_key query parameter", () => {
    const offenders = sourceFiles()
      .filter((f) => !f.endsWith("tmdbClient.ts"))
      .filter((f) => /api_key/.test(code(read(f))))
      .map(rel);
    expect(offenders).toEqual([]);
  });

  it("reads the token only inside the client", () => {
    const offenders = sourceFiles()
      .filter((f) => !f.endsWith("tmdbClient.ts"))
      .filter((f) => /process\.env\.(TMDB_API_KEY|TMDB_READ_TOKEN)/.test(read(f)))
      .map(rel);
    expect(offenders).toEqual([]);
  });
});
