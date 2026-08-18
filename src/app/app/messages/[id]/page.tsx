"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Send, Loader2, Film } from "lucide-react";
import { supabase } from "@/utils/supabase/client";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { getPosterUrl } from "@/utils/imageUrl";
import Avatar from "@components/ui/Avatar";

const PAGE_SIZE = 40;

type CardMeta = {
  media_type?: string;
  media_id?: string;
  media_name?: string;
  media_image?: string;
};

type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string | null;
  message_type: "text" | "cardmix";
  metadata: CardMeta | null;
  is_read: boolean;
  created_at: string;
  /** Local-only: set while an optimistic message is in flight. */
  pending?: boolean;
  failed?: boolean;
};

type Recipient = { id: string; username: string; avatar_url: string | null } | null;

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Today";
  if (same(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
}

function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** A shared film rendered inside the bubble — the reason most DMs start here. */
function MediaCard({ meta }: { meta: CardMeta }) {
  const type = meta.media_type === "tv" ? "tv" : "movie";
  const href = meta.media_id ? `/app/${type}/${meta.media_id}` : null;
  const body = (
    <div className="flex items-center gap-3 rounded-xl bg-black/25 p-2 transition-colors hover:bg-black/40">
      <img
        src={getPosterUrl(meta.media_image ?? null, "w92")}
        alt=""
        className="aspect-[2/3] w-11 shrink-0 rounded-md object-cover"
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold leading-tight">
          {meta.media_name ?? "Untitled"}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-[11px] opacity-70">
          <Film className="size-3" />
          {type === "tv" ? "TV series" : "Film"}
        </p>
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default function ChatThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: recipientId } = use(params);
  const { user, status } = useAuth();
  const myId = user?.id ?? null;

  const [recipient, setRecipient] = useState<Recipient>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [theyreTyping, setTheyreTyping] = useState(false);
  const typingChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingSentAt = useRef(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    bottomRef.current?.scrollIntoView({ behavior });
  }, []);

  /* ── Load the other person ─────────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("users")
      .select("id, username, avatar_url")
      .eq("id", recipientId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setRecipient(data as Recipient);
      });
    return () => {
      cancelled = true;
    };
  }, [recipientId]);

  /* ── Load the conversation ─────────────────────────────────────────────── */
  const loadMessages = useCallback(
    async (before?: string) => {
      if (!myId) return;
      let q = supabase
        .from("messages")
        .select("id, sender_id, recipient_id, content, message_type, metadata, is_read, created_at")
        .or(
          `and(sender_id.eq.${myId},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${myId})`,
        )
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE + 1);

      if (before) q = q.lt("created_at", before);

      const { data } = await q;
      const rows = (data ?? []) as Message[];
      const more = rows.length > PAGE_SIZE;
      const page = rows.slice(0, PAGE_SIZE).reverse(); // oldest → newest
      setHasMore(more);
      return page;
    },
    [myId, recipientId],
  );

  useEffect(() => {
    if (!myId) return;
    let cancelled = false;
    setLoading(true);
    loadMessages().then((page) => {
      if (cancelled || !page) return;
      setMessages(page);
      setLoading(false);
      requestAnimationFrame(() => scrollToBottom());
    });
    return () => {
      cancelled = true;
    };
  }, [myId, loadMessages, scrollToBottom]);

  /* ── Mark their messages read ──────────────────────────────────────────── */
  useEffect(() => {
    if (!myId || messages.length === 0) return;
    const unread = messages.filter((m) => m.recipient_id === myId && !m.is_read && !m.pending);
    if (unread.length === 0) return;

    /**
     * Through the server, and the result is used.
     *
     * This was a fire-and-forget client update whose outcome nobody looked at,
     * so a failure looked exactly like a success — and the local rows were
     * never updated either, so `unread` stayed non-empty and the header badge
     * went on counting a message that was open on screen.
     *
     * The rows are marked locally on success so this cannot re-fire, and the
     * badge is told to re-read rather than waiting on a realtime UPDATE event
     * that may never arrive.
     */
    let alive = true;
    fetch("/api/messages/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ withUserId: recipientId }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (!alive || !body) return;
        setMessages((cur) =>
          cur.map((m) => (m.recipient_id === myId && !m.is_read ? { ...m, is_read: true } : m)),
        );
        window.dispatchEvent(new CustomEvent("letsee:messages-read"));
      })
      .catch(() => {
        // Leaving them unread is the honest outcome of a failed write.
      });
    return () => {
      alive = false;
    };
  }, [myId, messages, recipientId]);

  /**
   * Typing, over broadcast rather than the database.
   *
   * Typing is ephemeral — it is true for two seconds and worth nothing after —
   * so writing it to a table would mean a row, a trigger and a WAL entry per
   * keystroke to convey something that expires before anyone reads it back.
   * Broadcast carries it between the two clients and leaves nothing behind.
   *
   * The channel name is sorted so both people join the same one; keyed on the
   * pair in the order they happen to open the thread, each would sit in their
   * own room shouting at nobody.
   */
  useEffect(() => {
    if (!myId) return;
    const room = [myId, recipientId].sort().join(":");
    const ch = supabase.channel(`typing:${room}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "typing" }, (payload) => {
      if ((payload.payload as { from?: string })?.from === myId) return;
      setTheyreTyping(true);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      // Nobody sends a "stopped typing" — it simply expires, which also covers
      // the tab being closed mid-sentence.
      typingTimer.current = setTimeout(() => setTheyreTyping(false), 3000);
    }).subscribe();
    typingChannel.current = ch;
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      void supabase.removeChannel(ch);
      typingChannel.current = null;
    };
  }, [myId, recipientId]);

  /** Throttled: one ping per second is enough to keep an indicator alive. */
  const announceTyping = useCallback(() => {
    const now = Date.now();
    if (!myId || now - typingSentAt.current < 1000) return;
    typingSentAt.current = now;
    void typingChannel.current?.send({ type: "broadcast", event: "typing", payload: { from: myId } });
  }, [myId]);

  /* ── Realtime ──────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!myId) return;
    const channel = supabase
      .channel(`dm-${myId}-${recipientId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new as Message;
          const inThisThread =
            (m.sender_id === myId && m.recipient_id === recipientId) ||
            (m.sender_id === recipientId && m.recipient_id === myId);
          if (!inThisThread) return;

          setMessages((prev) => {
            if (prev.some((p) => p.id === m.id)) return prev;
            // Drop the optimistic twin once the real row arrives.
            const withoutOptimistic = prev.filter(
              (p) => !(p.pending && p.content === m.content && p.sender_id === m.sender_id),
            );
            return [...withoutOptimistic, m];
          });
          requestAnimationFrame(() => scrollToBottom("smooth"));
        },
      )
      /**
       * Read receipts, live.
       *
       * The thread listened for INSERT only, so "· Read" appeared on your own
       * message the next time the page loaded and never while you were looking
       * at it — measured: marking the row read left an open thread unchanged
       * until a reload. UPDATE events only became routable at all once
       * migration 070 set REPLICA IDENTITY FULL; before that they arrived
       * without the old row and could not be matched to a conversation.
       *
       * No scroll on this one. A receipt changing is not new content, and
       * yanking the viewport while someone is reading back through a thread is
       * worse than the receipt arriving quietly.
       */
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new as Message;
          const inThisThread =
            (m.sender_id === myId && m.recipient_id === recipientId) ||
            (m.sender_id === recipientId && m.recipient_id === myId);
          if (!inThisThread) return;
          setMessages((prev) => prev.map((p) => (p.id === m.id ? { ...p, ...m } : p)));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [myId, recipientId, scrollToBottom]);

  /* ── Send ──────────────────────────────────────────────────────────────── */
  /**
   * `text` lets a failed message be retried without retyping it. A bubble that
   * says "Not delivered" and offers nothing is a dead end holding the only copy
   * of what you wrote.
   */
  const send = useCallback(async (text?: string, replaceId?: string) => {
    const body = (text ?? draft).trim();
    if (!body || !myId || sending) return;

    const optimisticId = `pending-${Date.now()}`;
    const optimistic: Message = {
      id: optimisticId,
      sender_id: myId,
      recipient_id: recipientId,
      content: body,
      message_type: "text",
      metadata: null,
      is_read: false,
      created_at: new Date().toISOString(),
      pending: true,
    };

    setMessages((prev) => [...prev.filter((m) => m.id !== replaceId), optimistic]);
    if (!text) setDraft("");
    setSending(true);
    requestAnimationFrame(() => scrollToBottom("smooth"));

    // Take the inserted row straight back rather than waiting for the realtime
    // echo — otherwise a slow or dropped subscription leaves the message stuck
    // on "Sending…" forever even though it saved fine.
    const { data: saved, error } = await supabase
      .from("messages")
      .insert({
        sender_id: myId,
        recipient_id: recipientId,
        content: body,
        message_type: "text",
      })
      .select("id, sender_id, recipient_id, content, message_type, metadata, is_read, created_at")
      .single();

    setSending(false);

    setMessages((prev) => {
      if (error || !saved) {
        return prev.map((m) =>
          m.id === optimisticId ? { ...m, pending: false, failed: true } : m,
        );
      }
      // Realtime may have already inserted the real row; don't duplicate it.
      const withoutDupe = prev.filter((m) => m.id !== saved.id);
      return withoutDupe.map((m) => (m.id === optimisticId ? (saved as Message) : m));
    });

    inputRef.current?.focus();
  }, [draft, myId, recipientId, sending, scrollToBottom]);

  const loadOlder = async () => {
    if (loadingMore || messages.length === 0) return;
    setLoadingMore(true);
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const older = await loadMessages(messages[0].created_at);
    if (older?.length) {
      setMessages((prev) => [...older, ...prev]);
      // Keep the viewport anchored where the user was reading.
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight;
      });
    }
    setLoadingMore(false);
  };

  /* ── Group by day, then by consecutive sender ──────────────────────────── */
  const grouped = useMemo(() => {
    const out: { day: string; runs: { senderId: string; items: Message[] }[] }[] = [];
    for (const m of messages) {
      const day = dayLabel(m.created_at);
      let dayBlock = out[out.length - 1];
      if (!dayBlock || dayBlock.day !== day) {
        dayBlock = { day, runs: [] };
        out.push(dayBlock);
      }
      const lastRun = dayBlock.runs[dayBlock.runs.length - 1];
      if (lastRun && lastRun.senderId === m.sender_id) lastRun.items.push(m);
      else dayBlock.runs.push({ senderId: m.sender_id, items: [m] });
    }
    return out;
  }, [messages]);

  if (status === "anon") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-950 text-surface-400">
        <Link href="/login" className="text-brand-400 hover:underline">
          Log in to view messages
        </Link>
      </div>
    );
  }

  return (
    /**
     * A column, not the whole monitor.
     *
     * The thread had no max width, so on a wide screen it ran edge to edge
     * with bubbles capped at 65% of ~1900px — lines far too long to read
     * comfortably, and inconsistent with the inbox, which was already
     * max-w-2xl. The header, the scroller and the composer all share one width
     * so nothing steps outside the column.
     */
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] w-full max-w-3xl flex-col border-x border-surface-800/60 bg-surface-950 text-white">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-surface-800 px-4 py-3">
        <Link
          href="/app/messages"
          className="nav-icon-btn shrink-0"
          aria-label="Back to messages"
        >
          <ArrowLeft className="size-4" />
        </Link>
        {recipient ? (
          <Link
            href={`/app/profile/${recipient.username}`}
            className="flex min-w-0 items-center gap-2.5"
          >
            <Avatar src={recipient.avatar_url} name={recipient.username} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">@{recipient.username}</p>
              <p className="text-[11px] text-surface-500">
                {theyreTyping ? (
                  <span className="text-brand-400">typing…</span>
                ) : (
                  "View profile"
                )}
              </p>
            </div>
          </Link>
        ) : (
          <div className="h-9 w-32 animate-pulse rounded-lg bg-surface-800" />
        )}
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-surface-500" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Avatar
              src={recipient?.avatar_url}
              name={recipient?.username ?? "?"}
              size="xl"
              className="mb-4"
            />
            <p className="text-base font-semibold text-white">
              @{recipient?.username ?? "…"}
            </p>
            <p className="mt-2 max-w-xs text-sm text-surface-500">
              No messages yet. Sharing a film you both love is an easier opener
              than &ldquo;hi&rdquo;.
            </p>
          </div>
        ) : (
          <>
            {hasMore && (
              <div className="mb-4 flex justify-center">
                <button
                  type="button"
                  onClick={loadOlder}
                  disabled={loadingMore}
                  className="rounded-full border border-surface-700 bg-surface-800 px-4 py-1.5 text-xs text-surface-300 hover:bg-surface-700 disabled:opacity-50"
                >
                  {loadingMore ? "Loading…" : "Load earlier messages"}
                </button>
              </div>
            )}

            {grouped.map((block) => (
              <div key={block.day}>
                <div className="my-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-surface-800" />
                  <span className="text-[11px] font-medium text-surface-500">{block.day}</span>
                  <div className="h-px flex-1 bg-surface-800" />
                </div>

                {block.runs.map((run, ri) => {
                  const mine = run.senderId === myId;
                  return (
                    <div
                      key={`${block.day}-${ri}`}
                      className={`mb-3 flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}
                    >
                      {!mine && (
                        <Avatar
                          src={recipient?.avatar_url}
                          name={recipient?.username ?? "?"}
                          size="xs"
                          className="mb-0.5 shrink-0"
                        />
                      )}
                      <div
                        className={`flex max-w-[78%] flex-col gap-1 sm:max-w-[65%] ${mine ? "items-end" : "items-start"}`}
                      >
                        {run.items.map((m) => (
                          <div
                            key={m.id}
                            className={`w-full rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                              mine
                                ? `bg-brand-500 text-surface-950 ${m.failed ? "opacity-60 ring-1 ring-red-400" : ""} ${m.pending ? "opacity-70" : ""}`
                                : "bg-surface-800 text-surface-100"
                            }`}
                          >
                            {m.message_type === "cardmix" && m.metadata && (
                              <div className={m.content ? "mb-2" : ""}>
                                <MediaCard meta={m.metadata} />
                              </div>
                            )}
                            {m.content && <p className="whitespace-pre-wrap break-words">{m.content}</p>}
                          </div>
                        ))}
                        {(() => {
                          const last = run.items[run.items.length - 1];
                          if (last.failed) {
                            return (
                              <button
                                type="button"
                                onClick={() => void send(last.content ?? undefined, last.id)}
                                className="px-1 text-[10px] text-red-400 underline underline-offset-2 hover:text-red-300"
                              >
                                Not delivered — tap to retry
                              </button>
                            );
                          }
                          if (last.pending) {
                            return <span className="px-1 text-[10px] text-surface-600">Sending…</span>;
                          }
                          return (
                            <span className="px-1 text-[10px] text-surface-600">
                              {clockTime(last.created_at)}
                              {/* Only on your own messages, and only ever "Read".
                                  A permanent "Sent" beside every line is noise;
                                  the useful signal is the transition, and it now
                                  arrives live because 070 gave UPDATE events the
                                  old row they need to be routed. */}
                              {mine && last.is_read && (
                                <span className="ml-1 text-brand-400">· Read</span>
                              )}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Composer */}
      <div
        className="shrink-0 border-t border-surface-800 bg-surface-950 px-4 py-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="flex items-end gap-2"
        >
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              announceTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder={`Message @${recipient?.username ?? ""}…`}
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border border-surface-700 bg-surface-800 px-4 py-3 text-sm text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            aria-label="Send message"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-500 text-surface-950 transition-colors hover:bg-brand-400 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
