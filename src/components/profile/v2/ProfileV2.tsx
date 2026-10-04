"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "@components/ui/AppLink";
import Avatar from "@components/ui/Avatar";
import LazyFold from "@components/ds/LazyFold";
import PassSheet from "@components/ds/PassSheet";
import { FollowerBtnClient, ShowFollower, ShowFollowing } from "@components/profile/profileBtn";
import ProfileActionsDropdown from "@components/profile/ProfileActionsDropdown";
import ProfileFavourites from "@components/profile/v2/ProfileFavourites";
import WatchedGrid from "@components/profile/WatchedGrid";
import ProfileTvProgress from "@components/profile/ProfileTvProgress";
import ReviewsSection from "@components/profile/ReviewsSection";
import ProfileLists from "@components/profile/v2/ProfileLists";
import ProfileDiary from "@components/profile/v2/ProfileDiary";
import StatsSection from "@components/profile/StatsSection";
import type { TasteStats } from "@components/profile/stats/types";
import type { UserStats } from "@/utils/userStats";
import { fetchRoom, fetchRoomList } from "@/lib/db/rooms";
import { fetchDiary, fetchWatchCompanions } from "@/lib/db/viewings";
import { stars } from "@/lib/people/moments";
import { names } from "@/lib/people/home";
import { sinceLabel, watchedLabel } from "@components/rooms/time";
import { getPosterUrl } from "@/utils/imageUrl";
import { titlePath } from "@/utils/urls";

/**
 * A profile under `ui=v2` (docs/design/PAGES.md §6).
 *
 * For a visitor: who is this person — their face, then what they love (their
 * four and everything they hearted, with the ones you share marked), then
 * what's between you. For the owner: my record, without settings on the page. No count
 * above the fold; one quiet line of totals at the end. The full library, the
 * diary, reviews, lists and stats are folded and load only when opened.
 *
 * The server passes what it already reads for the old page; everything else
 * is read here under the viewer's own RLS.
 */
export type ProfileV2Data = {
  user: { id: string; username: string; avatarUrl: string | null; tagline: string | null; about: string | null; createdAt: string; visibility: string };
  isOwner: boolean;
  viewerId: string | null;
  canView: boolean;
  isFollowing: boolean;
  four: { position: number; item_id: string; item_type: string; image_url: string | null; item_name: string }[];
  watching: { item_id: string; item_type: string; item_name: string; image_url: string | null }[];
  stats: UserStats;
  /** Diary entries since the first of this month. */
  thisMonth: number;
  followersCount: number;
  followingCount: number;
  tasteStats: TasteStats | null;
};

const quiet = "inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium text-ink-200 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover hover:text-ink-0";
const primary = "inline-flex h-10 items-center justify-center gap-2 rounded-full bg-action px-4 text-sm font-semibold text-on-action transition-colors hover:bg-action-hover";

