"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import toast from "react-hot-toast";
import { ArrowLeft, Plus, Search, Share2, X } from "lucide-react";
import Link from "@components/ui/AppLink";
import Avatar from "@components/ui/Avatar";
import Mosaic from "@components/ds/Mosaic";
import Sheet from "@components/ds/Sheet";
import TitlePicker, { type PickedTitle } from "@components/ds/TitlePicker";
import { QuickMarkButton } from "@components/ds/QuickMarks";
import LikeButton from "@components/reactions/LikeButton";
import ListPeople from "@components/profile/ListPeople";
import SeenOf from "@components/ui/SeenOf";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { supabase } from "@/utils/supabase/client";
import { getPosterUrl } from "@/utils/imageUrl";
import { listPath, titlePath } from "@/utils/urls";
import { createListLink } from "@/lib/db/shareLinks";
import { passLinkUrl } from "@/lib/people/invite";
import { offerLink } from "@components/ds/offerLink";

/**
 * A list (docs/design/PAGES.md §6): its four-poster cover, its title, who made
 * it and who keeps it with them, how many of its titles you have seen, then
 * **Save**, **Share** and — for its keepers — **Add**; then the titles, each
 * with whoever added it and a one-tap Log.
 *
 * Read in the browser under the viewer's own RLS (050 decides who may see a
 * list and its items). Adding and removing still go through
 * `/api/user-lists/[id]/items`, which checks who may edit.
 */
type Item = {
  id: number;
  item_id: string;
  item_type: string;
  item_name: string;
  image_url: string | null;
  position: number;
  created_at: string;
  added_by: string | null;
  /** Why it's on the list, in a keeper's words (113). */
  note: string | null;
};

type Sort = "list" | "recent" | "name";

