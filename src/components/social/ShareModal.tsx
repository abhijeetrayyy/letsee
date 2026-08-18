"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import toast from "react-hot-toast";
import { Check, Link as LinkIcon, MessageCircle, Search, Send, Share2, Twitter, X } from "lucide-react";
import Avatar from "@components/ui/Avatar";
import { supabase } from "@/utils/supabase/client";
import { swrFetcher } from "@/utils/swrFetcher";

/**
 * Sharing a title, in one sheet.
 *
 * The old flow was two: a menu of destinations, and then — if you picked "Send
 * to a friend" — a second modal that unmounted the first. That second modal
 * searched and did nothing else, so with an empty box it showed an empty list.
 * Sharing therefore began by asking you to remember a username, when the whole
 * point is that you are sending this to one of the few people you follow.
 *
 * So the people come first and they are already on screen. Search narrows them,
 * and only reaches past your connections when you type enough to mean it. The
 * external destinations stay, below, as what they are: the fallback for someone
 * who is not here yet.
 */

type Person = { id: string; username: string; avatarUrl: string | null; mutual?: boolean };
type Recipients = { connections: Person[]; others: Person[] };

export type ShareModalProps = {
  title: string;
  mediaType: "movie" | "tv";
  itemId: string | number;
  posterPath?: string | null;
  isOpen: boolean;
  onClose: () => void;
};