export default function ProfileV2({ data }: { data: ProfileV2Data }) {
  const { user, isOwner, viewerId, canView } = data;
  const person = { id: user.id, username: user.username, avatarUrl: user.avatarUrl };
  const visitor = !!viewerId && !isOwner;
  const [passing, setPassing] = useState(false);

  const { data: rooms } = useSWR(visitor ? ["rooms", viewerId] : null, () => fetchRoomList(viewerId!), { revalidateOnFocus: false });
  const hasRoom = !!rooms?.rooms.some((r) => r.person.id === user.id);
  const { data: between } = useSWR(visitor && canView ? ["room", viewerId, user.id] : null, () => fetchRoom(viewerId!, user.id), { revalidateOnFocus: false });
  const sharesAnything = !!between && (between.together.length > 0 || between.meet.length > 0);

  // Their colour: the first of their four, or what they're watching.
  const bannerSource = data.four[0]?.image_url ?? data.watching[0]?.image_url ?? null;
  const banner = bannerSource ? getPosterUrl(bannerSource, "w342") : null;
  // UTC on the server and in the browser alike, so the link renders the same in both.
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = `${year}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="flex w-full flex-col pb-16">
      {/* The banner: their own favourite film, blurred to fill the width — the
          person's colour comes from what they love (SYSTEM.md §1.5). */}
      {/* With a banner the header is a dark band, like a title's; without one it sits on the page. */}
      <div {...(banner ? { "data-theme": "dark" } : {})} className={`relative isolate z-10 ${banner ? "bg-page" : ""}`}>
        {banner && (
          // The picture clips itself, so Block and Report can open below the
          // header; the header's z-10 keeps that menu above what follows.
          <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={banner} alt="" decoding="async" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-60" style={{ filter: "blur(64px) saturate(1.5)" }} />
            <div className="absolute inset-0 bg-linear-to-b from-page/10 via-page/50 to-page" />
          </div>
        )}
      <header className="mx-auto flex w-full max-w-app flex-col items-center gap-6 px-4 pb-10 pt-12 text-center sm:flex-row sm:items-end sm:px-6 sm:pt-20 sm:text-left lg:px-8">
        <span className="rounded-full p-1 ring-2 ring-accent/70">
          <Avatar src={user.avatarUrl} name={user.username} size={128} />
        </span>
        <div className="min-w-0">
          <h1 className="break-words text-5xl leading-tight text-ink-0 sm:text-6xl">{user.username}</h1>
          {user.tagline && <p className="mt-1 text-lg text-ink-300">{user.tagline}</p>}
          {canView && <HeroStats username={user.username} stats={data.stats} thisMonth={data.thisMonth} />}
          {user.about && <p className="mt-3 max-w-read font-display text-xl italic leading-relaxed text-ink-300">{user.about}</p>}
          <div className="mt-5 flex flex-wrap justify-center gap-2 sm:justify-start">
            {isOwner ? (
              <Link href="/app/settings" className={quiet}>
                Edit profile
              </Link>
            ) : viewerId ? (
              <>
                {/* Follow is the shared white button; the room is the quieter second action beside it. */}
                <FollowerBtnClient profileId={user.id} currentUserId={viewerId} initialStatus={data.isFollowing ? "following" : "follow"} profileVisibility={user.visibility} />
                {hasRoom ? (
                  <Link href={`/app/people/${encodeURIComponent(user.username)}`} className={quiet}>
                    Open your room
                  </Link>
                ) : (
                  <button type="button" onClick={() => setPassing(true)} className={quiet}>
                    Pass them a film
                  </button>
                )}
                {/* Block and report stay one tap away (RETHINK.md §8, People: keep). */}
                <ProfileActionsDropdown profileId={user.id} currentUserId={viewerId} />
              </>
            ) : (
              <Link href={`/login?next=${encodeURIComponent(`/app/profile/${user.username}`)}`} className={primary}>
                Sign in to follow
              </Link>
            )}
          </div>
        </div>
      </header>
      </div>
      {visitor && <PassSheet open={passing} onClose={() => setPassing(false)} me={viewerId!} to={person} />}
      <div className="mx-auto flex w-full max-w-app flex-col gap-12 px-4 pt-10 sm:px-6 lg:px-8">

      {!canView ? (
        <p className="rounded-card border border-line-strong px-5 py-6 text-base text-ink-400">
          {user.username} shares their films with the people they accept. Follow to ask.
        </p>
      ) : (
        <>
          <ProfileFavourites userId={user.id} username={user.username} isOwner={isOwner} viewerId={viewerId} four={data.four} />

          {sharesAnything && between && (
            <section aria-labelledby="between">
              <h2 id="between" className="text-2xl text-ink-0 sm:text-3xl">
                Between you
              </h2>
              {between.together.length > 0 && (
                <>
                  <p className="mt-1 text-sm text-ink-500">
                    {between.together.length} {between.together.length === 1 ? "film" : "films"} together since{" "}
                    {sinceLabel(between.together[between.together.length - 1].watchedOn)}
                  </p>
                  <ul className="no-scrollbar -mx-4 mt-3 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1">
                    {between.together.slice(0, 12).map((t) => (
                      <li key={t.viewingId} className="w-28 shrink-0 snap-start sm:w-32">
                        <Link href={titlePath(t.itemType, t.itemId, t.itemName)} className="block">
                          <img src={getPosterUrl(t.imageUrl, "w185")} alt={t.itemName} loading="lazy" className="aspect-2/3 w-full rounded-media bg-hover object-cover" />
                          <span className="mt-1.5 block truncate font-mono text-xs uppercase text-ink-500">{watchedLabel(t.watchedOn)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {between.meet.length > 0 && (
                <ul className="mt-4 grid gap-1.5 text-sm text-ink-400">
                  {between.meet.map((m) => (
                    <li key={m.key}>
                      {m.kind === "both" ? "You both gave " : "You split on "}
                      <Link href={titlePath(m.itemType, m.itemId, m.itemName)} className="font-display text-base text-ink-0 hover:underline">
                        {m.itemName}
                      </Link>
                      {m.kind === "both" ? ` ${stars(Math.min(m.mine, m.theirs))}.` : `: you ${stars(m.mine)}, ${user.username} ${stars(m.theirs)}.`}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}


          {data.watching.length > 0 && (
            <section aria-labelledby="watching-now">
              <h2 id="watching-now" className="mb-4 text-2xl text-ink-0 sm:text-3xl">
                Watching now
              </h2>
              <ul className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
                {data.watching.map((w, n) => (
                  <li key={`${w.item_type}:${w.item_id}`} className="w-32 shrink-0 snap-start sm:w-40">
                    <Link href={titlePath(w.item_type === "tv" ? "tv" : "movie", w.item_id, w.item_name)} className="block">
                      <img src={getPosterUrl(w.image_url, "w342")} alt={w.item_name} loading={n < 3 ? "eager" : "lazy"} className="img-fade aspect-2/3 w-full rounded-media bg-hover object-cover" />
                      <span className="mt-2 block truncate font-display text-base text-ink-0">{w.item_name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Recent userId={user.id} />
          <WatchesWith userId={user.id} />

          <div className="flex items-center gap-4 rounded-card border border-line-strong px-4 py-4">
            <span className="font-mono text-xs uppercase tracking-wider text-ink-500">{year}</span>
            <Link href={`/app/profile/${encodeURIComponent(user.username)}/year/${year}`} className="flex-1 text-base text-ink-0 hover:underline">
              {isOwner ? "Your year so far" : `${user.username}'s year so far`}
            </Link>
            {/* A month is private to its owner (the month page says so). */}
            {isOwner && (
              <Link href={`/app/profile/${encodeURIComponent(user.username)}/month/${month}`} className="text-sm text-ink-400 underline decoration-line-input underline-offset-4 hover:text-ink-0">
                This month
              </Link>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {isOwner && (
              <Link href="/app/up-next" className="flex items-center justify-between rounded-card border border-line-strong bg-raised/40 px-4 py-3.5 text-base font-semibold text-ink-0 transition-colors hover:bg-raised sm:px-5">
                Up next
                <span className="text-sm font-normal text-ink-500">{data.stats.watchlistCount ? "Your queue" : "Nothing saved yet"}</span>
              </Link>
            )}
            <LazyFold id="diary" title="Diary" hint="Every viewing, by date">
              <ProfileDiary userId={user.id} isOwner={isOwner} />
            </LazyFold>
            <LazyFold id="watched" title="Watched" hint="Everything, films and series">
              <WatchedGrid userId={user.id} isOwner={isOwner} />
            </LazyFold>
            <LazyFold id="series" title="Series progress" hint="Where they are in each show">
              <ProfileTvProgress userId={user.id} isOwner={isOwner} />
            </LazyFold>
            <LazyFold id="reviews" title="Reviews">
              <ReviewsSection userId={user.id} isOwner={isOwner} />
            </LazyFold>
            <LazyFold id="lists" title="Lists">
              <ProfileLists userId={user.id} isOwner={isOwner} />
            </LazyFold>
            <LazyFold id="stats" title="Stats">
              <StatsSection userId={user.id} isOwner={isOwner} initialData={data.tasteStats} stats={data.stats} />
            </LazyFold>
          </div>
        </>
      )}

      {/* Who follows them and whom they follow: one tap away, at the end, never a headline. */}
      {canView && (data.followersCount > 0 || data.followingCount > 0) && (
        <div className="flex flex-wrap justify-center gap-2">
          <ShowFollower followerCount={data.followersCount} userId={user.id} />
          <ShowFollowing followingCount={data.followingCount} userId={user.id} />
        </div>
      )}
      {/* The counts moved up into the hero; what's left is how long. */}
      {user.createdAt && <p className="text-center text-sm text-ink-500">On letsee since {new Date(user.createdAt).getUTCFullYear()}</p>}
      </div>
    </div>
  );
}

