"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { ArrowLeft, ArrowUp, ChevronDown, EyeOff, LoaderCircle } from "lucide-react";
import toast from "react-hot-toast";
import Link from "@components/ui/AppLink";
import Avatar from "@components/ui/Avatar";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { fetchListsMeet, fetchRoom, findPerson, type MeetMoment, type Pass, type RoomPerson, type Together } from "@/lib/db/rooms";
import PassSheet from "@components/ds/PassSheet";
import LogTogetherSheet from "@components/ds/LogTogetherSheet";
import { stars, type ListMeet } from "@/lib/people/moments";
import { tonightHref } from "@/lib/people/tonight";
import { useThread, type Message } from "@components/rooms/useThread";
import { dayLabel, sinceLabel, watchedLabel } from "@components/rooms/time";
import { getPosterUrl } from "@/utils/imageUrl";
import { titlePath } from "@/utils/urls";
import { fetchHidden, hideEvent, unhideAll, unhideEvent } from "@/lib/db/roomHidden";
import { eventRef, hiddenKey, withoutHidden } from "@/lib/rooms/hidden";

/**
 * A room with one person (docs/design/RETHINK.md §4).
 *
 * The conversation with them and everything that passed between you, in one
 * timeline: messages, the films you watched together, the films you passed
 * each other. Every event was authored by one of you, and nothing here is
 * visible to anyone else.
 */
type Item =
  | { kind: "message"; at: string; message: Message }
  | { kind: "together"; at: string; together: Together }
  | { kind: "pass"; at: string; pass: Pass };

export default function RoomClient({ username }: { username: string }) {
  const { user, status } = useAuth();
  const me = status === "ok" ? user?.id ?? null : null;

  const { data: person, isLoading: findingPerson } = useSWR(me ? ["person", username.toLowerCase()] : null, () => findPerson(username), {
    revalidateOnFocus: false,
  });
  const other = person?.id ?? null;

  // Arrived by id (an old message link): settle the address on their name.
  useEffect(() => {
    if (person?.username && person.id === username) {
      window.history.replaceState(null, "", `/app/people/${encodeURIComponent(person.username)}${window.location.search}`);
    }
  }, [person, username]);
  const { data: room, mutate } = useSWR(me && other ? ["room", me, other] : null, () => fetchRoom(me!, other!), { revalidateOnFocus: false });
  const thread = useThread(me, other && !room?.blocked ? other : null);

  if (status === "anon") {
    return (
      <Notice>
        <Link href={`/login?next=${encodeURIComponent(`/app/people/${username}`)}`} className="inline-flex h-11 items-center rounded-full bg-action px-5 font-semibold text-on-action hover:bg-action-hover">
          Sign in to see this room
        </Link>
      </Notice>
    );
  }
  if (status === "loading" || findingPerson || (me && person === undefined)) return <Notice><LoaderCircle className="size-5 animate-spin text-ink-500" aria-hidden /></Notice>;
  if (!person) return <Notice>No one here is called @{username}.</Notice>;
  if (person.id === me) {
    return (
      <Notice>
        This is you.{" "}
        <Link href={`/app/profile/${encodeURIComponent(person.username)}`} className="text-ink-0 underline underline-offset-4">
          Your profile
        </Link>
      </Notice>
    );
  }
  if (room?.blocked) return <Notice>This room isn’t available.</Notice>;

  return (
    <Room
      me={me!}
      person={person}
      together={room?.together ?? []}
      passes={room?.passes ?? []}
      meet={room?.meet ?? []}
      thread={thread}
      refresh={() => void mutate()}
    />
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-read flex-col items-center gap-4 px-4 py-24 text-center text-base text-ink-400">
      <Link href="/app/people" className="mb-4 inline-flex items-center gap-1.5 self-start text-sm text-ink-500 hover:text-ink-0">
        <ArrowLeft className="size-4" aria-hidden />
        People
      </Link>
      {children}
    </div>
  );
}