export default function ShareModal({
  title,
  mediaType,
  itemId,
  posterPath,
  isOpen,
  onClose,
}: ShareModalProps) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [picked, setPicked] = useState<Person[]>([]);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 220);
    return () => clearTimeout(t);
  }, [query]);

  // Reset between openings, or the next share starts with the last one's
  // recipients still selected.
  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setDebounced("");
      setPicked([]);
      setNote("");
    }
  }, [isOpen]);

  const { data, isLoading } = useSWR<Recipients>(
    isOpen ? `/api/share/recipients${debounced ? `?q=${encodeURIComponent(debounced)}` : ""}` : null,
    swrFetcher,
    { keepPreviousData: true },
  );

  const pickedIds = useMemo(() => new Set(picked.map((p) => p.id)), [picked]);
  const connections = data?.connections ?? [];
  const others = data?.others ?? [];

  const toggle = (p: Person) =>
    setPicked((cur) => (cur.some((x) => x.id === p.id) ? cur.filter((x) => x.id !== p.id) : [...cur, p]));

  const url = typeof window !== "undefined" ? window.location.href : "";
  const hasNativeShare = typeof window !== "undefined" && "share" in navigator;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  const send = async () => {
    if (picked.length === 0 || sending) return;
    setSending(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const senderId = auth?.user?.id;
      if (!senderId) throw new Error("no session");

      const metadata = {
        id: String(itemId),
        name: title,
        poster_path: posterPath ?? null,
        media_type: mediaType,
      };
      const rows = picked.map((p) => ({
        sender_id: senderId,
        recipient_id: p.id,
        content: note.trim() || title,
        message_type: "cardmix" as const,
        metadata,
      }));
      const { error } = await supabase.from("messages").insert(rows);
      if (error) throw error;

      toast.success(
        picked.length === 1 ? `Sent to ${picked[0].username}` : `Sent to ${picked.length} people`,
      );
      onClose();
    } catch {
      toast.error("Couldn't send that");
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  const Row = ({ p }: { p: Person }) => {
    const on = pickedIds.has(p.id);
    return (
      <button
        type="button"
        onClick={() => toggle(p)}
        aria-pressed={on}
        className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors ${
          on ? "bg-brand-500/10" : "hover:bg-surface-800/70"
        }`}
      >
        <Avatar name={p.username} src={p.avatarUrl} size={36} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-surface-100">{p.username}</span>
          {p.mutual && <span className="block text-[11px] text-surface-500">Follows you back</span>}
        </span>
        {/* A checkbox, not a "Send" button per row. The old flow sent to one
            person at a time; picking three people and sending once is the
            common case. */}
        <span
          aria-hidden
          className={`flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
            on ? "border-brand-500 bg-brand-500 text-surface-950" : "border-surface-600"
          }`}
        >
          {on && <Check className="size-3" strokeWidth={3} />}
        </span>
      </button>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Share ${title}`}
    >
      {/* Bottom sheet on a phone, centred card on a desktop — a share is a
          thumb action far more often than a mouse one. */}
      <div
        className="flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-2xl border border-surface-700 bg-surface-900 shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-surface-800 px-4 py-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-base font-semibold text-white">
              <Share2 className="size-4 text-brand-400" /> Share
            </h3>
            <p className="mt-0.5 truncate text-xs text-surface-500">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-surface-400 transition-colors hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-surface-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people"
              aria-label="Search people"
              className="w-full rounded-xl border border-surface-700 bg-surface-950 py-2.5 pl-9 pr-3 text-sm text-white placeholder-surface-500 focus:border-brand-500 focus:outline-none"
            />
          </div>

          {isLoading && connections.length === 0 ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-surface-800/60" />
              ))}
            </div>
          ) : (
            <>
              {connections.length > 0 && (
                <div className="space-y-0.5">
                  {connections.map((p) => (
                    <Row key={p.id} p={p} />
                  ))}
                </div>
              )}

              {others.length > 0 && (
                <div className="mt-4 space-y-0.5">
                  <p className="mb-1 px-2.5 text-[10px] font-medium uppercase tracking-wider text-surface-500">
                    Not connected
                  </p>
                  {others.map((p) => (
                    <Row key={p.id} p={p} />
                  ))}
                </div>
              )}

              {connections.length === 0 && others.length === 0 && (
                <p className="px-2.5 py-6 text-center text-sm text-surface-500">
                  {debounced ? `Nobody matching “${debounced}”.` : "Follow someone to send them a title."}
                </p>
              )}
            </>
          )}
        </div>

        {picked.length > 0 && (
          <div className="border-t border-surface-800 px-4 py-3">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={280}
              placeholder="Say something (optional)"
              aria-label="Add a note"
              className="mb-2.5 w-full rounded-xl border border-surface-700 bg-surface-950 px-3 py-2.5 text-sm text-white placeholder-surface-500 focus:border-brand-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={send}
              disabled={sending}
              className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              <Send className="size-4" />
              {sending
                ? "Sending…"
                : picked.length === 1
                  ? `Send to ${picked[0].username}`
                  : `Send to ${picked.length} people`}
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 border-t border-surface-800 px-4 py-3 sm:grid-cols-4">
          <ExternalButton onClick={copy} label={copied ? "Copied" : "Copy link"}>
            {copied ? <Check className="size-4 text-emerald-400" /> : <LinkIcon className="size-4" />}
          </ExternalButton>
          {hasNativeShare && (
            <ExternalButton
              onClick={async () => {
                try {
                  await navigator.share({ title, url, text: `${title} on LetSee` });
                } catch {
                  /* dismissed */
                }
              }}
              label="More"
            >
              <Share2 className="size-4" />
            </ExternalButton>
          )}
          <ExternalButton
            onClick={() =>
              window.open(
                `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
                "_blank",
                "noopener",
              )
            }
            label="X"
          >
            <Twitter className="size-4" />
          </ExternalButton>
          <ExternalButton
            onClick={() =>
              window.open(
                `https://api.whatsapp.com/send?text=${encodeURIComponent(`${title} ${url}`)}`,
                "_blank",
                "noopener",
              )
            }
            label="WhatsApp"
          >
            <MessageCircle className="size-4" />
          </ExternalButton>
        </div>
      </div>
    </div>
  );
}

/** Icon over label, so four destinations fit one row instead of four stacked bars. */
function ExternalButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 rounded-xl border border-surface-700/60 py-2.5 text-[11px] text-surface-300 transition-colors hover:border-surface-600 hover:text-white"
    >
      {children}
      {label}
    </button>
  );
}
