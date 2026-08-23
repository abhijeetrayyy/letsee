import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The middleware matcher names a Supabase project by hand, and it has to.
 *
 * A Next matcher must be statically analysable — no env vars, no prefix
 * matching, exact cookie keys only. So `proxy.ts` hardcodes
 * `sb-<project-ref>-auth-token`, and if that ref ever stops matching the
 * project the app actually points at, middleware silently stops running for
 * signed-in users. Their tokens are never refreshed and they are signed out
 * when the current one expires. No error, no log, no failing request — people
 * just quietly lose their session.
 *
 * That is the kind of fault that survives review and is discovered by users, so
 * it is a test: the ref in the matcher must equal the ref in
 * NEXT_PUBLIC_SUPABASE_URL.
 */
describe("the proxy matcher names the project the app connects to", () => {
  const proxy = readFileSync(join(process.cwd(), "src", "proxy.ts"), "utf8");

  const refFromEnv = () => {
    // The build reads this from the environment; locally it comes from
    // .env.local, which is where a mismatch would first appear.
    const raw =
      process.env.NEXT_PUBLIC_SUPABASE_URL ??
      (() => {
        try {
          const env = readFileSync(join(process.cwd(), ".env.local"), "utf8");
          return /NEXT_PUBLIC_SUPABASE_URL=(.+)/.exec(env)?.[1]?.trim() ?? "";
        } catch {
          return "";
        }
      })();
    return /https:\/\/([a-z0-9]+)\.supabase\.co/.exec(raw)?.[1] ?? null;
  };

  it("hardcodes exactly one project ref", () => {
    const refs = [...proxy.matchAll(/sb-([a-z0-9]+)-auth-token/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThan(0);
    expect(new Set(refs).size).toBe(1);
  });

  it("matches the ref the app connects to", () => {
    const env = refFromEnv();
    if (!env) {
      // No URL available here (CI without secrets); the check above still holds.
      expect(proxy).toMatch(/sb-[a-z0-9]+-auth-token/);
      return;
    }
    expect(proxy).toContain(`sb-${env}-auth-token`);
  });

  it("covers the chunked cookie as well as the plain one", () => {
    /**
     * supabase-ssr splits a large token into `${key}.${i}`. A chunked session
     * has no cookie under the bare name, so matching only that would exclude
     * precisely the users whose sessions are biggest.
     */
    expect(proxy).toMatch(/-auth-token\.0/);
    // Two matcher entries, and both written out longhand — Next rejects a
    // `source` or `key` it cannot read statically, which the first attempt at
    // this file discovered by failing the build.
    expect([...proxy.matchAll(/source:\s*"/g)].length).toBe(2);
    expect(proxy).not.toMatch(/source:\s*[A-Z_]+,/);
  });
});