function Room({
  me,
  person,
  together,
  passes,
  meet,
  thread,
  refresh,
}: {
  me: string;
  person: RoomPerson;
  together: Together[];
  passes: Pass[];
  meet: MeetMoment[];
  thread: ReturnType<typeof useThread>;
  refresh: () => void;
}) {
  const { messages, loading, hasMore, sending, send, receive, loadOlder } = thread;
  // Arriving from **Reply** on one of their takes, the line is already quoted.
  const [draft, setDraft] = useState(() => {
    const quote = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("quote");
    return quote ? `“${quote}”\n\n` : "";
  });
  const [sheet, setSheet] = useState<"pass" | "log" | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const settled = useRef(false);
  const { data: meetLists } = useSWR(["lists-meet", me, person.id], () => fetchListsMeet(me, person.id), { revalidateOnFocus: false });
  const lastCount = useRef(0);

  // "Not for me" is the receiver's alone: a pass you sent that they set aside still reads as open to you.
  const openPasses = passes.filter((p) => !p.watchedAt && (p.fromMe || !p.dismissedAt));
  const quiet = "inline-flex h-9 items-center rounded-full px-4 text-sm font-medium text-ink-300 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0";
  const oldestTogether = together.length ? together[together.length - 1].watchedOn : null;

  // A pass is sent as a title card, and 097's trigger records it as a pass
  // too. The room shows it once: the card, carrying the pass's state.
  const passKey = (fromMe: boolean, type: string, id: string) => `${fromMe ? "me" : "them"}:${type}:${id}`;
  const { items, passForCard } = useMemo(() => {
    const byKey = new Map(passes.map((p) => [passKey(p.fromMe, p.itemType, p.itemId), p]));
    const forCard = new Map<string, Pass>();
    const shown = new Set<number>();
    for (const m of messages) {
      if (m.message_type !== "cardmix" || !m.metadata?.media_id) continue;
      const key = passKey(m.sender_id === me, m.metadata.media_type === "tv" ? "tv" : "movie", m.metadata.media_id);
      const p = byKey.get(key);
      if (p && !shown.has(p.id)) {
        forCard.set(m.id, p);
        shown.add(p.id);
      }
    }
    // Events older than the oldest loaded message wait until earlier messages
    // are loaded, so the timeline never claims a gap that isn't there.
    const floor = hasMore && messages.length ? messages[0].created_at : "";
    const out: Item[] = messages.map((m) => ({ kind: "message", at: m.created_at, message: m }));
    for (const t of together) if (t.at >= floor) out.push({ kind: "together", at: t.at, together: t });
    for (const p of passes) if (p.at >= floor && !shown.has(p.id)) out.push({ kind: "pass", at: p.at, pass: p });
    return { items: out.sort((a, b) => a.at.localeCompare(b.at)), passForCard: forCard };
  }, [messages, together, passes, hasMore, me]);

  // What you hid stays hidden for you (migration 104); the other person's room is untouched.
  const { data: hidden, mutate: mutateHidden } = useSWR(["room-hidden", me], () => fetchHidden(me), { revalidateOnFocus: false });
  const [showHidden, setShowHidden] = useState(false);
  const { shown: visible, hiddenCount } = withoutHidden(items, hidden ?? new Set<string>());
  const timeline = showHidden ? items : visible;
  const isHidden = (item: Item) => {
    const r = eventRef(item);
    return !!hidden?.has(hiddenKey(r.kind, r.id));
  };
  const toggleHidden = async (item: Item) => {
    const r = eventRef(item);
    const key = hiddenKey(r.kind, r.id);
    const wasHidden = !!hidden?.has(key);
    // Each change edits the set as it is now, so two quick hides and an Undo
    // can't bring the other one back.
    const edit = (add: boolean) =>
      mutateHidden(
        (cur) => {
          const n = new Set(cur ?? []);
          if (add) n.add(key);
          else n.delete(key);
          return n;
        },
        { revalidate: false },
      );
    void edit(!wasHidden);
    const ok = wasHidden ? await unhideEvent(me, r.kind, r.id) : await hideEvent(me, r.kind, r.id);
    if (!ok) {
      void mutateHidden();
      toast.error("That didn't save. Check your connection.");
      return;
    }
    if (!wasHidden) {
      toast(
        (t) => (
          <span className="flex items-center gap-3">
            Hidden for you
            <button
              type="button"
              className="rounded-full px-3 py-1 font-medium ring-1 ring-inset ring-line-input"
              onClick={async () => {
                toast.dismiss(t.id);
                void edit(false);
                if (!(await unhideEvent(me, r.kind, r.id))) void mutateHidden();
              }}
            >
              Undo
            </button>
          </span>
        ),
        { duration: 6000 },
      );
    }
  };

  // Land at the newest thing on open; follow new messages only if already at the bottom.
  useEffect(() => {
    if (loading) return;
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 160;
    if (!settled.current || (messages.length > lastCount.current && atBottom)) {
      window.scrollTo({ top: document.documentElement.scrollHeight });
      settled.current = true;
    }
    lastCount.current = messages.length;
  }, [loading, messages.length]);

  const submit = async (text = draft, replaceId?: string) => {
    if (!text.trim() || sending) return;
    if (!replaceId) setDraft("");
    await send(text, replaceId);
    requestAnimationFrame(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" }));
    input.current?.focus();
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-read flex-col px-4">
      <header className="pb-5 pt-4 sm:pt-8">
        <Link href="/app/people" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-0">
          <ArrowLeft className="size-4" aria-hidden />
          People
        </Link>
        <Link href={`/app/profile/${encodeURIComponent(person.username)}`} className="mt-5 flex items-center gap-4">
          <Avatar src={person.avatarUrl} name={person.username} size={56} />
          <div className="min-w-0">
            <h1 className="truncate text-3xl text-ink-0">{person.username}</h1>
            <p className="mt-0.5 text-sm text-ink-500">
              {together.length > 0
                ? `${together.length} ${together.length === 1 ? "film" : "films"} together since ${sinceLabel(oldestTogether!)}`
                : "Nothing watched together yet"}
            </p>
          </div>
        </Link>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={() => input.current?.focus()} className="inline-flex h-9 items-center rounded-full bg-action px-4 text-sm font-semibold text-on-action hover:bg-action-hover">
            Message
          </button>
          <button type="button" onClick={() => setSheet("pass")} className={quiet}>
            Pass a film
          </button>
          <button type="button" onClick={() => setSheet("log")} className={quiet}>
            Log one together
          </button>
          <Link href={tonightHref([person.username])} className={quiet}>
            Decide tonight
          </Link>
        </div>
        {meetLists && meetLists.length > 0 && <ListsMeet name={person.username} items={meetLists} />}
      </header>

      <PassSheet
        open={sheet === "pass"}
        onClose={() => setSheet(null)}
        me={me}
        to={person}
        onSent={(sent) => {
          receive(sent);
          refresh();
          requestAnimationFrame(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" }));
        }}
      />
      <LogTogetherSheet open={sheet === "log"} onClose={() => setSheet(null)} person={person} onLogged={refresh} />

      {(together.length > 0 || openPasses.length > 0 || meet.length > 0) && (
        <BetweenYou name={person.username} together={together} open={openPasses} meet={meet} />
      )}

      <section aria-label="Timeline" className="flex-1 pb-6 pt-4">
        {hasMore && (
          <div className="mb-4 flex justify-center">
            <button type="button" onClick={() => void loadOlder()} className="rounded-full px-4 py-1.5 text-sm text-ink-400 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0">
              Earlier
            </button>
          </div>
        )}
        {loading ? (
          <div className="flex justify-center py-16">
            <LoaderCircle className="size-5 animate-spin text-ink-500" aria-hidden />
          </div>
        ) : items.length === 0 ? (
          <p className="py-16 text-center text-sm leading-relaxed text-ink-500">
            {meetLists?.length
              ? "Nothing between you yet. One of the films above is an easier opener than “hi”."
              : "Nothing between you yet. A film you both love is an easier opener than “hi”."}
          </p>
        ) : (
          <>
          {hiddenCount > 0 && (
            <p className="mb-3 text-center text-xs text-ink-500">
              {hiddenCount} hidden for you ·{" "}
              <button type="button" onClick={() => setShowHidden((v) => !v)} className="underline decoration-line-input underline-offset-4 hover:text-ink-0">
                {showHidden ? "Hide them again" : "Show them"}
              </button>
              {showHidden && (
                <>
                  {" · "}
                  <button
                    type="button"
                    onClick={async () => {
                      const refs = items.filter(isHidden).map(eventRef);
                      await unhideAll(me, refs);
                      // Read back what is still hidden (things not loaded here stay hidden).
                      void mutateHidden();
                      setShowHidden(false);
                    }}
                    className="underline decoration-line-input underline-offset-4 hover:text-ink-0"
                  >
                    Unhide these
                  </button>
                </>
              )}
            </p>
          )}
          <ol className="grid gap-1.5">
            {timeline.map((item, i) => {
              const day = dayLabel(item.at);
              const showDay = i === 0 || dayLabel(timeline[i - 1].at) !== day;
              const next = timeline[i + 1];
              const hiddenHere = isHidden(item);
              const runEnds =
                item.kind !== "message" ||
                next?.kind !== "message" ||
                next.message.sender_id !== item.message.sender_id ||
                new Date(next.at).getTime() - new Date(item.at).getTime() > 5 * 60_000;
              return (
                <li key={`${item.kind}-${item.kind === "message" ? item.message.id : item.kind === "pass" ? item.pass.id : item.together.viewingId}`} className={`group relative ${hiddenHere ? "opacity-50" : ""}`}>
                  {showDay && <p className="py-4 text-center font-mono text-xs uppercase tracking-wider text-ink-500">{day}</p>}
                  {/* Hide for you: on hover or focus, beside the event. */}
                  <button
                    type="button"
                    onClick={() => void toggleHidden(item)}
                    aria-label={hiddenHere ? "Unhide this" : "Hide this for you"}
                    title={hiddenHere ? "Unhide" : "Hide for you"}
                    // Invisible until hover or focus — and not tappable until then
                    // either: on a phone (no hover) it was an invisible target over
                    // the corner of every message, hiding them by accident.
                    className="pointer-events-none absolute bottom-1 left-0 z-10 flex size-8 items-center justify-center rounded-full text-ink-500 opacity-0 transition-opacity hover:bg-hover hover:text-ink-0 focus-visible:pointer-events-auto focus-visible:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100"
                  >
                    <EyeOff className="size-4" aria-hidden />
                  </button>
                  {item.kind === "message" && item.message.message_type === "cardmix" && item.message.metadata?.media_id ? (
                    <PassEvent pass={cardAsPass(item.message, me, passForCard.get(item.message.id))} name={person.username} withState={passForCard.has(item.message.id)} />
                  ) : item.kind === "message" ? (
                    <Bubble message={item.message} mine={item.message.sender_id === me} showTime={runEnds} onRetry={(m) => void submit(m.content ?? "", m.id)} />
                  ) : item.kind === "together" ? (
                    <TogetherEvent together={item.together} name={person.username} />
                  ) : (
                    <PassEvent pass={item.pass} name={person.username} />
                  )}
                </li>
              );
            })}
          </ol>
          </>
        )}
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="room-composer sticky bottom-0 -mx-4 flex items-end gap-2 border-t border-line bg-page px-4 pt-3"
      >
        <label htmlFor="room-draft" className="sr-only">
          Message {person.username}
        </label>
        <textarea
          id="room-draft"
          ref={input}
          rows={1}
          maxLength={2000}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder={`Message ${person.username}`}
          className="max-h-32 min-h-11 flex-1 resize-none rounded-card bg-raised px-4 py-2.5 text-base text-ink-0 ring-1 ring-inset ring-line-input placeholder:text-ink-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          aria-label="Send"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-action text-on-action transition-colors hover:bg-action-hover disabled:opacity-40"
        >
          {sending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <ArrowUp className="size-5" aria-hidden />}
        </button>
      </form>
    </div>
  );
}

function BetweenYou({ name, together, open, meet }: { name: string; together: Together[]; open: Pass[]; meet: MeetMoment[] }) {
  const parts = [together.length ? `${together.length} together` : null, open.length ? `${open.length} open ${open.length === 1 ? "pass" : "passes"}` : null].filter(Boolean);
  return (
    <details className="group rounded-card border border-line-strong bg-raised">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="flex-1 text-sm font-medium text-ink-0">Between you</span>
        <span className="text-sm text-ink-500">{parts.join(" · ")}</span>
        <ChevronDown className="size-4 text-ink-500 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="grid gap-6 border-t border-line px-4 pb-5 pt-4">
        {together.length > 0 && (
          <div>
            <h2 className="mb-3 font-sans text-xs font-medium tracking-normal text-ink-500">Together</h2>
            <ul className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1">
              {together.slice(0, 24).map((t) => (
                <li key={t.viewingId} className="w-20 shrink-0 snap-start">
                  <Link href={titlePath(t.itemType, t.itemId, t.itemName)} className="group/poster block">
                    <img src={getPosterUrl(t.imageUrl, "w185")} alt={t.itemName} loading="lazy" decoding="async" className="aspect-2/3 w-full rounded-media bg-hover object-cover ring-1 ring-line-strong" />
                    <span className="mt-1.5 block truncate font-mono text-xs uppercase text-ink-500">{watchedLabel(t.watchedOn)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {open.length > 0 && (
          <div>
            <h2 className="mb-2 font-sans text-xs font-medium tracking-normal text-ink-500">Open passes</h2>
            <ul className="grid gap-2">
              {open.map((p) => (
                <li key={p.id}>
                  <Link href={titlePath(p.itemType, p.itemId, p.itemName)} className="flex items-center gap-3 rounded-control py-1 hover:bg-hover">
                    <img src={getPosterUrl(p.imageUrl, "w92")} alt="" loading="lazy" decoding="async" className="aspect-2/3 w-9 shrink-0 rounded-media bg-hover object-cover" />
                    <span className="min-w-0 text-sm text-ink-400">
                      <span className="block truncate font-display text-base text-ink-0">{p.itemName}</span>
                      {p.fromMe ? `You passed it to ${name}` : `${name} passed it to you`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {meet.length > 0 && (
          <div>
            <h2 className="mb-2 font-sans text-xs font-medium tracking-normal text-ink-500">Where you meet</h2>
            <ul className="grid gap-2 text-sm leading-relaxed text-ink-400">
              {meet.map((m) => (
                <li key={m.key}>
                  {m.kind === "both" ? (
                    <>
                      You both gave{" "}
                      <Link href={titlePath(m.itemType, m.itemId, m.itemName)} className="font-display text-base text-ink-0 hover:underline">
                        {m.itemName}
                      </Link>{" "}
                      {m.mine === m.theirs ? stars(m.mine) : `${stars(m.mine)} and ${stars(m.theirs)}`}.
                    </>
                  ) : (
                    <>
                      You split on{" "}
                      <Link href={titlePath(m.itemType, m.itemId, m.itemName)} className="font-display text-base text-ink-0 hover:underline">
                        {m.itemName}
                      </Link>
                      : you {stars(m.mine)}, {name} {stars(m.theirs)}. Ask them why.
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}

/**
 * Where your lists meet: what you both want to see, what they've seen that
 * you saved, what you've seen that they saved — each the start of something
 * to do in this room (a night, a question, a pass). In the header, open, so a
 * quiet room has something better to start with than "hi".
 */
function ListsMeet({ name, items }: { name: string; items: ListMeet[] }) {
  const said = { both: "You both want it", "they-saw": `${name} has seen it`, "you-saw": `${name} wants it` } as const;
  return (
    <section aria-labelledby="lists-meet" className="mt-6">
      <h2 id="lists-meet" className="mb-2.5 font-sans text-xs font-medium tracking-normal text-ink-500">
        Where your lists meet
      </h2>
      <ul className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1">
        {items.map((t) => (
          <li key={`${t.itemType}:${t.itemId}`} className="w-24 shrink-0 snap-start">
            <Link href={titlePath(t.itemType, t.itemId, t.itemName)} className="block">
              <img src={getPosterUrl(t.imageUrl, "w185")} alt={t.itemName} loading="lazy" decoding="async" className="aspect-2/3 w-full rounded-media bg-hover object-cover ring-1 ring-line-strong" />
              <span className={`mt-1.5 block text-xs leading-snug ${t.kind === "both" ? "font-medium text-accent" : "text-ink-400"}`}>{said[t.kind]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Bubble({ message, mine, showTime, onRetry }: { message: Message; mine: boolean; showTime: boolean; onRetry: (m: Message) => void }) {
  const card = message.message_type === "cardmix" ? message.metadata : null;
  const cardType = card?.media_type === "tv" ? "tv" : "movie";
  return (
    <div className={`flex flex-col ${mine ? "items-end pl-12 sm:pl-24" : "items-start pr-12 sm:pr-24"}`}>
      <div
        className={`rounded-card px-3.5 py-2 text-base leading-relaxed ${
          mine ? "bg-active text-ink-0" : "bg-raised text-ink-300 ring-1 ring-inset ring-line"
        } ${message.pending ? "opacity-70" : ""} ${message.failed ? "ring-1 ring-danger" : ""}`}
      >
        {card?.media_id && (
          <Link href={titlePath(cardType, card.media_id, card.media_name)} className={`flex items-center gap-3 ${message.content ? "mb-2" : ""}`}>
            <img src={getPosterUrl(card.media_image ?? null, "w92")} alt="" loading="lazy" decoding="async" className="aspect-2/3 w-10 shrink-0 rounded-media object-cover" />
            <span className="font-display text-base text-ink-0">{card.media_name ?? "A title"}</span>
          </Link>
        )}
        {message.content && <p className="whitespace-pre-wrap break-words">{message.content}</p>}
      </div>
      {message.failed ? (
        <button type="button" onClick={() => onRetry(message)} className="mt-1 px-1 text-xs text-danger underline underline-offset-2">
          Not sent. Try again
        </button>
      ) : message.pending ? (
        <span className="mt-1 px-1 text-xs text-ink-600">Sending…</span>
      ) : showTime ? (
        <span className="mb-2 mt-1 px-1 text-xs text-ink-600">
          {new Date(message.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
          {mine && message.is_read && " · Read"}
        </span>
      ) : null}
    </div>
  );
}

function EventCard({ href, poster, children }: { href: string; poster: string | null; children: React.ReactNode }) {
  return (
    <div className="my-2 flex justify-center">
      <Link href={href} className="flex w-full max-w-sheet items-center gap-3 rounded-card border border-line-strong px-3 py-2.5 transition-colors hover:bg-raised">
        <img src={getPosterUrl(poster, "w92")} alt="" loading="lazy" decoding="async" className="aspect-2/3 w-10 shrink-0 rounded-media bg-hover object-cover" />
        <span className="min-w-0 text-sm leading-snug text-ink-400">{children}</span>
      </Link>
    </div>
  );
}

function loggedThatDay(t: Together): boolean {
  const d = new Date(t.at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` === t.watchedOn;
}

function TogetherEvent({ together, name }: { together: Together; name: string }) {
  const { mine, theirs } = together.words ?? { mine: null, theirs: null };
  return (
    <EventCard href={titlePath(together.itemType, together.itemId, together.itemName)} poster={together.imageUrl}>
      You watched <em className="font-display text-base not-italic text-ink-0">{together.itemName}</em> together
      {/* The day heading above already says when, unless it was logged on a later day. */}
      {!loggedThatDay(together) && (
        <span className="mt-1 block font-mono text-xs uppercase tracking-wide text-ink-500">{watchedLabel(together.watchedOn)}</span>
      )}
      {/* What each of you said about it, when it was said for the other to read. */}
      {theirs && (
        <span className="mt-2 block font-display text-base italic leading-snug text-ink-200">
          “{theirs}” <span className="font-sans text-xs not-italic text-ink-500">— {name}</span>
        </span>
      )}
      {mine && (
        <span className="mt-2 block font-display text-base italic leading-snug text-ink-200">
          “{mine}” <span className="font-sans text-xs not-italic text-ink-500">— you</span>
        </span>
      )}
    </EventCard>
  );
}

/** A title card as a pass: the recorded pass when there is one, else the card itself. */
function cardAsPass(m: Message, me: string, recorded: Pass | undefined): Pass {
  if (recorded) return { ...recorded, note: m.content?.trim() || recorded.note };
  const meta = m.metadata ?? {};
  return {
    id: -1,
    fromMe: m.sender_id === me,
    itemId: meta.media_id ?? "",
    itemType: meta.media_type === "tv" ? "tv" : "movie",
    itemName: meta.media_name || "a title",
    imageUrl: meta.media_image || null,
    note: m.content?.trim() || null,
    at: m.created_at,
    watchedAt: null,
    dismissedAt: null,
  };
}

function PassEvent({ pass, name, withState = true }: { pass: Pass; name: string; withState?: boolean }) {
  const state = pass.watchedAt ? "Watched" : pass.dismissedAt && !pass.fromMe ? "Set aside" : "Open";
  return (
    <EventCard href={titlePath(pass.itemType, pass.itemId, pass.itemName)} poster={pass.imageUrl}>
      {pass.fromMe ? `You passed ${name} ` : `${name} passed you `}
      <em className="font-display text-base not-italic text-ink-0">{pass.itemName}</em>
      {pass.note && <span className="mt-1 block font-display text-base italic text-ink-300">“{pass.note}”</span>}
      {withState && <span className="mt-1 block font-mono text-xs uppercase tracking-wide text-ink-500">{state}</span>}
    </EventCard>
  );
}
