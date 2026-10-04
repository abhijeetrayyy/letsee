"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import type { Message } from "@/lib/db/rooms";

export type { Message, CardMeta } from "@/lib/db/rooms";

/**
 * The messages between you and one person: paged, live, marked read, sent
 * optimistically. Lifted from `/app/messages/[id]`, whose comments explain the
 * race each part closes; that page is deleted when rooms become the default
 * (EXECUTION.md phase 6), and until then the two must not drift.
 */
const PAGE_SIZE = 40;
const COLUMNS = "id, sender_id, recipient_id, content, message_type, metadata, is_read, created_at";

export function useThread(myId: string | null, otherId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [sending, setSending] = useState(false);

  const page = useCallback(
    async (before?: string): Promise<{ rows: Message[]; more: boolean } | null> => {
      if (!myId || !otherId) return null;
      let q = supabase
        .from("messages")
        .select(COLUMNS)
        .or(`and(sender_id.eq.${myId},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${myId})`)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE + 1);
      if (before) q = q.lt("created_at", before);
      const { data, error } = await q;
      if (error) return null;
      const rows = (data ?? []) as Message[];
      return { rows: rows.slice(0, PAGE_SIZE).reverse(), more: rows.length > PAGE_SIZE };
    },
    [myId, otherId],
  );

  useEffect(() => {
    if (!myId || !otherId) return;
    let cancelled = false;
    void page().then((result) => {
      if (cancelled) return;
      setMessages(result?.rows ?? []);
      setHasMore(result?.more ?? false);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [myId, otherId, page]);

  // Their messages are read once they are on screen; the shared unread store
  // re-reads on the event rather than waiting for a realtime UPDATE.
  useEffect(() => {
    if (!myId || !otherId) return;
    if (!messages.some((m) => m.recipient_id === myId && !m.is_read && !m.pending)) return;
    let alive = true;
    fetch("/api/messages/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ withUserId: otherId }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (!alive || !body) return;
        setMessages((cur) => cur.map((m) => (m.recipient_id === myId && !m.is_read ? { ...m, is_read: true } : m)));
        window.dispatchEvent(new CustomEvent("letsee:messages-read"));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [myId, otherId, messages]);

  useEffect(() => {
    if (!myId || !otherId) return;
    const between = (m: Message) =>
      (m.sender_id === myId && m.recipient_id === otherId) || (m.sender_id === otherId && m.recipient_id === myId);
    const channel = supabase
      .channel(`room-${myId}-${otherId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new as Message;
        if (!between(m)) return;
        setMessages((prev) => {
          if (prev.some((p) => p.id === m.id)) return prev;
          // One echo consumes one optimistic twin, the oldest.
          const twin = prev.findIndex((p) => p.pending && p.content === m.content && p.sender_id === m.sender_id);
          const rest = twin === -1 ? prev : [...prev.slice(0, twin), ...prev.slice(twin + 1)];
          return [...rest, m];
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new as Message;
        if (!between(m)) return;
        setMessages((prev) => prev.map((p) => (p.id === m.id ? { ...p, ...m } : p)));
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [myId, otherId]);

  const send = useCallback(
    async (body: string, replaceId?: string): Promise<boolean> => {
      const text = body.trim();
      if (!text || !myId || !otherId) return false;
      const optimisticId = `pending-${Date.now()}`;
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== replaceId),
        {
          id: optimisticId,
          sender_id: myId,
          recipient_id: otherId,
          content: text,
          message_type: "text",
          metadata: null,
          is_read: false,
          created_at: new Date().toISOString(),
          pending: true,
        },
      ]);
      setSending(true);
      const { data: saved, error } = await supabase
        .from("messages")
        .insert({ sender_id: myId, recipient_id: otherId, content: text, message_type: "text" })
        .select(COLUMNS)
        .single();
      setSending(false);
      setMessages((prev) => {
        if (error || !saved) return prev.map((m) => (m.id === optimisticId ? { ...m, pending: false, failed: true } : m));
        // Upsert: correct whether the insert response or the realtime echo arrives first.
        const rest = prev.filter((m) => m.id !== optimisticId && m.id !== saved.id);
        return [...rest, saved as Message].sort((a, b) => a.created_at.localeCompare(b.created_at));
      });
      return !error;
    },
    [myId, otherId],
  );

  /** Messages sent from elsewhere on the page (a pass), in before their realtime echo. */
  const receive = useCallback((rows: Message[]) => {
    setMessages((prev) => {
      const have = new Set(prev.map((m) => m.id));
      return [...prev, ...rows.filter((r) => !have.has(r.id))].sort((a, b) => a.created_at.localeCompare(b.created_at));
    });
  }, []);

  const loadOlder = useCallback(async () => {
    const oldest = messages[0]?.created_at;
    if (!oldest) return;
    const older = await page(oldest);
    if (!older) return;
    setHasMore(older.more);
    if (older.rows.length) setMessages((prev) => [...older.rows, ...prev]);
  }, [messages, page]);

  return { messages, loading, hasMore, sending, send, receive, loadOlder };
}
