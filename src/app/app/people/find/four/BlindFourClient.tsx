"use client";

import { useContext, useState } from "react";
import useSWR from "swr";
import { ArrowRight, Heart, MessageCircle, RotateCcw, Shuffle, Sparkles } from "lucide-react";
import Link from "@components/ui/AppLink";
import Avatar from "@components/ui/Avatar";
import FollowButton from "@components/profile/FollowButton";
import { QuickMarkButton } from "@components/ds/QuickMarks";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import UserPrefrenceContext from "@/app/contextAPI/userPrefrence";
import { dealBlindFour, type BlindCard } from "@/lib/db/blindFour";
import { profilePath, titlePath } from "@/utils/urls";

/**
 * Blind four: meet people by what they love before you know who they are.
 *
 * The owner wanted something playful for finding people that wasn't a
 * left/right swipe — swiping says no to people; this only ever says "show me".
 * A card is a stranger's four favourite films and how many of them you've
 * seen; turn it over to see who it is, then follow, message, or move on. Two
 * or more in common is a taste match. Posters can be marked as you go —
 * a stranger's four is a good way to find your next film too.
 *
 * Nothing is recorded about who you turned or skipped; the counts are for
 * this sitting only. The deck is read in the browser (lib/db/blindFour).
 */
export default function BlindFourClient() {
  const { user, status } = useAuth();
  const me = status === "ok" ? user?.id ?? null : null;
  const [deal, setDeal] = useState(0);
  const { data: deck, isLoading } = useSWR(me ? ["blind-four", me, deal] : null, () => dealBlindFour(me!), { revalidateOnFocus: false });
  const [at, setAt] = useState(0);
  const [turned, setTurned] = useState(false);
  const [met, setMet] = useState(0);
  const [followed, setFollowed] = useState<Set<string>>(new Set());

  const next = () => {
    setTurned(false);
    setAt((i) => i + 1);
  };
  const again = () => {
    setDeal((d) => d + 1);
    setAt(0);
    setTurned(false);
    setMet(0);
    setFollowed(new Set());
  };

  const card = deck?.[at];

  return (
    <div className="min-h-screen bg-page pb-16">
      <header data-theme="dark" className="relative isolate overflow-hidden bg-page text-ink-200">
        <div aria-hidden className="absolute inset-0 -z-10">
          {card?.four[0]?.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.four[0].imageUrl} alt="" className="h-full w-full scale-125 object-cover opacity-50" style={{ filter: "blur(56px) saturate(1.5)" }} />
          )}
          <div className="absolute inset-0 bg-linear-to-b from-page/40 via-page/70 to-page" />
        </div>
        <div className="mx-auto max-w-read px-4 pb-8 pt-8 sm:pt-12">
          <Link href="/app/people/find" className="text-sm text-ink-400 hover:text-ink-200">
            ← Find people
          </Link>
          <p className="mt-6 text-xs font-medium uppercase tracking-[0.2em] text-accent">A game · Blind four</p>
          <h1 className="mt-2 text-4xl leading-tight text-ink-0 sm:text-5xl">Four films. One stranger.</h1>
          <p className="mt-3 text-base leading-relaxed text-ink-300">Someone on letsee loves these four. Your kind of taste? Turn the card over to meet them.</p>
        </div>
      </header>

      <div className="mx-auto max-w-read px-4">
        {!me ? (
          <p className="mt-8 text-base text-ink-400">
            <Link href="/login?next=/app/people/find/four" className="text-accent underline underline-offset-4">
              Sign in
            </Link>{" "}
            to play.
          </p>
        ) : isLoading || !deck ? (
          <CardSkeleton />
        ) : deck.length === 0 ? (
          <Empty />
        ) : card ? (
          <>
            <Progress at={at} total={deck.length} met={met} followed={followed.size} />
            <Card
              key={card.person.id}
              card={card}
              me={me}
              turned={turned}
              onTurn={() => {
                setTurned(true);
                setMet((m) => m + 1);
              }}
              onFollow={(on) =>
                setFollowed((cur) => {
                  const nextSet = new Set(cur);
                  if (on) nextSet.add(card.person.id);
                  else nextSet.delete(card.person.id);
                  return nextSet;
                })
              }
              onNext={next}
            />
          </>
        ) : (
          <End met={met} followed={followed.size} onAgain={again} />
        )}
      </div>
    </div>
  );
}

