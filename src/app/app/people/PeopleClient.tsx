"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { Search, Send } from "lucide-react";
import Link from "@components/ui/AppLink";
import Avatar from "@components/ui/Avatar";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { fetchRoomList, searchPeople, type NamedCompanion, type RoomPerson, type RoomSummary } from "@/lib/db/rooms";
import { inviteSomeone } from "@components/home/v2/parts";
import RequestRow from "@components/rooms/RequestRow";
import Discover from "@components/rooms/Discover";
import Groups from "@components/rooms/Groups";
import { ago } from "@components/rooms/time";
import { fetchNotifications, markNotificationsRead, type NotificationItem } from "@/lib/db/notifications";
import { getNotificationText, type NotificationLike } from "@/lib/notifications/text";

/**
 * The People tab (docs/design/RETHINK.md §4, "The People tab").
 *
 * Requests first, and only when there are any. Then one room per person,
 * newest first, each leading with a face and the last thing that happened.
 * Nothing is counted: a room with something new carries a white dot.
 *
 * Under the rooms, the way to bring someone who isn't here: your link, and
 * the people you've named on viewings who aren't on letsee yet — the friends
 * you already watch with, which is who a room is for.
 */
export default function PeopleClient() {
  const { user, status } = useAuth();
  const me = status === "ok" ? user?.id ?? null : null;
  const { data, isLoading, mutate } = useSWR(me ? ["rooms", me] : null, () => fetchRoomList(me!), {
    revalidateOnFocus: false,
  });
  const [query, setQuery] = useState("");

  if (status === "anon") {
    return (
      <Page>
        <p className="text-base text-ink-400">
          Your people live here: the friends you watch with, and everything that passes between you.
        </p>
        <Link href="/login?next=/app/people" className="mt-6 inline-flex h-11 items-center rounded-full bg-action px-5 font-semibold text-on-action hover:bg-action-hover">
          Sign in
        </Link>
      </Page>
    );
  }

  const rooms = data?.rooms ?? [];
  const requests = data?.requests ?? [];
  const q = query.trim().replace(/^@/, "").toLowerCase();
  const shown = q ? rooms.filter((r) => r.person.username.toLowerCase().includes(q)) : rooms;

  return (
    <Page>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16">
      <div className="min-w-0">
      <label className="relative block">
        <span className="sr-only">Find someone, or start a room</span>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-500" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find someone, or start a room"
          className="h-11 w-full rounded-control bg-raised pl-10 pr-3.5 text-base text-ink-0 ring-1 ring-inset ring-line-input placeholder:text-ink-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        />
      </label>

      {!q && requests.length > 0 && (
        <section aria-labelledby="requests" className="mt-8">
          <h2 id="requests" className="mb-3 text-2xl text-ink-0">
            Asking you
          </h2>
          <ul className="divide-y divide-line rounded-card border border-line-strong bg-raised">
            {requests.map((r) => (
              <RequestRow key={r.kind === "follow" ? `f${r.id}` : `w${r.viewingId}`} request={r} onDone={() => void mutate()} />
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Rooms" className="mt-8">
        {isLoading && !data ? (
          <RoomSkeleton />
        ) : shown.length > 0 ? (
          <ul className="-mx-2">
            {shown.map((room) => (
              <RoomRow key={room.person.id} room={room} />
            ))}
          </ul>
        ) : q ? null : (
          <Empty />
        )}
        {q && me && <StartRoom query={q} me={me} existing={rooms.map((r) => r.person.id)} />}
      </section>

      {!q && data && <Bring username={user?.username ?? null} named={data.named} few={rooms.length < 3} />}

      {!q && me && <Groups me={me} />}

      {!q && me && <Lately me={me} />}
      </div>

      {/* The rail: people you could watch with, beside the rooms you have. */}
      <aside className="min-w-0">
        {!q && me && <Discover me={me} known={new Set(rooms.map((r) => r.person.id))} className="lg:mt-0" />}
      </aside>
      </div>

      {!q && (
        <p className="mt-10 border-t border-line pt-5 text-sm text-ink-500">
          Deciding what to watch with friends is{" "}
          <Link href="/app/tonight" className="text-ink-300 underline decoration-line-input underline-offset-4 hover:text-ink-0">
            Tonight
          </Link>
          .
        </p>
      )}
    </Page>
  );
}

/**
 * Finding people (the People tab is also where you meet new ones): people
 * whose taste resembles yours, introduced by the films you share — never a
 * percentage — then, when there are none yet, people who have logged
 * something lately. Follow from the row; everyone else is a search away.
 */
/**
 * What happened that isn't a conversation: replies, a title arriving on your
 * service, a new episode, a new follower, someone watching what you passed
 * them. Requests and messages already have their places above, so they are
 * left out. Opening People is seeing these, so they are marked read here and
 * the white dot on the tab clears.
 */
const ELSEWHERE = new Set(["follow_request", "co_log_invite", "dm_received"]);

function Lately({ me }: { me: string }) {
  const { data } = useSWR(["lately", me], () => fetchNotifications(me, 1, 20), { revalidateOnFocus: false });
  const unread = data?.unreadCount ?? 0;

  useEffect(() => {
    if (!unread) return;
    const timer = setTimeout(() => {
      void markNotificationsRead(me).then((error) => {
        if (!error) window.dispatchEvent(new Event("letsee:messages-read"));
      });
    }, 1200);
    return () => clearTimeout(timer);
  }, [unread, me]);

  const items = (data?.data ?? []).filter((n: NotificationItem) => !ELSEWHERE.has(String(n.notification_type))).slice(0, 10);
  if (!items.length) return null;

  return (
    <section aria-labelledby="lately" className="mt-10">
      <h2 id="lately" className="mb-1 font-sans text-xs font-medium tracking-normal text-ink-500">
        Lately
      </h2>
      <ul className="divide-y divide-line">
        {items.map((n) => {
          const said = getNotificationText(n as unknown as NotificationLike);
          const row = (
            <span className="flex items-start gap-3 py-3">
              {n.actor?.username ? (
                <Avatar src={n.actor.avatar_url} name={n.actor.username} size={28} />
              ) : (
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-ink-600" aria-hidden />
              )}
              <span className="min-w-0 flex-1 text-sm leading-snug text-ink-300">
                {said.text}
                {said.detail && <span className="mt-0.5 block truncate text-ink-500">{said.detail}</span>}
              </span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-ink-500">{ago(n.created_at)}</span>
              {!n.is_read && (
                <>
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-ink-0" aria-hidden />
                  <span className="sr-only">New</span>
                </>
              )}
            </span>
          );
          return <li key={n.id}>{said.href ? <Link href={said.href} className="-mx-2 block rounded-control px-2 transition-colors hover:bg-raised">{row}</Link> : row}</li>;
        })}
      </ul>
    </section>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-app px-4 pb-16 pt-6 sm:px-6 sm:pt-10 lg:px-8">
      <h1 className="mb-8 text-4xl text-ink-0 sm:text-5xl">People</h1>
      {children}
    </div>
  );
}

function lastLine(room: RoomSummary): React.ReactNode {
  const t = <em className="font-display not-italic text-ink-300">{room.last.text}</em>;
  switch (room.last.kind) {
    case "message":
      return room.last.fromMe ? <>You: {room.last.text}</> : room.last.text;
    case "together":
      return <>Watched {t} together</>;
    case "pass":
      return room.last.fromMe ? <>You passed {t}</> : <>Passed you {t}</>;
  }
}

function RoomRow({ room }: { room: RoomSummary }) {
  return (
    <li>
      <Link
        href={`/app/people/${encodeURIComponent(room.person.username)}`}
        className="flex items-center gap-3.5 rounded-card px-2 py-3 transition-colors hover:bg-raised"
      >
        <Avatar src={room.person.avatarUrl} name={room.person.username} size={56} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className={`truncate text-base ${room.unread ? "font-semibold text-ink-0" : "font-medium text-ink-0"}`}>{room.person.username}</span>
            <span className="shrink-0 font-mono text-xs tabular-nums text-ink-500">{ago(room.lastAt)}</span>
          </span>
          <span className="mt-0.5 flex items-center gap-2">
            <span className={`truncate text-sm ${room.unread ? "text-ink-300" : "text-ink-500"}`}>{lastLine(room)}</span>
            {room.unread && (
              <>
                <span className="ml-auto size-2 shrink-0 rounded-full bg-ink-0" aria-hidden />
                <span className="sr-only">Something new</span>
              </>
            )}
          </span>
        </span>
      </Link>
    </li>
  );
}

function StartRoom({ query, me, existing }: { query: string; me: string; existing: string[] }) {
  const [found, setFound] = useState<{ query: string; people: RoomPerson[] } | null>(null);
  useEffect(() => {
    const id = setTimeout(() => {
      void searchPeople(query, me).then((people) => setFound({ query, people }));
    }, 250);
    return () => clearTimeout(id);
  }, [query, me]);
  const fresh = useMemo(() => (found?.query === query ? found.people.filter((p) => !existing.includes(p.id)) : []), [found, query, existing]);
  if (!fresh.length) return null;
  return (
    <div className="mt-6">
      <h2 className="mb-2 font-sans text-xs font-medium tracking-normal text-ink-500">Start a room</h2>
      <ul className="-mx-2">
        {fresh.map((p) => (
          <li key={p.id}>
            <Link href={`/app/people/${encodeURIComponent(p.username)}`} className="flex items-center gap-3.5 rounded-card px-2 py-2.5 transition-colors hover:bg-raised">
              <Avatar src={p.avatarUrl} name={p.username} size={36} />
              <span className="text-base font-medium text-ink-0">{p.username}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Bringing someone. With few rooms it's a card and leads with the people
 * you've named ("Priya · on 3 of your films"); with a full list it shrinks to
 * one line, because by then it's an errand, not the point of the page.
 */
function Bring({ username, named, few }: { username: string | null; named: NamedCompanion[]; few: boolean }) {
  const top = named.slice(0, 3);
  if (!few && !top.length) {
    return (
      <button
        type="button"
        onClick={() => void inviteSomeone(username)}
        className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-ink-300 underline decoration-line-input underline-offset-4 hover:text-ink-0"
      >
        <Send className="size-4" aria-hidden />
        Bring someone who isn&apos;t here
      </button>
    );
  }
  return (
    <section aria-labelledby="bring" className="mt-8 rounded-card border border-line-strong bg-raised p-4 sm:p-5">
      <h2 id="bring" className="font-display text-lg text-ink-0">
        Watching with someone who isn&apos;t here?
      </h2>
      <p className="mt-1 text-sm text-ink-500">
        Send them your link. When they join, you share a room{top.length > 0 ? " — and the films you named them on" : ""}.
      </p>
      {top.length > 0 && (
        <ul className="mt-3 divide-y divide-line">
          {top.map((n) => (
            <li key={n.name} className="flex items-center gap-3 py-2.5">
              <Avatar src={null} name={n.name} size={32} />
              <span className="min-w-0 flex-1 truncate text-base text-ink-0">
                {n.name} <span className="text-sm text-ink-500">· on {n.viewings === 1 ? "one of your films" : `${n.viewings} of your films`}</span>
              </span>
              <button
                type="button"
                onClick={() => void inviteSomeone(username)}
                aria-label={`Send ${n.name} your link`}
                className="inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-sm font-medium text-ink-200 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0"
              >
                Invite
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => void inviteSomeone(username)}
        className="mt-3 inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-ink-0 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover"
      >
        <Send className="size-4" aria-hidden />
        Send your link
      </button>
    </section>
  );
}

function Empty() {
  return (
    <div className="rounded-card border border-line-strong bg-raised px-5 py-8">
      <p className="font-display text-xl text-ink-0">No rooms yet.</p>
      <p className="mt-2 text-sm leading-relaxed text-ink-400">
        A room opens the first time you message someone, log something you watched together, or pass them a film. Search for a friend above to start one.
      </p>
    </div>
  );
}

function RoomSkeleton() {
  return (
    <ul className="grid gap-1" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="flex items-center gap-3.5 py-3">
          <span className="size-11 rounded-full bg-raised" />
          <span className="grid flex-1 gap-2">
            <span className="h-3.5 w-32 rounded bg-raised" />
            <span className="h-3 w-52 rounded bg-raised" />
          </span>
        </li>
      ))}
    </ul>
  );
}
