"use client";

import { useContext, useMemo, useState } from "react";
import useSWR from "swr";
import toast from "react-hot-toast";
import { Check, LoaderCircle } from "lucide-react";
import { episodesFetcher, type Episode } from "@components/ds/UpNextRows";
import { episodeLabel } from "@/lib/logging/episodes";
import Link from "@components/ui/AppLink";
import Avatar from "@components/ui/Avatar";
import Mark from "@components/ds/Mark";
import PassSheet from "@components/ds/PassSheet";
import RequestRow from "@components/rooms/RequestRow";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import UserPrefrenceContext from "@/app/contextAPI/userPrefrence";
import { fetchRoomList, type Pass, type Request, type RoomPerson } from "@/lib/db/rooms";
import { fetchPeopleActivity } from "@/lib/db/peopleActivity";
import { fetchMemories } from "@/lib/db/memories";
import { fetchCurrentlyWatching } from "@/lib/db/home";
import { dayPartOf, groupWeek, personLine } from "@/lib/people/home";
import { lastNightIntent } from "@/lib/people/lastNight";
import { getPosterUrl } from "@/utils/imageUrl";
import { titlePath } from "@/utils/urls";
import { fetchCommunity } from "@/lib/db/community";
import Discover from "@components/rooms/Discover";
import AsksForYou from "@components/rooms/AsksForYou";
import TitleCard from "@components/ds/TitleCard";
import BecauseYouLove from "./BecauseYouLove";
import NewOnYourServices from "@components/home/NewOnYourServices";
import { useSearchIndex } from "@components/header/useSearchIndex";
import Rail from "@components/ds/Rail";
import {
  CommunityLately,
  Hero,
  LastNightCard,
  MemoryCard,
  PopularHere,
  NextStep,
  PassRow,
  PeopleRow,
  SectionTitle,
  TonightCard,
  WeekList,
  buttonClass,
  inviteSomeone,
  type TonightPick,
} from "./parts";

/**
 * Home under `ui=v2` (docs/design/RETHINK.md §3, PAGES.md §1).
 *
 * The top answers the question a person has at that hour — the evening's
 * film, last night's log, or whoever is waiting on you — and the rest is your
 * people: what is waiting on you, who they are, what they watched this week,
 * and a memory. It ends. No trending, no genres, no strangers, no counts.
 *
 * Everything is read in the browser under the viewer's own RLS and the
 * device's clock decides the first card, so the cached page around it is the
 * same for everyone and this costs no server work.
 */
type Waiting = { kind: "request"; request: Request; at: string } | { kind: "pass"; pass: Pass & { person: RoomPerson }; at: string };

const HIDDEN_MEMORIES = "letsee:memories-hidden";

function readHidden(): number[] {
  try {
    return JSON.parse(window.localStorage.getItem(HIDDEN_MEMORIES) ?? "[]") as number[];
  } catch {
    return [];
  }
}