function Progress({ at, total, met, followed }: { at: number; total: number; met: number; followed: number }) {
  return (
    <div className="mt-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-1.5" aria-label={`Card ${at + 1} of ${total}`}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === at ? "w-6 bg-action" : i < at ? "w-1.5 bg-ink-400" : "w-1.5 bg-active"}`} />
        ))}
      </div>
      <p className="font-mono text-xs tabular-nums text-ink-500">
        met {met} · followed {followed}
      </p>
    </div>
  );
}

function Card({
  card,
  me,
  turned,
  onTurn,
  onFollow,
  onNext,
}: {
  card: BlindCard;
  me: string;
  turned: boolean;
  onTurn: () => void;
  onFollow: (on: boolean) => void;
  onNext: () => void;
}) {
  const { getStatus, hasFavorite } = useContext(UserPrefrenceContext);
  const seen = card.four.filter((f) => getStatus(f.itemId, f.itemType) === "watched").length;
  const bothLove = card.four.filter((f) => hasFavorite(f.itemId, f.itemType));
  const match = seen >= 2 || bothLove.length >= 1;

  return (
    <article className="mt-4 overflow-hidden rounded-card bg-raised shadow-xl ring-1 ring-inset ring-line-strong" aria-live="polite">
      <ul className="grid grid-cols-2 gap-2 p-3 sm:gap-3 sm:p-4">
        {card.four.map((f) => (
          <li key={`${f.itemType}:${f.itemId}`} className="relative min-w-0">
            <Link href={titlePath(f.itemType, f.itemId, f.name)} className="group block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={f.imageUrl ?? "/no-photo.svg"}
                alt=""
                className="aspect-2/3 w-full rounded-media bg-hover object-cover ring-1 ring-inset ring-line-strong transition-opacity group-hover:opacity-90"
              />
              <span className="mt-1.5 block truncate font-display text-sm text-ink-0 sm:text-base">{f.name}</span>
            </Link>
            <QuickMarkButton title={{ itemId: f.itemId, itemType: f.itemType, itemName: f.name, imageUrl: f.imageUrl }} className="absolute right-1.5 top-1.5" />
          </li>
        ))}
      </ul>

      <div className="border-t border-line px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-ink-300">
            You&apos;ve seen <span className="font-mono tabular-nums text-ink-0">{seen}</span> of their four
            {bothLove.length > 0 && (
              <>
                {" "}
                · <Heart className="inline size-3.5 -translate-y-px fill-accent text-accent" aria-hidden /> you both love {bothLove.length === 1 ? bothLove[0].name : `${bothLove.length} of them`}
              </>
            )}
          </p>
          <span className="flex gap-1" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`size-2 rounded-full ${i < seen ? "bg-action" : "bg-active"}`} />
            ))}
          </span>
        </div>

        <div className="mt-4">
          {!turned ? (
            <div className="flex items-center gap-4">
              <span aria-hidden className="flex size-14 shrink-0 items-center justify-center rounded-full bg-active font-display text-2xl text-ink-400">
                ?
              </span>
              <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                <button type="button" onClick={onTurn} className="inline-flex h-11 items-center gap-2 rounded-full bg-action px-5 font-semibold text-on-action transition-colors hover:bg-action-hover">
                  <RotateCcw className="size-4" aria-hidden />
                  Turn the card
                </button>
                <button type="button" onClick={onNext} className="inline-flex h-11 items-center rounded-full px-5 font-medium text-ink-300 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover hover:text-ink-0">
                  Not my taste
                </button>
              </div>
            </div>
          ) : (
            <div className="animate-fade-in motion-reduce:animate-none">
              {match && (
                <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-action/15 px-3 py-1 text-sm font-semibold text-accent">
                  <Sparkles className="size-4" aria-hidden /> Taste match
                </p>
              )}
              <div className="flex items-center gap-4">
                <Link href={profilePath(card.person.username)} className="shrink-0">
                  <Avatar src={card.person.avatarUrl} name={card.person.username} size={56} />
                </Link>
                <div className="min-w-0">
                  <Link href={profilePath(card.person.username)} className="block truncate font-display text-2xl text-ink-0 hover:underline">
                    {card.person.username}
                  </Link>
                  {card.person.tagline && <p className="truncate text-sm text-ink-400">{card.person.tagline}</p>}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <FollowButton targetUserId={card.person.id} currentUserId={me} initialStatus="follow" onStatusChange={(s) => onFollow(s === "following" || s === "pending")} />
                <Link
                  href={`/app/people/${encodeURIComponent(card.person.username)}`}
                  className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium text-ink-0 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover"
                >
                  <MessageCircle className="size-4" aria-hidden />
                  Say hello
                </Link>
                <button type="button" onClick={onNext} className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-full bg-ink-0 px-4 text-sm font-semibold text-page transition-opacity hover:opacity-90">
                  Next card <ArrowRight className="size-4" aria-hidden />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function End({ met, followed, onAgain }: { met: number; followed: number; onAgain: () => void }) {
  return (
    <div className="mt-8 rounded-card bg-raised p-6 text-center ring-1 ring-inset ring-line-strong">
      <Sparkles className="mx-auto size-6 text-accent" aria-hidden />
      <h2 className="mt-3 text-2xl text-ink-0">That&apos;s the deck</h2>
      <p className="mt-2 text-sm text-ink-400">
        You met {met === 1 ? "one person" : `${met} people`}
        {followed > 0 ? ` and followed ${followed}` : ""}. More fours arrive as people pick theirs.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={onAgain} className="inline-flex h-11 items-center gap-2 rounded-full bg-action px-5 font-semibold text-on-action hover:bg-action-hover">
          <Shuffle className="size-4" aria-hidden /> Deal again
        </button>
        <Link href="/app/people/find" className="inline-flex h-11 items-center rounded-full px-5 font-medium text-ink-0 ring-1 ring-inset ring-line-input hover:bg-hover">
          Find people
        </Link>
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="mt-8 rounded-card bg-raised p-6 ring-1 ring-inset ring-line-strong">
      <h2 className="text-xl text-ink-0">No fours to play with yet</h2>
      <p className="mt-2 text-sm text-ink-400">Once people pick the four films that stand for them, they turn up here. Pick yours, and you&apos;ll be in someone else&apos;s deck.</p>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="mt-10 rounded-card bg-raised p-3 ring-1 ring-inset ring-line-strong sm:p-4" aria-hidden>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="aspect-2/3 animate-pulse rounded-media bg-active motion-reduce:animate-none" />
        ))}
      </div>
    </div>
  );
}
