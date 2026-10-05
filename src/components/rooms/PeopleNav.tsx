"use client";

import Link from "@components/ui/AppLink";

/**
 * The People tab's two places: the people you have (your rooms, requests and
 * groups) and finding new ones. They were one page, with discovery in a side
 * rail and a "Find anyone" link that went to Search — which finds actors on
 * TMDB, not people on letsee.
 */
export default function PeopleNav({ current }: { current: "yours" | "find" }) {
  const item = (on: boolean) =>
    `inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold transition-colors ${
      on ? "bg-ink-0 text-page" : "text-ink-300 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0"
    }`;
  return (
    <nav aria-label="People" className="mb-8 flex gap-2">
      <Link href="/app/people" prefetch aria-current={current === "yours" ? "page" : undefined} className={item(current === "yours")}>
        Your people
      </Link>
      <Link href="/app/people/find" prefetch aria-current={current === "find" ? "page" : undefined} className={item(current === "find")}>
        Find people
      </Link>
    </nav>
  );
}
