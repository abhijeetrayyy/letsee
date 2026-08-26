import { describe, expect, it } from "vitest";
import { read, rel, sourceFiles } from "./schema";

/**
 * Prefetching is a multiplier, and this app multiplies.
 *
 * Next's `<Link>` prefetches when it scrolls into view. Measured against a
 * production build of this site, one prefetch of `/app/person/[id]` is 172 KB,
 * `/app/tv/[id]` is 128 KB, and `/app/profile/[id]` is 15.6 KB of **`no-store`**
 * — a function invocation every time, because that route cannot be cached. A TV
 * cast page emits roughly 400 person links; a home feed of twenty rows carries
 * about forty profile links. None of those are clicks. All of them were
 * requests.
 *
 * `@components/ui/AppLink` is `next/link` with `prefetch={false}` as the
 * default, so the expensive behaviour has to be asked for. This test keeps the
 * default from drifting back: a new component that reaches for `next/link` out
 * of habit — which is what everyone does, because that is what the docs say —
 * gets caught here rather than in a usage graph a month later.
 *
 * The allowlist is small on purpose. A file belongs on it when its links are
 * *singletons on a high-intent surface*: the header, the footer, the landing
 * page's calls to action, the auth and onboarding flows. Those are pages where
 * the next click is close to certain and there are five links, not five hundred.
 */
const ALLOWED = new Set([
  // The wrapper itself.
  "src/components/ui/AppLink.tsx",
  // Header, footer: a fixed handful of links, on every page, high intent.
  "src/components/header/navbar.tsx",
  "src/components/header/dropDownMenu.tsx",
  "src/components/header/BurgerMenu.tsx",
  "src/components/footbar/foot.tsx",
  // The marketing page and the error pages: one CTA each, and the whole point
  // of the page is that you press it.
  "src/app/page.tsx",
  "src/app/not-found.tsx",
  "src/app/error.tsx",
  // Auth and onboarding: linear flows, two or three links, and the next step is
  // the only thing on screen.
  "src/components/login/loginform.tsx",
  "src/components/signup/signupForm.tsx",
  "src/app/forgot-password/page.tsx",
  "src/components/clientComponent/update_password.tsx",
  "src/app/app/welcome/page.tsx",
  "src/app/app/profile/setup/page.tsx",
]);

describe("links are cheap by default", () => {
  it("imports next/link only where prefetching is deliberate", () => {
    const offenders = sourceFiles()
      .filter((file) => /from ["']next\/link["']/.test(read(file)))
      .map((file) => rel(file))
      .filter((path) => !ALLOWED.has(path));

    expect(offenders).toEqual([]);
  });

  it("still has the wrapper it is pointing everything at", () => {
    // Guards against the rule above passing because AppLink was deleted and
    // every import went somewhere else entirely.
    const wrapper = sourceFiles().find((f) => rel(f) === "src/components/ui/AppLink.tsx");
    expect(wrapper).toBeDefined();
    expect(read(wrapper!)).toContain("prefetch = false");
  });
});