export default function HomeV2() {
  const { user, status } = useAuth();
  const me = status === "ok" ? user?.id ?? null : null;
  const { getStatus } = useContext(UserPrefrenceContext);

  const { data: list, mutate } = useSWR(me ? ["rooms", me] : null, () => fetchRoomList(me!), { revalidateOnFocus: false });
  const ids = useMemo(() => (list?.people ?? []).slice(0, 24).map((p) => p.person.id), [list]);
  const { data: activity } = useSWR(me && list ? ["people-activity", me, ids.join(",")] : null, () => fetchPeopleActivity(ids), {
    revalidateOnFocus: false,
  });
  const { data: watching } = useSWR(me ? ["watching", me] : null, () => fetchCurrentlyWatching(me!), { revalidateOnFocus: false });
  const { data: memories } = useSWR(me ? ["memories", me, new Date().toDateString()] : null, () => fetchMemories(me!), {
    revalidateOnFocus: false,
  });
  // The wider room: what everyone on letsee has been watching this week.
  const { data: community } = useSWR(me ? ["community", me] : null, () => fetchCommunity(me), { revalidateOnFocus: false });
  // The cached catalog Search already loads; trending costs no extra request.
  const index = useSearchIndex(!!me);
  /**
   * The show you're on: which episode is next, so the hero can name it and
   * tick it off. The same request and cache entry as Up next and the Log it
   * sheet, made only when what you're watching most recently is a series.
   */
  const { data: episodes, mutate: refreshEpisodes } = useSWR<{ items: Episode[] }>(
    me && watching?.[0]?.item_type === "tv" ? "/api/continue-watching" : null,
    episodesFetcher,
    { revalidateOnFocus: false },
  );

  // The device's clock, read once: the first card does not change under you.
  const [part] = useState(() => dayPartOf(new Date().getHours()));
  const [intent, setIntent] = useState(() => (part === "morning" ? lastNightIntent() : null));
  const [hidden, setHidden] = useState<number[]>(readHidden);
  const [passing, setPassing] = useState(false);

  if (status === "anon") return <SignedOutDoor />;
  if (status !== "ok" || !list) return <HomeSkeleton />;

  const people = list.people;
  const firstWeek = people.length < 3;
  const peopleById = new Map(people.map((p) => [p.person.id, p.person]));

  const waiting: Waiting[] = [
    ...list.requests.map((r) => ({ kind: "request" as const, request: r, at: r.at })),
    ...list.passesToMe.slice(0, 10).map((p) => ({ kind: "pass" as const, pass: p, at: p.at })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  // The first card, by time of day, only with something real behind it.
  const lastNight = intent && getStatus(intent.itemId, intent.itemType) !== "watched" ? intent : null;
  let tonight: TonightPick | null = null;
  if (part === "evening") {
    const show = (watching ?? []).find((w) => w.item_type === "tv");
    if (list.passesToMe[0]) tonight = { kind: "pass", pass: list.passesToMe[0] };
    else if (show) tonight = { kind: "watching", item: show };
  }
  const leadWaiting = !lastNight && !tonight ? waiting[0] : null;
  const restWaiting = waiting.filter((w) => w !== leadWaiting && !(tonight?.kind === "pass" && w.kind === "pass" && w.pass.id === tonight.pass.id)).slice(0, 3);

  const passedYou = (id: string) => list.passesToMe.filter((p) => p.person.id === id);
  const row = people.slice(0, 8).map((room) => ({
    room,
    line: activity ? personLine(room.person.id, activity.viewings, activity.watching, passedYou(room.person.id)) : null,
  }));
  const week = activity ? groupWeek(activity.viewings).slice(0, 12) : [];
  const memory = (memories ?? []).find((m) => !hidden.includes(m.id));
  const decideWith = people.slice(0, 3).map((p) => p.person);

  const hideMemory = (id: number) => {
    const next = [id, ...hidden].slice(0, 100);
    setHidden(next);
    try {
      window.localStorage.setItem(HIDDEN_MEMORIES, JSON.stringify(next));
    } catch {
      // Hidden for this visit only.
    }
  };

  const waitingList = (items: Waiting[]) => (
    <ul className="divide-y divide-line rounded-card border border-line-strong bg-raised">
      {items.map((w) =>
        w.kind === "request" ? (
          <RequestRow key={w.request.kind === "follow" ? `f${w.request.id}` : `w${w.request.viewingId}`} request={w.request} onDone={() => void mutate()} />
        ) : (
          <PassRow key={`p${w.pass.id}`} pass={w.pass} />
        ),
      )}
    </ul>
  );

  const greeting = `${part === "morning" ? "Good morning" : part === "evening" ? "Good evening" : "Hello"}${user?.username ? `, ${user.username}` : ""}`;
  const current = (watching ?? [])[0];
  const showProgress = current ? (episodes?.items ?? []).find((e) => e.show_id === String(current.item_id)) : undefined;
  const nextUp = showProgress && showProgress.can_mark_next && !showProgress.is_caught_up ? showProgress.up_next[0] ?? null : null;
  // The evening card's series, if that's what it leads with: its next episode too.
  const tonightShow = tonight?.kind === "watching" ? (episodes?.items ?? []).find((e) => e.show_id === String(tonight.item.item_id)) : undefined;
  const tonightEp = tonightShow && tonightShow.can_mark_next && !tonightShow.is_caught_up ? tonightShow.up_next[0] ?? null : null;
  const tonightNext =
    tonight?.kind === "watching" && tonightEp
      ? { label: episodeLabel(tonightEp), action: <NextEpisodeButton showId={String(tonight.item.item_id)} ep={tonightEp} onChanged={() => void refreshEpisodes()} /> }
      : null;
  const popular = community?.popular ?? [];
  // Whole rows at four across (and nearly so at three): twelve, eight or four.
  const allLately = community?.lately ?? [];
  const lately = allLately.slice(0, allLately.length >= 4 ? Math.min(12, Math.floor(allLately.length / 4) * 4) : allLately.length);
  const known = new Set(people.map((p) => p.person.id));
  const trending = (index?.rows ?? []).filter((r) => !r.lib && (r.t === "movie" || r.t === "tv")).slice(0, 18);

  return (
    <div className="flex w-full flex-col pb-16">
      <h1 className="sr-only">Home</h1>

      {/* The first thing on Home is always a film, full bleed. */}
      {lastNight ? (
        <LastNightCard intent={lastNight} onDone={() => setIntent(null)} />
      ) : tonight ? (
        <TonightCard pick={tonight} decideWith={decideWith} next={tonightNext} />
      ) : current ? (
        <Hero
          poster={getPosterUrl(current.image_url, "w500")}
          eyebrow={current.item_type === "tv" && nextUp ? `${greeting} · ${episodeLabel(nextUp)} next` : `${greeting} · Pick up where you left off`}
          title={current.item_name}
          name={current.item_name}
          href={titlePath(current.item_type === "tv" ? "tv" : "movie", current.item_id, current.item_name)}
          labelledBy="hero"
        >
          <div className="mt-5 flex flex-wrap gap-2">
            {current.item_type === "tv" && nextUp ? (
              <NextEpisodeButton showId={String(current.item_id)} ep={nextUp} onChanged={() => void refreshEpisodes()} />
            ) : (
              <Link href={titlePath(current.item_type === "tv" ? "tv" : "movie", current.item_id, current.item_name)} className={buttonClass.primary}>
                {current.item_type === "tv" ? `Open ${current.item_name}` : "Where to watch"}
              </Link>
            )}
            {decideWith.length > 0 && (
              <Link href="/app/tonight" className={buttonClass.quiet}>
                Decide tonight
              </Link>
            )}
          </div>
        </Hero>
      ) : popular[0] ? (
        <Hero
          poster={getPosterUrl(popular[0].imageUrl, "w500")}
          eyebrow={`${greeting} · Popular on letsee`}
          title={popular[0].itemName}
          name={popular[0].itemName}
          href={titlePath(popular[0].itemType, popular[0].itemId, popular[0].itemName)}
          labelledBy="hero"
        >
          <p className="mt-3 text-base text-ink-300 sm:text-lg">{popular[0].people.length} people here watched it lately.</p>
        </Hero>
      ) : (
        <div className="mx-auto w-full max-w-app px-4 pt-10 sm:px-6 lg:px-8">
          <p className="font-mono text-xs uppercase tracking-wider text-accent">{greeting}</p>
        </div>
      )}

      <div className="mx-auto grid w-full max-w-app gap-12 px-4 pt-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16 lg:px-8">
        <div className="flex min-w-0 flex-col gap-14">
          {leadWaiting && (lastNight || tonight || current || popular[0]) ? (
            <section aria-labelledby="waiting-first">
              <SectionTitle>
                <span id="waiting-first">Waiting on you</span>
              </SectionTitle>
              {waitingList([leadWaiting, ...restWaiting])}
            </section>
          ) : (
            <>
              {leadWaiting && waitingList([leadWaiting])}
              {restWaiting.length > 0 && (
                <section aria-labelledby="waiting">
                  <SectionTitle>
                    <span id="waiting">Waiting on you</span>
                  </SectionTitle>
                  {waitingList(restWaiting)}
                </section>
              )}
            </>
          )}
          {waiting.length > restWaiting.length + (leadWaiting ? 1 : 0) + (tonight?.kind === "pass" ? 1 : 0) && (
            <Link href="/app/people" className="-mt-10 inline-block text-sm text-ink-400 underline decoration-line-input underline-offset-4 hover:text-ink-0">
              The rest are in People
            </Link>
          )}

          {me && <AsksForYou me={me} />}

          {firstWeek ? (
            <FirstWeek username={user?.username ?? null} named={list.named} people={people.map((p) => p.person)} />
          ) : (
            <section aria-labelledby="your-people">
              <SectionTitle>
                <span id="your-people">Your people</span>
              </SectionTitle>
              <PeopleRow people={row} />
            </section>
          )}

          {week.length > 0 && (
            <section aria-labelledby="this-week">
              <SectionTitle>
                <span id="this-week">This week</span>
              </SectionTitle>
              <WeekList groups={week} people={peopleById} />
            </section>
          )}

          {(watching ?? []).length > (current && !lastNight && !tonight ? 1 : 0) && (
            <section aria-labelledby="watching">
              <SectionTitle>
                <span id="watching">What you’re watching</span>
              </SectionTitle>
              <Rail>
                <ul className="no-scrollbar -mx-4 flex snap-x scroll-px-4 sm:scroll-px-6 lg:scroll-px-8 gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
                  {/* Not the one the hero already shows. */}
                  {(watching ?? []).slice(current && !lastNight && !tonight ? 1 : 0, 12).map((w) => (
                    <li key={`${w.item_type}:${w.item_id}`} className="w-36 shrink-0 snap-start sm:w-44">
                      <Link href={titlePath(w.item_type === "tv" ? "tv" : "movie", w.item_id, w.item_name)} className="group block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={getPosterUrl(w.image_url, "w342")} alt="" loading="lazy" className="img-fade aspect-2/3 w-full rounded-media bg-raised object-cover ring-1 ring-inset ring-line transition-opacity group-hover:opacity-90" />
                        <span className="mt-2 block truncate font-display text-base text-ink-0">{w.item_name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Rail>
            </section>
          )}

          {popular.length > (current || lastNight || tonight ? 0 : 1) && (
            <section aria-labelledby="popular-here">
              <SectionTitle>
                <span id="popular-here">Popular on letsee</span>
              </SectionTitle>
              <PopularHere titles={current || lastNight || tonight ? popular : popular.slice(1)} />
            </section>
          )}

          {lately.length > 0 && (
            <section aria-labelledby="lately">
              <SectionTitle>
                <span id="lately">On letsee lately</span>
              </SectionTitle>
              <CommunityLately logs={lately} />
            </section>
          )}

          {/* From your favourites; below the community row, so its late arrival doesn't push the top of Home down. */}
          {me && <BecauseYouLove me={me} />}

          <NewOnYourServices />

          {trending.length > 0 && (
            <section aria-labelledby="trending">
              <SectionTitle
                more={
                  <Link href="/app/search?browse=1" className="text-sm text-ink-400 underline decoration-line-input underline-offset-4 hover:text-ink-0">
                    Browse everything
                  </Link>
                }
              >
                <span id="trending">Trending now</span>
              </SectionTitle>
              <Rail>
                <ul className="no-scrollbar -mx-4 flex snap-x scroll-px-4 sm:scroll-px-6 lg:scroll-px-8 gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
                  {trending.map((r) => {
                    const [type, id] = r.k.split(":");
                    return (
                      <li key={r.k} className="w-36 shrink-0 snap-start sm:w-44">
                        <TitleCard id={id} title={r.n} mediaType={type === "tv" ? "tv" : "movie"} imageUrl={getPosterUrl(r.p ?? null, "w342")} year={r.y ? String(r.y) : null} />
                      </li>
                    );
                  })}
                </ul>
              </Rail>
            </section>
          )}

          {memory && <MemoryCard memory={memory} onHide={() => hideMemory(memory.id)} />}
        </div>

        <aside className="flex flex-col gap-10 lg:pt-1">
          {me && <Discover me={me} known={known} className="" />}
          {list.diaryEmpty ? (
            <NextStep
              title="Bring your history"
              body="Letterboxd, Trakt, TV Time, IMDb or Netflix. Your diary arrives with its dates."
              action={
                <Link href="/app/import" className={buttonClass.primary}>
                  Bring it in
                </Link>
              }
            />
          ) : (
            // Not an invite in the first week: "Who do you watch with?" above
            // already is one, and the same card twice reads as nagging.
            <NextStep
              title="Pass something on"
              body={firstWeek ? "A film you think someone would love — send it as a link if they're not here yet." : "A film you think one of your people would love. They’ll find it in Up next, from you."}
              action={
                <button type="button" onClick={() => setPassing(true)} className={buttonClass.quiet}>
                  Pass a film
                </button>
              }
            />
          )}
        </aside>
      </div>
      {me && <PassSheet open={passing} onClose={() => setPassing(false)} me={me} />}
    </div>
  );
}

function FirstWeek({
  username,
  named,
  people,
}: {
  username: string | null;
  named: { name: string; viewings: number }[];
  people: RoomPerson[];
}) {
  return (
    <section aria-labelledby="first-people" className="flex flex-col gap-4">
      <div>
        <h2 id="first-people" className="text-2xl text-ink-0 sm:text-3xl">
          Who do you watch with?
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-400">
          letsee is for the films you watch and the people you watch them with. Start with one person.
        </p>
      </div>
      {people.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {people.map((p) => (
            <li key={p.id}>
              <Link href={`/app/people/${encodeURIComponent(p.username)}`} className="inline-flex h-10 items-center gap-2 rounded-full bg-raised pl-1 pr-4 text-sm text-ink-0 ring-1 ring-inset ring-line-strong hover:bg-hover">
                <Avatar src={p.avatarUrl} name={p.username} size={32} />
                {p.username}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void inviteSomeone(username)} className={buttonClass.primary}>
          Invite someone
        </button>
        <Link href="/app/people" className={buttonClass.quiet}>
          Find people you know
        </Link>
      </div>
      {named.length > 0 && (
        <div className="rounded-card border border-line-strong px-4 py-3">
          <p className="text-xs font-medium text-ink-500">Names you’ve watched with</p>
          <ul className="mt-2 divide-y divide-line">
            {named.slice(0, 5).map((n) => (
              <li key={n.name} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-base text-ink-0">
                  {n.name} <span className="text-sm text-ink-500">· {n.viewings === 1 ? "one film" : `${n.viewings} films`}</span>
                </span>
                <button type="button" onClick={() => void inviteSomeone(username)} className="rounded-full px-3 py-1.5 text-sm font-medium text-ink-200 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0">
                  Invite
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Signed out on /app: the front door's one screen (RETHINK.md §3a); `/` gets the full door in step 9. */
function SignedOutDoor() {
  return (
    <div className="mx-auto grid w-full max-w-read gap-6 px-4 py-16 sm:py-24">
      <Mark withName={false} size="lg" />
      <h1 className="text-4xl leading-tight text-ink-0 sm:text-5xl">Keep the films you watch, and the people you watch them with.</h1>
      <ul className="grid gap-2 text-base text-ink-400">
        <li>Log in one tap, and say who was there.</li>
        <li>Pass a film to a friend, and find out when they watch it.</li>
        <li>Decide tonight’s film together.</li>
      </ul>
      <div className="flex flex-wrap gap-2">
        <Link href="/signup" className={buttonClass.primary}>
          Start with someone
        </Link>
        <Link href="/login?next=/app" className={buttonClass.quiet}>
          Sign in
        </Link>
      </div>
      <p className="text-sm text-ink-500">
        Bring your history from Letterboxd, Trakt, TV Time, IMDb or Netflix.
      </p>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-app gap-8 px-4 pb-16 pt-10 sm:px-6 lg:px-8" aria-hidden>
      <div className="h-72 rounded-card bg-raised" />
      <div className="flex gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="grid w-24 justify-items-center gap-2">
            <div className="size-14 rounded-full bg-raised" />
            <div className="h-3 w-16 rounded bg-raised" />
          </div>
        ))}
      </div>
      <div className="grid gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 rounded-card bg-raised" />
        ))}
      </div>
    </div>
  );
}

/**
 * The hero's one tap for the show you're on: marks the next episode, with
 * Undo. Through the toggle route, like the title page's button, and busy until
 * the next episode is known — a second tap on the old label would toggle the
 * episode it just marked back off.
 */
function NextEpisodeButton({ showId, ep, onChanged }: { showId: string; ep: { s: number; e: number }; onChanged: () => Promise<unknown> | void }) {
  const { refreshPreferences } = useContext(UserPrefrenceContext);
  const [busy, setBusy] = useState(false);
  const toggle = () =>
    fetch("/api/watched-episode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showId, seasonNumber: ep.s, episodeNumber: ep.e }),
    }).then((r) => r.ok, () => false);
  const mark = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await toggle();
    if (!ok) {
      setBusy(false);
      toast.error("That didn't save. Check your connection.");
      return;
    }
    await Promise.all([onChanged(), refreshPreferences()]).catch(() => {});
    setBusy(false);
    toast(
      (t) => (
        <span className="flex items-center gap-3">
          Marked {episodeLabel(ep)}
          <button
            type="button"
            className="rounded-full px-3 py-1 font-medium ring-1 ring-inset ring-line-input"
            onClick={async () => {
              toast.dismiss(t.id);
              if (await toggle()) await Promise.all([onChanged(), refreshPreferences()]).catch(() => {});
              else toast.error("Couldn't undo that.");
            }}
          >
            Undo
          </button>
        </span>
      ),
      { duration: 6000 },
    );
  };
  return (
    <button type="button" onClick={() => void mark()} disabled={busy} className={`${buttonClass.primary} disabled:opacity-60`}>
      {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
      Watched <span className="font-mono text-sm tracking-wide">{episodeLabel(ep)}</span>
    </button>
  );
}
