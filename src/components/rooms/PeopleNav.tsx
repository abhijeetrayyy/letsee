"use client";

import Link from "@components/ui/AppLink";

/**
 * The People tab's three places: the people you have (your rooms, requests
 * and groups), finding new ones (and Blind four), and what everyone's been
 * doing (Activity). Discovery used to be a side rail with a "Find anyone"
 * link that went to Search — which finds actors on TMDB, not people here.
 */
export default function PeopleNav({ current }: { current: "yours" | "find" | "activity" }) {
  const item = (on: boolean) =>
    `inline-flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition-colors ${
      on ? "bg-ink-0 text-page" : "text-ink-300 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0"
    }`;
  return (
    <nav aria-label="People" className="no-scrollbar -mx-4 mb-8 flex gap-2 overflow-x-auto px-4">
      <Link href="/app/people" prefetch aria-current={current === "yours" ? "page" : undefined} className={item(current === "yours")}>
        Your people
      </Link>
      <Link href="/app/people/find" prefetch aria-current={current === "find" ? "page" : undefined} className={item(current === "find")}>
        Find people
      </Link>
      <Link href="/app/people/activity" prefetch aria-current={current === "activity" ? "page" : undefined} className={item(current === "activity")}>
        Activity
      </Link>
    </nav>
  );
}