/** Their last few viewings, as stubs: the film, the day, who was there. */
function Recent({ userId }: { userId: string }) {
  const { data } = useSWR(["diary-recent", userId], () => fetchDiary(userId, { limit: 6 }), { revalidateOnFocus: false });
  const rows = (data ?? []).filter((v) => v.itemName);
  if (!rows.length) return null;
  return (
    <section aria-labelledby="recent">
      <h2 id="recent" className="mb-3 text-2xl text-ink-0 sm:text-3xl">
        Lately
      </h2>
      <ol className="grid gap-x-10 divide-y divide-line lg:grid-cols-2 lg:divide-y-0">
        {rows.map((v) => {
          const who = v.companions.map((c) => c.username ?? c.name).filter((x): x is string => !!x);
          return (
            <li key={v.id}>
              <Link href={titlePath(v.itemType, v.itemId, v.itemName)} className="-mx-2 flex items-center gap-3.5 rounded-control px-2 py-2.5 transition-colors hover:bg-raised">
                <img src={getPosterUrl(v.imageUrl, "w92")} alt="" loading="lazy" className="aspect-2/3 w-10 shrink-0 rounded-media bg-hover object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-base text-ink-0">{v.itemName}</span>
                  <span className="block truncate text-xs text-ink-500">
                    <span className="font-mono uppercase tracking-wide">{watchedLabel(v.watchedOn)}</span>
                    {v.rewatch && " · rewatch"}
                    {who.length > 0 && ` · with ${names(who)}`}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** People they've logged films with who are on letsee. */
function WatchesWith({ userId }: { userId: string }) {
  const { data } = useSWR(["watches-with", userId], () => fetchWatchCompanions(userId, 8), { revalidateOnFocus: false });
  const people = (data ?? []).filter((c) => c.username);
  if (!people.length) return null;
  return (
    <section aria-labelledby="watches-with">
      <h2 id="watches-with" className="mb-4 text-2xl text-ink-0 sm:text-3xl">
        Watches with
      </h2>
      <ul className="flex flex-wrap gap-2">
        {people.map((c) => (
          <li key={c.username}>
            <Link
              href={`/app/profile/${encodeURIComponent(c.username!)}`}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-raised pl-1 pr-4 text-sm text-ink-0 ring-1 ring-inset ring-line-strong hover:bg-hover"
            >
              <Avatar src={c.avatarUrl} name={c.username!} size={32} />
              {c.username}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * What someone has watched, in a few numbers, where you look first: films,
 * series, favourites, episodes, and this month (or this year, when the month is still
 * empty — a zero greeting a visitor says nothing). Each one is a door: films
 * and series open those sections below (their anchors, LazyFold), the month
 * and year open their recaps. Shown only to people who may see the profile.
 */
function HeroStats({ username, stats, thisMonth }: { username: string; stats: UserStats; thisMonth: number }) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const monthKey = `${year}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const base = `/app/profile/${encodeURIComponent(username)}`;
  const n = (v: number) => v.toLocaleString("en-GB");
  const items = [
    { value: stats.movieCount, label: stats.movieCount === 1 ? "film" : "films", href: "#watched" },
    { value: stats.tvCount, label: "series", href: "#series" },
    // What they love, beside what they've watched: the section it opens is the first one under the header.
    stats.favoriteCount > 0 ? { value: stats.favoriteCount, label: stats.favoriteCount === 1 ? "favourite" : "favourites", href: "#favourites" } : null,
    stats.episodesCount > 0 ? { value: stats.episodesCount, label: stats.episodesCount === 1 ? "episode" : "episodes", href: "#series" } : null,
    thisMonth > 0
      ? { value: thisMonth, label: "this month", href: `${base}/month/${monthKey}` }
      : stats.watchedThisYear > 0
        ? { value: stats.watchedThisYear, label: `in ${year}`, href: `${base}/year/${year}` }
        : null,
  ].filter((x): x is { value: number; label: string; href: string } => !!x);
  if (!stats.movieCount && !stats.tvCount && !thisMonth) return null;
  return (
    <ul className="mt-5 flex flex-wrap justify-center gap-x-7 gap-y-3 sm:justify-start" aria-label="What they've watched">
      {items.map((s) => (
        <li key={s.label}>
          {s.href.startsWith("#") ? (
            <a href={s.href} className="group block text-center sm:text-left">
              <span className="block font-display text-3xl leading-none tabular-nums text-ink-0 sm:text-4xl">{n(s.value)}</span>
              <span className="mt-1 block text-xs uppercase tracking-wider text-ink-400 group-hover:text-ink-200">{s.label}</span>
            </a>
          ) : (
            <Link href={s.href} className="group block text-center sm:text-left">
              <span className="block font-display text-3xl leading-none tabular-nums text-ink-0 sm:text-4xl">{n(s.value)}</span>
              <span className="mt-1 block text-xs uppercase tracking-wider text-ink-400 group-hover:text-ink-200">{s.label}</span>
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
