"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "@components/ui/AppLink";
import { Link2, Share2, UserPlus, X } from "lucide-react";
import toast from "react-hot-toast";
import Avatar from "@components/ui/Avatar";
import PersonPicker, { type PickedPerson } from "@components/ui/PersonPicker";
import { listPath } from "@/utils/urls";

/**
 * Who is on a list, and how to bring somebody else onto it.
 *
 * `/api/user-lists/[id]/collaborators` existed with no UI: nothing showed a
 * list's collaborators and nothing let an owner add one. The atomic network
 * for a watch journal is one household or one friend group with a shared
 * list, so the two controls that make that possible are here — copy the link
 * (it works signed out for a public list) and add a collaborator.
 */

type Collaborator = { userId: string; username: string; avatarUrl: string | null };

export default function ListPeople({
  listId,
  listName,
  isOwner,
  visibility,
}: {
  listId: number;
  listName: string;
  isOwner: boolean;
  visibility: string;
}) {
  const [people, setPeople] = useState<Collaborator[]>([]);
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<PickedPerson[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/user-lists/${listId}/collaborators`, { credentials: "include" });
      if (!res.ok) return;
      const body = await res.json();
      const rows = (body.collaborators ?? body.data ?? []) as { user_id?: string; userId?: string; username?: string; avatar_url?: string | null; avatarUrl?: string | null }[];
      setPeople(
        rows
          .map((r) => ({ userId: r.user_id ?? r.userId ?? "", username: r.username ?? "", avatarUrl: r.avatar_url ?? r.avatarUrl ?? null }))
          .filter((r) => r.userId && r.username),
      );
    } catch {
      // The list still renders; the people strip is a nicety.
    }
  }, [listId]);

  useEffect(() => {
    void load();
  }, [load]);

  const copyLink = async () => {
    const url = `${window.location.origin}${listPath(listId, listName)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: listName, url });
        return;
      } catch {
        // fall through
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success(visibility === "public" ? "Link copied" : "Link copied — only people who can see this list can open it");
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  const add = async () => {
    const person = picked[0];
    if (!person || person.kind !== "user") return;
    setBusy(true);
    try {
      const res = await fetch(`/api/user-lists/${listId}/collaborators`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: person.userId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Couldn't add them");
      }
      toast.success(`${person.username} can add to this list now`);
      setPicked([]);
      setAdding(false);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (userId: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/user-lists/${listId}/collaborators?userId=${encodeURIComponent(userId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Couldn't remove them");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {people.map((p) => (
        <span key={p.userId} className="inline-flex items-center gap-1.5 rounded-full border border-surface-800 bg-surface-900/60 py-1 pl-1 pr-2 text-xs text-surface-200">
          <Avatar src={p.avatarUrl} name={p.username} size="xs" />
          <Link href={`/app/profile/${p.username}`} className="hover:text-white">
            {p.username}
          </Link>
          {isOwner && (
            <button type="button" onClick={() => remove(p.userId)} disabled={busy} aria-label={`Remove ${p.username}`} className="text-surface-500 hover:text-white">
              <X className="size-3" />
            </button>
          )}
        </span>
      ))}
      <button
        type="button"
        onClick={copyLink}
        className="inline-flex items-center gap-1.5 rounded-full border border-surface-700 px-3 py-1.5 text-xs text-surface-300 transition hover:border-surface-600 hover:text-white"
      >
        {typeof navigator !== "undefined" && "share" in navigator ? <Share2 className="size-3.5" /> : <Link2 className="size-3.5" />}
        Share the list
      </button>
      {isOwner && !adding && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-surface-700 px-3 py-1.5 text-xs text-surface-300 transition hover:border-surface-600 hover:text-white"
        >
          <UserPlus className="size-3.5" /> Add someone
        </button>
      )}
      {isOwner && adding && (
        <div className="mt-2 w-full max-w-sm space-y-2">
          <PersonPicker value={picked} onChange={setPicked} multiple={false} placeholder="Their username" />
          <div className="flex items-center gap-2">
            <button type="button" onClick={add} disabled={busy || picked[0]?.kind !== "user"} className="btn-primary rounded-full px-4 py-1.5 text-xs disabled:opacity-50">
              Add to this list
            </button>
            <button type="button" onClick={() => { setAdding(false); setPicked([]); }} className="text-xs text-surface-500 hover:text-white">
              Cancel
            </button>
          </div>
          <p className="text-[11px] text-surface-600">They can add and remove titles. Only you can change the list itself.</p>
        </div>
      )}
    </div>
  );
}
