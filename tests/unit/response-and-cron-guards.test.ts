import { afterEach, describe, expect, it } from "vitest";
import { jsonSuccess, jsonError } from "@/utils/apiResponse";
import { guardCron } from "@/utils/cronAuth";
import { siteUrl, absoluteUrl } from "@/utils/siteUrl";

/**
 * This mapping is where a critical leak lived. `/api/upcoming-episodes` was
 * auth-gated, scoped every query to the caller, and passed `maxAge: 300` — so
 * a CDN cached one user's watch queue under a URL with no per-user key and
 * served it to everyone else.
 *
 * The default is the load-bearing part: a route that says nothing about
 * caching must not be shared.
 */
describe("jsonSuccess cache headers", () => {
  it("defaults to private and uncacheable", async () => {
    const res = jsonSuccess({ ok: true });
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("treats maxAge 0 as private, not as 'cache for zero seconds'", () => {
    // `public, s-maxage=0` still licenses a shared cache to store and
    // revalidate. Only `private, no-store` keeps it out of one entirely.
    expect(jsonSuccess({}, { maxAge: 0 }).headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("only emits a shared cache header when a positive maxAge is asked for", () => {
    expect(jsonSuccess({}, { maxAge: 300 }).headers.get("Cache-Control")).toBe(
      "public, s-maxage=300, stale-while-revalidate=1800",
    );
  });

  it("never lets an error response be cached", () => {
    expect(jsonError("nope", 403).headers.get("Cache-Control")).toBe("no-store");
  });
});

/**
 * The old cron guard was `if (expectedToken && header !== expected) return 401`
 * — which is not a guard when the variable is unset. It skipped, and
 * /api/cron/purge-deleted hard-deletes accounts.
 */
describe("guardCron", () => {
  const original = process.env.CRON_SECRET;
  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });

  const request = (auth?: string) =>
    new Request("https://example.test/api/cron/purge-deleted", {
      headers: auth ? { authorization: auth } : {},
    });

  it("refuses everything when the secret is not configured", async () => {
    delete process.env.CRON_SECRET;
    const denied = guardCron(request("Bearer anything"));
    expect(denied).not.toBeNull();
    // 503, not 401: the caller did nothing wrong, the deployment is wrong, and
    // those should read differently in a log.
    expect(denied!.status).toBe(503);
  });

  it("refuses a wrong or missing token", () => {
    process.env.CRON_SECRET = "s3cret";
    expect(guardCron(request())?.status).toBe(401);
    expect(guardCron(request("Bearer nope"))?.status).toBe(401);
    expect(guardCron(request("s3cret"))?.status).toBe(401); // bare, no scheme
  });

  it("admits exactly the bearer token Vercel sends", () => {
    process.env.CRON_SECRET = "s3cret";
    expect(guardCron(request("Bearer s3cret"))).toBeNull();
  });
});

describe("siteUrl", () => {
  const app = process.env.NEXT_PUBLIC_APP_URL;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  afterEach(() => {
    app === undefined ? delete process.env.NEXT_PUBLIC_APP_URL : (process.env.NEXT_PUBLIC_APP_URL = app);
    vercel === undefined
      ? delete process.env.VERCEL_PROJECT_PRODUCTION_URL
      : (process.env.VERCEL_PROJECT_PRODUCTION_URL = vercel);
  });

  it("prefers the operator's explicit URL and drops a trailing slash", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://letsee.online/";
    expect(siteUrl()).toBe("https://letsee.online");
    // A doubled slash in a canonical tag is a different URL to a crawler.
    expect(absoluteUrl("/app/profile/ray")).toBe("https://letsee.online/app/profile/ray");
  });

  it("falls back to Vercel's production domain, not the per-deploy preview URL", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "letsee.vercel.app";
    expect(siteUrl()).toBe("https://letsee.vercel.app");
  });

  it("always returns an absolute origin", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    expect(siteUrl()).toMatch(/^https:\/\/[^/]+$/);
  });
});
