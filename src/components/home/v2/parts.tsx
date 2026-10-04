"use client";

import { useState } from "react";
import useSWR from "swr";
import toast from "react-hot-toast";
import { X } from "lucide-react";
import Link from "@components/ui/AppLink";
import Avatar from "@components/ui/Avatar";
import Faces from "@components/ds/Faces";
import FilmLight from "@components/ds/FilmLight";
import { fetchRoomCompanions, logViewing } from "@/lib/db/viewings";
import type { Pass, RoomPerson, RoomSummary } from "@/lib/db/rooms";
import type { Memory } from "@/lib/db/memories";
import type { WatchingItem } from "@/lib/db/home";
import { answerLastNight, type Opened } from "@/lib/people/lastNight";
import { inviteUrl } from "@/lib/people/invite";
import { names, whenWatched, type WeekGroup } from "@/lib/people/home";
import { getPosterUrl } from "@/utils/imageUrl";
import { titlePath } from "@/utils/urls";
import { tonightHref } from "@/lib/people/tonight";
import TitleCard from "@components/ds/TitleCard";
import type { CommunityLog, CommunityTitle } from "@/lib/db/community";

import Rail from "@components/ds/Rail";
/**
 * The pieces of Home (docs/design/PAGES.md §1). Each renders only with
 * something real behind it; the page decides which appear and in what order.
 */

const primary = "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-action px-5 text-sm font-semibold text-on-action transition-colors hover:bg-action-hover disabled:opacity-60";
const quiet = "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-page/40 px-5 text-sm font-medium text-ink-0 ring-1 ring-inset ring-line-input backdrop-blur transition-colors hover:bg-hover disabled:opacity-60";

export function SectionTitle({ children, more }: { children: React.ReactNode; more?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-4">
      <h2 className="text-2xl text-ink-0 sm:text-3xl">{children}</h2>
      {more}
    </div>
  );
}

/* ── The hero ───────────────────────────────────────────────────────────── */

/**
 * The top of Home: one film, full bleed, lit by its own poster blurred to
 * fill the screen (the film's light, SYSTEM.md §1.5) — the same image the
 * page already shows, so no extra request. Everything above the fold on Home
 * is about a film and a person, never a form.
 */
export function Hero({ poster, eyebrow, title, href, labelledBy, name, children }: { poster: string; eyebrow: React.ReactNode; title: React.ReactNode; href: string; labelledBy: string; /** The title in words, for the poster link's name. */ name: string; children?: React.ReactNode }) {
  return (
    <section aria-labelledby={labelledBy} data-theme="dark" className="relative isolate overflow-hidden bg-page">
      <div aria-hidden className="absolute inset-0 -z-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={poster} alt="" decoding="async" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-70" style={{ filter: "blur(64px) saturate(1.6)" }} />
        <div className="absolute inset-0 bg-linear-to-b from-page/20 via-page/50 to-page" />
        <div className="absolute inset-0 bg-linear-to-r from-page/60 via-page/10 to-transparent" />
      </div>
      <div className="mx-auto flex max-w-app items-end gap-5 px-4 pb-10 pt-10 sm:gap-8 sm:px-6 sm:pb-16 sm:pt-16 lg:px-8">
        <Link href={href} aria-label={`Open ${name}`} className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={poster} alt="" className="img-fade aspect-2/3 w-28 rounded-media object-cover shadow-2xl ring-1 ring-inset ring-line-strong sm:w-44 lg:w-56" />
        </Link>
        <div className="min-w-0 pb-1">
          <p className="font-mono text-xs uppercase tracking-wider text-accent">{eyebrow}</p>
          <h2 id={labelledBy} className="mt-2 text-3xl leading-tight text-ink-0 sm:text-5xl lg:text-6xl">
            {title}
          </h2>
          {children}
        </div>
      </div>
    </section>
  );
}

function yesterdayIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/* ── The first card ─────────────────────────────────────────────────────── */

export type TonightPick =
  | { kind: "pass"; pass: Pass & { person: RoomPerson } }
  | { kind: "watching"; item: WatchingItem };