async function fetchList(listId: number, me: string | null) {
  const { data: list } = await supabase.from("user_lists").select("id, user_id, name, description, visibility, updated_at").eq("id", listId).maybeSingle();
  if (!list) return null;
  const [{ data: items }, { data: owner }, collab] = await Promise.all([
    supabase.from("user_list_items").select("id, item_id, item_type, item_name, image_url, position, created_at, added_by, note").eq("list_id", listId).order("position", { ascending: true }).limit(1000),
    supabase.from("users").select("id, username, avatar_url").eq("id", list.user_id).maybeSingle(),
    me && me !== list.user_id
      ? supabase.from("user_list_collaborators").select("user_id").eq("list_id", listId).eq("user_id", me).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const adderIds = [...new Set((items ?? []).map((i) => i.added_by).filter((id): id is string => !!id && id !== list.user_id))];
  const { data: adders } = adderIds.length ? await supabase.from("users").select("id, username").in("id", adderIds) : { data: [] };
  return {
    list,
    items: (items ?? []) as Item[],
    owner,
    isOwner: me === list.user_id,
    canEdit: me === list.user_id || !!collab.data,
    adders: new Map((adders ?? []).map((a) => [a.id, a.username as string])),
  };
}

export default function ListDetail({ listId }: { listId: number }) {
  const { user, status } = useAuth();
  const me = status === "ok" ? user?.id ?? null : null;
  const { data, isLoading, mutate } = useSWR(status === "loading" ? null : ["list", listId, me], () => fetchList(listId, me), { revalidateOnFocus: false });

  if (isLoading || status === "loading") {
    return (
      <div className="mx-auto w-full max-w-read px-4 pt-10" aria-hidden>
        <div className="flex gap-5">
          <div className="aspect-2/3 w-32 rounded-media bg-raised" />
          <div className="flex-1 space-y-3 pt-2">
            <div className="h-8 w-2/3 rounded bg-raised" />
            <div className="h-4 w-1/3 rounded bg-raised" />
          </div>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="mx-auto w-full max-w-read px-4 py-24 text-center">
        <p className="font-display text-2xl text-ink-0">This list is private, or it isn’t here any more.</p>
        <Link href="/app/lists" className="mt-6 inline-flex h-10 items-center rounded-full px-4 text-sm font-medium text-ink-200 ring-1 ring-inset ring-line-input hover:bg-hover">
          Other lists
        </Link>
      </div>
    );
  }

  return <ListBody data={data} refresh={() => void mutate()} />;
}

export type ListData = NonNullable<Awaited<ReturnType<typeof fetchList>>>;

/** The list itself, given its data. */
export function ListBody({ data, refresh }: { data: ListData; refresh: () => void }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("list");
  const [adding, setAdding] = useState(false);
  const { list, items, owner, canEdit, isOwner, adders } = data;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = items.filter((i) => !q || i.item_name.toLowerCase().includes(q));
    if (sort === "recent") return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (sort === "name") return [...rows].sort((a, b) => a.item_name.localeCompare(b.item_name));
    return rows;
  }, [items, query, sort]);

  // A public list shares its own address. A private or followers-only list,
  // shared by its owner, shares a link that opens it for anyone for thirty
  // days (migration 109) — its address alone would show them nothing.
  const share = async () => {
    let url = `${window.location.origin}${listPath(list.id, list.name)}`;
    if (isOwner && list.visibility !== "public") {
      const { token, error } = await createListLink(list.id);
      if (!token) {
        toast.error(error ?? "Couldn't make the link.");
        return;
      }
      url = passLinkUrl(token);
    }
    await offerLink({ title: list.name, url }, isOwner && list.visibility !== "public" ? "Link copied. It opens the list for anyone, for 30 days." : "Link copied");
  };

  /** `note`: put back with the entry when Undo restores one (113). */
  const add = async (t: PickedTitle, note?: string | null) => {
    const res = await fetch(`/api/user-lists/${list.id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ itemId: t.itemId, itemType: t.itemType, name: t.itemName, imgUrl: t.imageUrl ?? undefined, adult: false }),
    }).catch(() => null);
    if (!res?.ok) {
      toast.error(res?.status === 409 ? "That's already on the list." : "Couldn't add that.");
      return;
    }
    if (note) {
      await supabase.from("user_list_items").update({ note }).eq("list_id", list.id).eq("item_id", t.itemId).eq("item_type", t.itemType);
    }
    toast.success(`Added ${t.itemName}`);
    refresh();
  };

  const remove = async (item: Item) => {
    const res = await fetch(`/api/user-lists/${list.id}/items?itemId=${encodeURIComponent(item.item_id)}`, { method: "DELETE", credentials: "include" }).catch(() => null);
    if (!res?.ok) {
      toast.error("Couldn't remove that.");
      return;
    }
    refresh();
    toast(
      (t) => (
        <span className="flex items-center gap-3">
          Removed {item.item_name}
          <button
            type="button"
            className="rounded-full px-3 py-1 font-medium ring-1 ring-inset ring-line-input"
            onClick={() => {
              toast.dismiss(t.id);
              void add({ itemId: item.item_id, itemType: item.item_type === "tv" ? "tv" : "movie", itemName: item.item_name, imageUrl: item.image_url, year: null }, item.note);
            }}
          >
            Undo
          </button>
        </span>
      ),
      { duration: 6000 },
    );
  };

  const visibility = list.visibility === "public" ? "Anyone with the link" : list.visibility === "followers" ? "Followers" : "Only you and its keepers";

  return (
    <div className="mx-auto flex w-full max-w-read flex-col gap-8 px-4 pb-16 pt-6 sm:pt-10">
      <Link href="/app/lists" className="inline-flex items-center gap-1.5 self-start text-sm text-ink-500 hover:text-ink-0">
        <ArrowLeft className="size-4" aria-hidden />
        Lists
      </Link>

      <header className="flex gap-5">
        <Mosaic posters={items.slice(0, 4).map((i) => i.image_url)} className="w-28 shrink-0 sm:w-36" />
        <div className="min-w-0 self-end">
          <h1 className="break-words text-3xl leading-tight text-ink-0 sm:text-4xl">{list.name}</h1>
          {owner?.username && (
            <Link href={`/app/profile/${encodeURIComponent(owner.username)}`} className="mt-2 inline-flex items-center gap-2 text-sm text-ink-300 hover:text-ink-0">
              <Avatar src={owner.avatar_url} name={owner.username} size={22} />
              {isOwner ? "Yours" : owner.username}
            </Link>
          )}
          <p className="mt-1 text-xs text-ink-500">
            {items.length} {items.length === 1 ? "title" : "titles"} · {visibility}
          </p>
        </div>
      </header>

      {list.description && <p className="font-display text-lg italic leading-relaxed text-ink-300">{list.description}</p>}

      <div className="flex flex-col gap-3">
        <ListPeople listId={list.id} listName={list.name} isOwner={isOwner} visibility={list.visibility} showShare={false} />
        <SeenOf items={items.map((i) => ({ id: i.item_id, type: i.item_type }))} noun="on this list" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <LikeButton targetType="list" targetId={list.id} />
        <button type="button" onClick={share} className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium text-ink-200 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0">
          <Share2 className="size-4" aria-hidden />
          Share
        </button>
        {canEdit && (
          <button type="button" onClick={() => setAdding(true)} className="inline-flex h-10 items-center gap-2 rounded-full bg-action px-4 text-sm font-semibold text-on-action hover:bg-action-hover">
            <Plus className="size-4" aria-hidden />
            Add
          </button>
        )}
      </div>

      {items.length > 8 && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-0 flex-1 basis-48">
            <span className="sr-only">Search this list</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-500" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${items.length} titles`}
              className="h-10 w-full rounded-full bg-raised pl-9 pr-3 text-sm text-ink-0 ring-1 ring-inset ring-line-input placeholder:text-ink-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            />
          </label>
          <label className="sr-only" htmlFor="list-sort">
            Sort
          </label>
          <select
            id="list-sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="h-10 rounded-full bg-raised px-4 text-sm text-ink-200 ring-1 ring-inset ring-line-input focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <option value="list">List order</option>
            <option value="recent">Recently added</option>
            <option value="name">A to Z</option>
          </select>
        </div>
      )}

      {items.length === 0 ? (
        <p className="rounded-card border border-line-strong px-5 py-6 text-sm text-ink-400">
          {canEdit ? "Nothing on it yet. Add the first title, or invite someone to add with you." : "Nothing on this list yet."}
        </p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-ink-500">Nothing on this list by that name.</p>
      ) : (
        <ol className="divide-y divide-line">
          {shown.map((item, i) => {
            const type = item.item_type === "tv" ? "tv" : "movie";
            const adder = item.added_by ? adders.get(item.added_by) : null;
            return (
              <li key={item.id} className="flex items-center gap-3.5 py-2.5">
                {sort === "list" && !query && <span className="w-6 shrink-0 text-right font-mono text-xs tabular-nums text-ink-600">{i + 1}</span>}
                <Link href={titlePath(type, item.item_id, item.item_name)} aria-label={`Open ${item.item_name}`} className="shrink-0">
                  <img src={getPosterUrl(item.image_url, "w92")} alt="" loading="lazy" className="aspect-2/3 w-12 rounded-media bg-hover object-cover" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={titlePath(type, item.item_id, item.item_name)} className="block truncate font-display text-base text-ink-0 hover:underline">
                    {item.item_name}
                  </Link>
                  <EntryNote key={`${item.id}:${item.note ?? ""}`} item={item} canEdit={canEdit} meta={`${type === "tv" ? "Series" : "Film"}${adder ? ` · added by ${adder}` : ""}`} onSaved={refresh} />
                </div>
                <QuickMarkButton title={{ itemId: item.item_id, itemType: type, itemName: item.item_name, imageUrl: item.image_url }} />
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => void remove(item)}
                    aria-label={`Remove ${item.item_name} from the list`}
                    className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-500 hover:bg-hover hover:text-ink-0"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {canEdit && (
        <Sheet open={adding} onClose={() => setAdding(false)} title={`Add to ${list.name}`}>
          <TitlePicker
            onPick={(t) => {
              void add(t);
              setAdding(false);
            }}
            placeholder="Which film or series?"
          />
        </Sheet>
      )}
    </div>
  );
}

/**
 * An entry's meta line and its note (113). Anyone who can see the list reads
 * the note; its keepers write it in place — tap it, or *Add a note* at the end
 * of the line — and it saves on Enter or on leaving the field, straight to the
 * row under `user_list_items_update_editor`. Empty clears it.
 */
function EntryNote({ item, canEdit, meta, onSaved }: { item: Item; canEdit: boolean; meta: string; onSaved: () => void }) {
  const [shown, setShown] = useState(item.note);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.note ?? "");

  const save = async () => {
    setEditing(false);
    const next = value.trim();
    if (next === (shown ?? "")) return;
    const before = shown;
    setShown(next || null);
    // `.select` so a refused update (RLS: no longer a keeper) is seen as one —
    // it returns no rows rather than an error.
    const { data, error } = await supabase.from("user_list_items").update({ note: next || null }).eq("id", item.id).select("id");
    if (error || !data?.length) {
      setShown(before);
      toast.error(error ? "That note didn't save." : "You can't change notes on this list any more.");
      return;
    }
    onSaved();
  };
  const start = () => {
    setValue(shown ?? "");
    setEditing(true);
  };

  return (
    <>
      <p className="truncate text-xs text-ink-500">
        {meta}
        {canEdit && !shown && !editing && (
          <>
            {" · "}
            <button type="button" onClick={start} className="underline decoration-line-input underline-offset-4 hover:text-ink-0">
              Add a note
            </button>
          </>
        )}
      </p>
      {editing ? (
        <input
          autoFocus
          value={value}
          maxLength={280}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => void save()}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setValue(shown ?? "");
              setEditing(false);
            }
          }}
          aria-label={`Note on ${item.item_name}`}
          placeholder="Why it's here"
          className="mt-1.5 h-9 w-full rounded-control bg-raised px-3 font-display text-sm italic text-ink-0 ring-1 ring-inset ring-line-input placeholder:not-italic placeholder:text-ink-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        />
      ) : shown ? (
        canEdit ? (
          <button type="button" onClick={start} aria-label={`Edit the note on ${item.item_name}: ${shown}`} className="mt-1 block max-w-full text-left font-display text-sm italic leading-snug text-ink-300 hover:text-ink-0">
            “{shown}”
          </button>
        ) : (
          <p className="mt-1 font-display text-sm italic leading-snug text-ink-300">“{shown}”</p>
        )
      ) : null}
    </>
  );
}
