"use client";

import { Fragment } from "react";
import useSWR from "swr";
import Link from "@components/ui/AppLink";
import type { RoomList } from "@/lib/db/rooms";
import { fetchAsksForMe } from "@/lib/db/asks";
import { gatherWaiting, moreWords, waitingSentence, waitingTail, waitingWords, type WaitingItem } from "@/lib/people/waiting";
import { titlePath } from "@/utils/urls";

/**
 * Waiting for you: one sentence at the top of Home, by name — the things only
 * you can resolve (lib/people/waiting). "priya says you watched *Dune*
 * together · sam passed you *Aftersun* · and two more." Each part goes where
 * it's answered: the rows further down Home, the asks, or the room.
 *
 * Costs nothing: the room list is Home's own read, and the asks share
 * AsksForYou's cache entry. No dot, no number on a badge. When there's
 * nothing, it says "Nothing waiting for you" — once you have people to
 * wait on; before that, the line would only be noise.
 */
export default function WaitingForYou({ me, list, onPage }: { me: string; list: RoomList; onPage: Set<string> }) {
  const { data: asks } = useSWR(["asks-for-me", me], () => fetchAsksForMe(me), { revalidateOnFocus: false });
  const items = gatherWaiting({ requests: list.requests, passesToMe: list.passesToMe, rooms: list.rooms, asks: asks ?? [] });
  // Until the asks arrive, an empty sentence might only be early.
  if (!items.length && !asks) return null;
  if (!items.length && list.people.length === 0) return null;

  const { shown, more } = waitingSentence(items);
  const room = (w: WaitingItem) => `/app/people/${encodeURIComponent(w.person.username)}`;
  // Where each is answered: its row on this page if it's there, else its place.
  const target = (w: WaitingItem): { href: string; anchor: boolean } => {
    if (onPage.has(w.key)) return { href: "#waiting-list", anchor: true };
    if (w.kind === "ask") return { href: "#asks-for-you", anchor: true };
    if (w.kind === "pass") return { href: titlePath(w.itemType, w.itemId, w.itemName), anchor: false };
    if (w.kind === "message") return { href: room(w), anchor: false };
    return { href: "/app/people", anchor: false };
  };
  const linkClass = "rounded-sm text-ink-300 underline decoration-transparent underline-offset-4 transition-colors hover:text-ink-0 hover:decoration-line-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";

  return (
    <section aria-labelledby="waiting-for-you" className="mx-auto w-full max-w-app px-4 pb-1 pt-4 sm:px-6 lg:px-8">
      <p className="text-sm leading-relaxed text-ink-400">
        <span id="waiting-for-you" className="mr-2 font-mono text-xs uppercase tracking-wider text-accent">
          Waiting for you
        </span>
        {!items.length ? (
          <span className="text-ink-500">Nothing right now.</span>
        ) : (
          <>
            {shown.map((w, i) => {
              const words = waitingWords(w);
              const { href, anchor } = target(w);
              const body = (
                <>
                  {words.before}
                  <span className="font-semibold text-ink-0">{words.name}</span>
                  {words.after}
                  {words.title && <em className="font-display text-base not-italic text-ink-0">{words.title}</em>}
                  {waitingTail(w)}
                </>
              );
              return (
                <Fragment key={w.key}>
                  {i > 0 && (
                    <span aria-hidden className="mx-1.5 text-ink-600">
                      ·
                    </span>
                  )}
                  {anchor ? (
                    <a href={href} className={linkClass}>
                      {body}
                    </a>
                  ) : (
                    <Link href={href} className={linkClass}>
                      {body}
                    </Link>
                  )}
                </Fragment>
              );
            })}
            {more > 0 && (
              <>
                <span aria-hidden className="mx-1.5 text-ink-600">
                  ·
                </span>
                <Link href="/app/people" className={linkClass}>
                  and {moreWords(more)}
                </Link>
              </>
            )}
          </>
        )}
      </p>
    </section>
  );
}
