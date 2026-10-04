"use client";

import { Search } from "lucide-react";
import { openQuickSearch } from "@components/search/QuickSearch";

/**
 * Looking something up, from the front door, signed out.
 *
 * Plenty of people arrive wanting one answer — what is this film, where is it
 * streaming — not an account. The search icon in the bar was the only way in.
 * This is the field they expect, and it opens the same panel as everywhere
 * else (spelling forgiven, titles as you type); the title pages it leads to
 * are open to everyone.
 */
export default function FrontSearch() {
  return (
    <button
      type="button"
      onClick={openQuickSearch}
      className="flex h-12 w-full items-center gap-3 rounded-control bg-raised px-4 text-left text-base text-ink-500 ring-1 ring-inset ring-line-input transition-colors hover:text-ink-300 hover:ring-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      <Search className="size-5 shrink-0" aria-hidden />
      Look up any film, series or anime
    </button>
  );
}
