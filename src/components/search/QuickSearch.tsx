"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { lockScroll } from "@/lib/ui/scrollLock";
import { usePendingNavigation } from "@/lib/nav/pendingNavigation";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { ArrowRight, Clock, Search } from "lucide-react";
import Link from "@components/ui/AppLink";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { fetchRoomList } from "@/lib/db/rooms";
import { MAX_RECENT, PeopleResults, TitleResults, readRecent, useDebounced, writeRecent } from "@components/search/v2/SearchV2";

/**
 * Search, over whatever page you're on (the owner: "search is a very big
 * thing… reduce the number of pages or interactions").
 *
 * The Search tab, the desktop bar's field and "/" open this instead of a page:
 * the field is focused at once, titles and people arrive as you type — with
 * "Showing results for…" when it's misspelt (`TitleResults`, `correctQuery`) —
 * and choosing one goes straight to it. Nothing to go back through. The full
 * page (`/app/search`) is still there for everything at once, Browse and
 * "Describe it instead", one link away at the foot.
 *
 * Opened with `openQuickSearch()` (a window event, so any button anywhere can
 * open it without a provider); mounted once, in the bars.
 */
const OPEN = "letsee:search";

export function openQuickSearch() {
  window.dispatchEvent(new Event(OPEN));
}

export default function QuickSearch() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN, show);
    return () => window.removeEventListener(OPEN, show);
  }, []);
  // Choosing a result is a navigation; the panel shouldn't follow you there.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- closing on navigation is the point
  useEffect(() => setOpen(false), [pathname]);
  // And it goes the moment the navigation starts, not when the page arrives:
  // it sits above everything, so the next page's shape (ui/PendingNavigation)
  // was drawn underneath it and all anyone saw was the bar at the top.
  const going = usePendingNavigation(pathname);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- closing when a navigation starts is the point
  useEffect(() => { if (going) setOpen(false); }, [going]);

  if (!open) return null;
  return <Panel onClose={() => setOpen(false)} />;
}

function Panel({ onClose }: { onClose: () => void }) {
  const { user, status } = useAuth();
  const me = status === "ok" ? user?.id ?? null : null;
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim(), 250);
  const [recent, setRecent] = useState<string[]>(readRecent);
  const input = useRef<HTMLInputElement>(null);
  const results = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  const { data: list } = useSWR(me ? ["rooms", me] : null, () => fetchRoomList(me!), { revalidateOnFocus: false });
  const yourPeople = useMemo(() => (list?.people ?? []).slice(0, 24).map((p) => p.person), [list]);

  useEffect(() => {
    opener.current = document.activeElement;
    const unlock = lockScroll();
    input.current?.focus();
    return () => {
      unlock();
      const back = opener.current as HTMLElement | null;
      if (back?.isConnected) back.focus?.();
    };
  }, []);

  const remember = useCallback(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const next = [term, ...readRecent().filter((t) => t.toLowerCase() !== term.toLowerCase())].slice(0, MAX_RECENT);
    writeRecent(next);
    setRecent(next);
  }, [q]);

  const items = () => [...(results.current?.querySelectorAll<HTMLElement>("[data-result]") ?? [])];
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    const list = items();
    const at = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      list[Math.min(at + 1, list.length - 1)]?.focus();
    } else if (e.key === "ArrowUp" && at >= 0) {
      e.preventDefault();
      if (at === 0) input.current?.focus();
      else list[at - 1]?.focus();
    }
  };

  const term = q.trim();
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center sm:px-4 sm:pt-[10vh]" role="dialog" aria-modal="true" aria-label="Search" onKeyDown={onKey}>
      <button type="button" aria-label="Close search" tabIndex={-1} onClick={onClose} className="absolute inset-0 bg-page/80 backdrop-blur-sm" />
      <div className="relative flex h-dvh w-full max-w-sheet flex-col bg-overlay shadow-2xl sm:h-auto sm:max-h-[75vh] sm:rounded-sheet sm:border sm:border-line-strong">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2.5" role="search">
          <Search className="ml-1 size-5 shrink-0 text-ink-500" aria-hidden />
          <label htmlFor="quick-search" className="sr-only">
            Search films, series and people
          </label>
          <input
            id="quick-search"
            ref={input}
            type="search"
            inputMode="search"
            enterKeyHint="go"
            autoComplete="off"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              // Enter opens the top result: what you typed is usually what you meant.
              if (e.key === "Enter") {
                const first = items()[0];
                if (first) {
                  e.preventDefault();
                  remember();
                  first.click();
                }
              }
            }}
            placeholder="Films, series, anime, people"
            className="h-11 min-w-0 flex-1 bg-transparent text-base text-ink-0 placeholder:text-ink-600 focus:outline-none"
          />
          {/* A word, not a second ×: the field already has its own clear button. */}
          <button type="button" onClick={onClose} className="flex h-9 shrink-0 items-center rounded-full px-3 text-sm font-medium text-ink-300 hover:bg-hover hover:text-ink-0">
            Cancel
          </button>
        </div>

        <div ref={results} onClickCapture={(e) => (e.target as HTMLElement).closest("[data-result]") && remember()} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {!term ? (
            <div className="flex flex-col gap-6">
              {recent.length > 0 && (
                <section aria-labelledby="qs-recent">
                  <h2 id="qs-recent" className="mb-2 font-sans text-xs font-medium uppercase tracking-wide text-ink-500">
                    Recent
                  </h2>
                  <ul className="flex flex-wrap gap-2">
                    {recent.map((r) => (
                      <li key={r}>
                        <button type="button" onClick={() => setQ(r)} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm text-ink-200 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0">
                          <Clock className="size-3.5 text-ink-500" aria-hidden />
                          {r}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <p className="text-sm text-ink-500">Type a film, a series, an anime or a name. Spelling doesn&apos;t have to be perfect.</p>
              <Link href="/app/search?browse=1" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-0 underline decoration-line-input underline-offset-4">
                Browse by genre or mood
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <section aria-label="Titles">
                <TitleResults q={term} dq={dq} yourPeople={yourPeople} onSuggest={setQ} limit={8} />
              </section>
              {dq.length >= 2 && (
                <section aria-labelledby="qs-people">
                  <h2 id="qs-people" className="mb-1 font-sans text-xs font-medium uppercase tracking-wide text-ink-500">
                    People
                  </h2>
                  <PeopleResults q={dq} me={me} limit={3} />
                </section>
              )}
            </div>
          )}
        </div>

        {term && (
          <div className="border-t border-line px-4 py-3">
            <Link
              href={`/app/search?q=${encodeURIComponent(term)}`}
              onClick={remember}
              className="flex items-center justify-between gap-3 text-sm font-medium text-ink-200 hover:text-ink-0"
            >
              <span className="min-w-0 truncate">All results for “{term}”</span>
              <ArrowRight className="size-4 shrink-0" aria-hidden />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
