"use client";

import Link from "next/link";
import {
  buildSearchUrl,
  isValidSearchQuery,
  type SearchMediaType,
} from "@/utils/searchUrl";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { FaFilter, FaSearch } from "react-icons/fa";

const MAX_RECENT = 8;
const STORAGE_KEY = "recent_searches";

function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function saveRecentSearches(terms: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(terms.slice(0, MAX_RECENT)));
}

export default function SearchLandingPage() {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    setRecent(getRecentSearches());
  }, []);

  const submit = (term: string, mediaType: SearchMediaType = "multi") => {
    const trimmed = term.trim();
    if (!isValidSearchQuery(trimmed)) return;
    const next = [trimmed, ...recent.filter((t) => t !== trimmed)].slice(0, MAX_RECENT);
    setRecent(next);
    saveRecentSearches(next);
    router.push(buildSearchUrl({ query: trimmed, mediaType, page: 1 }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit(draft);
  };

  const clearRecent = () => {
    setRecent([]);
    saveRecentSearches([]);
  };

  return (
    <div className="min-h-screen mx-auto w-full max-w-3xl px-4 py-10 text-white">
      <h1 className="text-2xl sm:text-3xl font-semibold text-center mb-2">
        Search
      </h1>
      <p className="text-neutral-400 text-center mb-8">
        Find movies, TV shows, people, and keywords
      </p>

      <form onSubmit={handleSubmit} className="relative mb-10">
        <FaSearch
          className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500"
          size={20}
          aria-hidden
        />
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Search movies, TV, people, or keywords..."
          className="w-full py-3 pl-12 pr-4 rounded-full bg-neutral-800 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-500 text-base"
          autoFocus
          autoComplete="off"
          aria-label="Search"
        />
        <button
          type="submit"
          disabled={!isValidSearchQuery(draft.trim())}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-neutral-600 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Search
        </button>
      </form>

      {recent.length > 0 && (
        <section className="mb-8" aria-label="Recent searches">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wider">
              Recent searches
            </h2>
            <button
              type="button"
              onClick={clearRecent}
              className="text-xs text-neutral-500 hover:text-neutral-300"
            >
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recent.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => submit(term)}
                className="rounded-full bg-neutral-800 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-700"
              >
                {term}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8 pt-6 border-t border-neutral-700/50">
        <Link
          href={buildSearchUrl({
            query: "discover",
            mediaType: "movie",
            page: 1,
          })}
          className="inline-flex items-center gap-2 rounded-lg bg-neutral-800 px-4 py-2.5 text-sm font-medium text-neutral-200 hover:bg-neutral-700 hover:text-white transition-colors"
        >
          <FaFilter className="size-4" aria-hidden />
          Browse by filters (year, genre, where to watch)
        </Link>
      </section>

      <section className="text-neutral-500 text-sm mt-6">
        <p className="mb-2">Tip: use at least 2 characters to search.</p>
        <p>On results: filter by type, year, language, genre, and where to watch (Movies/TV).</p>
      </section>
    </div>
  );
}