/** Evening: one suggestion, lit by the film, and the people to decide with. */
export function TonightCard({
  pick,
  decideWith,
  next,
}: {
  pick: TonightPick;
  decideWith: RoomPerson[];
  /**
   * A series you're on, in the evening: its next episode and the one-tap
   * button for it — the same as the daytime card, so the evening doesn't lose
   * the one thing you'd actually do with it.
   */
  next?: { label: string; action: React.ReactNode } | null;
}) {
  const t =
    pick.kind === "pass"
      ? { id: pick.pass.itemId, type: pick.pass.itemType, name: pick.pass.itemName, image: pick.pass.imageUrl }
      : { id: pick.item.item_id, type: pick.item.item_type === "tv" ? "tv" : "movie", name: pick.item.item_name, image: pick.item.image_url };
  const poster = getPosterUrl(t.image, "w500");
  return (
    <Hero poster={poster} eyebrow="Tonight" title={t.name} name={t.name} href={titlePath(t.type, t.id, t.name)} labelledBy="tonight">
      {pick.kind === "pass" ? (
        <p className="mt-3 max-w-read text-base text-ink-300 sm:text-lg">
          <span className="font-medium text-ink-0">{pick.pass.person.username}</span> passed you this
          {pick.pass.note && <span className="mt-1 block font-display text-xl italic text-ink-0">“{pick.pass.note}”</span>}
        </p>
      ) : next ? (
        <p className="mt-3 max-w-read text-base text-ink-300 sm:text-lg">{next.label} is next.</p>
      ) : (
        <p className="mt-3 max-w-read text-base text-ink-300 sm:text-lg">You’re part-way through. Pick up where you left off.</p>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        {next ? (
          next.action
        ) : (
          <Link href={titlePath(t.type, t.id, t.name)} className={primary}>
            Where to watch
          </Link>
        )}
        {decideWith.length > 0 && (
          <Link href={tonightHref(decideWith.map((p) => p.username))} className={quiet}>
            <Faces people={decideWith} size={20} />
            Decide with…
          </Link>
        )}
      </div>
    </Hero>
  );
}

/** The morning after: did last night's intent happen? One tap logs it for yesterday. */
export function LastNightCard({ intent, onDone }: { intent: Opened; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const { data: companions } = useSWR(["room-companions", intent.itemType, intent.itemId], () => fetchRoomCompanions(intent.itemId, intent.itemType), {
    revalidateOnFocus: false,
  });
  const with_ = (companions ?? []).filter((c): c is { userId: string; username: string; avatarUrl: string | null } => !!c.username).slice(0, 3);
  const answer = async (watched: boolean, together: boolean) => {
    if (busy) return;
    if (watched) {
      setBusy(true);
      const { error } = await logViewing({
        itemId: intent.itemId,
        itemType: intent.itemType,
        itemName: intent.itemName,
        imageUrl: intent.imageUrl,
        watchedOn: yesterdayIso(),
        companions: together ? with_.map((c) => ({ userId: c.userId })) : [],
      });
      setBusy(false);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Logged for last night");
    }
    answerLastNight(intent);
    onDone();
  };

  return (
    <Hero poster={getPosterUrl(intent.imageUrl, "w500")} eyebrow="Last night" title={<>Did you watch <span className="italic">{intent.itemName}</span>?</>} href={titlePath(intent.itemType, intent.itemId, intent.itemName)} name={intent.itemName} labelledBy="last-night">
      <div className="mt-5 flex flex-wrap gap-2">
        {with_.length > 0 ? (
          <>
            <button type="button" disabled={busy} onClick={() => answer(true, true)} className={primary}>
              Yes, with {names(with_.map((c) => c.username))}
            </button>
            <button type="button" disabled={busy} onClick={() => answer(true, false)} className={quiet}>
              Yes, alone
            </button>
          </>
        ) : (
          <button type="button" disabled={busy} onClick={() => answer(true, false)} className={primary}>
            Yes
          </button>
        )}
        <button type="button" disabled={busy} onClick={() => answer(false, false)} className="inline-flex h-11 items-center rounded-full px-4 text-sm font-medium text-ink-300 hover:bg-hover hover:text-ink-0">
          No
        </button>
      </div>
    </Hero>
  );
}

/* ── Waiting on you ─────────────────────────────────────────────────────── */

export function PassRow({ pass }: { pass: Pass & { person: RoomPerson } }) {
  const href = titlePath(pass.itemType, pass.itemId, pass.itemName);
  return (
    <li className="flex items-center gap-3.5 px-4 py-3.5">
      <Link href={href} aria-label={`Open ${pass.itemName}`} className="shrink-0">
        <img src={getPosterUrl(pass.imageUrl, "w92")} alt="" loading="lazy" className="aspect-2/3 w-10 rounded-media bg-hover object-cover" />
      </Link>
      <p className="min-w-0 flex-1 text-sm text-ink-400">
        <Link href={`/app/people/${encodeURIComponent(pass.person.username)}`} className="font-semibold text-ink-0 hover:underline">
          {pass.person.username}
        </Link>{" "}
        passed you <em className="font-display text-base not-italic text-ink-0">{pass.itemName}</em>
        {pass.note && <span className="mt-0.5 block truncate font-display text-base italic text-ink-300">“{pass.note}”</span>}
      </p>
      <Link href={href} className="inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-sm font-medium text-ink-200 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0">
        Open
      </Link>
    </li>
  );
}

/* ── Your people ────────────────────────────────────────────────────────── */

export function PeopleRow({ people }: { people: { room: RoomSummary; line: string | null }[] }) {
  return (
    <Rail>
      <ul className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1">
        {people.map(({ room, line }) => (
          <li key={room.person.id} className="w-32 shrink-0 snap-start">
            <Link href={`/app/people/${encodeURIComponent(room.person.username)}`} className="block rounded-card px-1 py-2 text-center transition-colors hover:bg-raised">
              <span className="relative mx-auto block w-fit">
                <span className="block rounded-full p-0.5 ring-2 ring-accent/70">
                  <Avatar src={room.person.avatarUrl} name={room.person.username} size={80} />
                </span>
                {room.unread && <span className="absolute right-1 top-1 size-3.5 rounded-full bg-accent ring-2 ring-page" aria-label="Something new" />}
              </span>
              <span className="mt-2 block truncate text-sm font-medium text-ink-0">{room.person.username}</span>
              {line && <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-ink-500">{line}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </Rail>
  );
}

/* ── This week ──────────────────────────────────────────────────────────── */

export function WeekList({ groups, people, end = "That’s everyone this week." }: { groups: WeekGroup[]; people: Map<string, RoomPerson>; end?: string | null }) {
  return (
    <>
      <ol className="grid gap-1">
        {groups.map((g) => {
          const who = g.userIds.map((id) => people.get(id)).filter((p): p is RoomPerson => !!p);
          if (!who.length) return null;
          return (
            <li key={`${g.itemType}:${g.itemId}`}>
              <Link href={titlePath(g.itemType, g.itemId, g.itemName)} className="-mx-2 flex items-center gap-3.5 rounded-card px-2 py-2 transition-colors hover:bg-raised">
                <img src={getPosterUrl(g.imageUrl, "w92")} alt="" loading="lazy" className="aspect-2/3 w-11 shrink-0 rounded-media bg-hover object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-ink-400">
                    <span className="font-medium text-ink-0">{names(who.map((p) => p.username))}</span> watched{" "}
                    <em className="font-display text-base not-italic text-ink-0">{g.itemName}</em>
                  </span>
                  <span className="mt-0.5 block font-mono text-xs uppercase tracking-wide text-ink-500">{whenWatched(g.latest)}</span>
                </span>
                <Faces people={who} />
              </Link>
            </li>
          );
        })}
      </ol>
      {end && <p className="mt-4 text-sm text-ink-500">{end}</p>}
    </>
  );
}

/* ── A memory ───────────────────────────────────────────────────────────── */

export function MemoryCard({ memory, onHide }: { memory: Memory; onHide: () => void }) {
  const poster = getPosterUrl(memory.image, "w342");
  const when = memory.yearsAgo === 1 ? "A year ago today" : `${memory.yearsAgo} years ago today`;
  return (
    <section aria-label="A memory" data-theme="dark" className="relative overflow-hidden rounded-card border border-line-strong bg-raised">
      <FilmLight src={poster} strength={0.25} />
      <div className="relative flex items-center gap-4 p-4">
        <Link href={titlePath(memory.itemType, memory.itemId, memory.name)} aria-label={`Open ${memory.name}`} className="shrink-0">
          <img src={poster} alt="" loading="lazy" className="aspect-2/3 w-14 rounded-media object-cover ring-1 ring-line-strong" />
        </Link>
        <p className="min-w-0 flex-1 text-sm text-ink-300">
          <span className="block font-mono text-xs uppercase tracking-wider text-ink-400">{when}</span>
          <span className="mt-1 block font-display text-lg leading-snug text-ink-0">
            You{memory.companions.length ? ` and ${names(memory.companions)}` : ""} {memory.rewatch ? "rewatched" : "watched"} {memory.name}.
          </span>
        </p>
        <button type="button" onClick={onHide} aria-label="Hide this memory" className="flex size-9 shrink-0 items-center justify-center self-start rounded-full text-ink-500 hover:bg-hover hover:text-ink-0">
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </section>
  );
}

/* ── Inviting someone ───────────────────────────────────────────────────── */

/**
 * Invite by link: the system share sheet where there is one, the clipboard
 * otherwise. The link is your invited door (`/invite?from=you`), which opens
 * straight into your room once they join.
 */
export async function inviteSomeone(username: string | null | undefined) {
  const url = username ? inviteUrl(username) : `${window.location.origin}/signup`;
  const text = `I keep the films I watch on letsee${username ? ` (I'm ${username})` : ""}. Come and watch with me.`;
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title: "letsee", text, url });
      return;
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast.success("Invite copied. Paste it to them anywhere.");
  } catch {
    toast.error(`Couldn't copy. The link is ${url}`);
  }
}

export function NextStep({ title, body, action }: { title: string; body: string; action: React.ReactNode }) {
  return (
    <section aria-label="Next" className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card border border-line-strong px-4 py-4">
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-base font-medium text-ink-0">{title}</p>
        <p className="mt-0.5 text-sm text-ink-500">{body}</p>
      </div>
      {action}
    </section>
  );
}

/* ── The wider room ─────────────────────────────────────────────────────── */

/**
 * What people on letsee logged lately: the canonical card with who and when.
 * A rail on a phone, like the sections around it — as a three-across grid,
 * any count that wasn't a multiple of three left one card alone on its row —
 * and whole rows of four from a tablet up (HomeV2 trims to fours).
 */
export function CommunityLately({ logs }: { logs: CommunityLog[] }) {
  return (
    <Rail>
      <ul className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:gap-x-4 sm:gap-y-7 sm:overflow-visible sm:px-0 sm:pb-0">
        {logs.map((l) => (
          <li key={l.id} className="w-36 shrink-0 snap-start sm:w-auto sm:min-w-0">
            <TitleCard
              id={l.itemId}
              title={l.itemName}
              mediaType={l.itemType}
              imageUrl={getPosterUrl(l.imageUrl, "w342")}
              role={`${l.person.username} · ${whenWatched(l.watchedOn)}`}
              people={[{ username: l.person.username, avatarUrl: l.person.avatarUrl }]}
            />
          </li>
        ))}
      </ul>
    </Rail>
  );
}

/** Titles several people here logged lately, most people first, with their faces. */
export function PopularHere({ titles }: { titles: CommunityTitle[] }) {
  return (
    <Rail>
      <ul className="no-scrollbar -mx-4 flex snap-x scroll-px-4 sm:scroll-px-6 lg:scroll-px-8 gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {titles.map((t) => (
          <li key={`${t.itemType}:${t.itemId}`} className="w-36 shrink-0 snap-start sm:w-44">
            <TitleCard
              id={t.itemId}
              title={t.itemName}
              mediaType={t.itemType}
              imageUrl={getPosterUrl(t.imageUrl, "w342")}
              role={`${t.people.length} people here`}
              people={t.people.map((p) => ({ username: p.username, avatarUrl: p.avatarUrl }))}
            />
          </li>
        ))}
      </ul>
    </Rail>
  );
}

export const buttonClass = { primary, quiet };
