import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchTmdb, tmdbConfigured } from "@/utils/tmdbClient";

/**
 * The token goes in a header and only to TMDB. Both halves matter: a key in
 * the URL ends up in Next's cache-failure log lines, and a bearer header sent
 * to any other host hands the credential to that host.
 */
describe("fetchTmdb authentication", () => {
  const original = process.env.TMDB_READ_TOKEN;
  const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));

  beforeEach(() => {
    process.env.TMDB_READ_TOKEN = "test-read-token";
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (original === undefined) delete process.env.TMDB_READ_TOKEN;
    else process.env.TMDB_READ_TOKEN = original;
  });

  const sent = () => {
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    return { url, headers: new Headers(init.headers) };
  };

  it("sends the token as a bearer header, not in the URL", async () => {
    await fetchTmdb("https://api.themoviedb.org/3/tv/2734?append_to_response=credits");
    const { url, headers } = sent();
    expect(headers.get("authorization")).toBe("Bearer test-read-token");
    expect(url).toBe("https://api.themoviedb.org/3/tv/2734?append_to_response=credits");
  });

  it("keeps the caller's own headers", async () => {
    await fetchTmdb("https://api.themoviedb.org/3/movie/1", { headers: { "accept-language": "fr" } });
    const { headers } = sent();
    expect(headers.get("accept-language")).toBe("fr");
    expect(headers.get("authorization")).toBe("Bearer test-read-token");
  });

  it("strips an api_key a stale caller still put in the URL", async () => {
    await fetchTmdb("https://api.themoviedb.org/3/movie/1?api_key=leaked&language=en-US");
    const { url } = sent();
    expect(url).not.toContain("api_key");
    expect(url).not.toContain("leaked");
    expect(new URL(url).searchParams.get("language")).toBe("en-US");
  });

  it("never sends the token to another host", async () => {
    await fetchTmdb("https://example.test/data.json");
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit | undefined];
    expect(new Headers(init?.headers).get("authorization")).toBeNull();
  });

  it("answers 401 itself when the token is not configured", async () => {
    delete process.env.TMDB_READ_TOKEN;
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(tmdbConfigured()).toBe(false);
    const res = await fetchTmdb("https://api.themoviedb.org/3/movie/1");
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
