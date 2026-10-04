"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import Link from "@components/ui/AppLink";
import { Loader2, Mountain, Sofa, Users, X } from "lucide-react";
import toast from "react-hot-toast";
import { getPosterUrl } from "@/utils/imageUrl";
import { personPath, titlePath } from "@/utils/urls";
import { fetchIdentitySlots, saveIdentitySlots, type IdentitySlot, type SlotKind } from "@/lib/db/identitySlots";
import ProfileSection from "@components/profile/v2/ProfileSection";

/**
 * Four people, a comfort watch, a hill to die on.
 *
 * Small, finite, editable identity surfaces are the cheapest durable reason
 * to keep a profile current, and taste is the strongest predictor of liking
 * a stranger (Launay & Dunbar 2015). Letterboxd's most-upvoted 2025 wish was
 * to extend the four favourites to people. So: three more slots, each with a
 * shape that forces a choice — four, one, one — beside the four films.
 */

type Pick = { itemId: string; itemType: "movie" | "tv" | "person"; itemName: string; imageUrl: string | null };

/**
 * `image_url` is stored as a full URL for every slot kind (the picker
 * resolves TMDB paths before saving), so this is `getPosterUrl` — which
 * passes absolute URLs through and still resolves a bare path from an
 * older row — with the person placeholder swapped in.
 */
function imageFor(it: { itemType: string; imageUrl: string | null }): string {
  if (!it.imageUrl) return it.itemType === "person" ? "/no-photo.svg" : getPosterUrl(null);
  return getPosterUrl(it.imageUrl, "w185");
}

function hrefFor(it: IdentitySlot | Pick): string {
  return it.itemType === "person" ? personPath(it.itemId, it.itemName) : titlePath(it.itemType, it.itemId, it.itemName);
}

/**
 * Its own section, "Picks", under its own head (ProfileSection) — it used to
 * sit inside Favourites with no heading of its own, three more boxes nobody
 * could place. A visitor sees only the picks that were made.
 */
export default function IdentitySlots({ userId, isOwner, username }: { userId: string; isOwner: boolean; username: string }) {
  const { data, mutate } = useSWR(["identity-slots", userId], () => fetchIdentitySlots(userId));
  const [editing, setEditing] = useState<SlotKind | null>(null);

  if (!data) return null;
  const empty = data.people.length === 0 && !data.comfort && !data.hill;
  if (empty && !isOwner) return null;

  return (
    <ProfileSection
      id="picks"
      title={isOwner ? "Your picks" : `${username}'s picks`}
      description={
        isOwner
          ? "Four people you'd follow anywhere, the one you put on when you can't decide, and a hill you'll die on."
          : `Who ${username} would follow anywhere, what they put on when they can't decide, and a hill they'll die on.`
      }
    >
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* People */}
      <Block
        icon={<Users className="size-3.5" />}
        title="Four people"
        empty={data.people.length === 0}
        emptyText={isOwner ? "The actors and directors you would follow anywhere." : ""}
        isOwner={isOwner}
        onEdit={() => setEditing("person")}
      >
        <div className="flex gap-2">
          {data.people.map((p) => (
            <Link key={p.itemId} href={hrefFor(p)} className="w-1/4 min-w-0" title={p.itemName}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageFor(p)} alt={p.itemName} className="aspect-square w-full rounded-lg object-cover" />
              <p className="mt-1 truncate text-xs text-ink-300">{p.itemName}</p>
            </Link>
          ))}
        </div>
      </Block>

      {/* Comfort watch */}
      <Block
        icon={<Sofa className="size-3.5" />}
        title="Comfort watch"
        empty={!data.comfort}
        emptyText={isOwner ? "The one you put on when you cannot decide." : ""}
        isOwner={isOwner}
        onEdit={() => setEditing("comfort")}
      >
        {data.comfort && (
          <Link href={hrefFor(data.comfort)} className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageFor(data.comfort)} alt="" className="h-20 w-14 rounded-md object-cover" />
            <span className="text-sm font-medium text-ink-0">{data.comfort.itemName}</span>
          </Link>
        )}
      </Block>

      {/* Hill */}
      <Block
        icon={<Mountain className="size-3.5" />}
        title="Hill to die on"
        empty={!data.hill}
        emptyText={isOwner ? "One title, one sentence you will defend." : ""}
        isOwner={isOwner}
        onEdit={() => setEditing("hill")}
      >
        {data.hill && (
          <div className="flex items-start gap-3">
            <Link href={hrefFor(data.hill)} aria-label="Open their hill to die on" className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageFor(data.hill)} alt="" className="h-20 w-14 rounded-md object-cover" />
            </Link>
            <div className="min-w-0">
              <Link href={hrefFor(data.hill)} className="text-sm font-medium text-ink-0 hover:text-accent-soft">
                {data.hill.itemName}
              </Link>
              {data.hill.line && <p className="mt-1 text-sm italic text-ink-300">“{data.hill.line}”</p>}
            </div>
          </div>
        )}
      </Block>

      {editing && (
        <SlotEditor
          kind={editing}
          userId={userId}
          current={editing === "person" ? data.people : editing === "comfort" ? (data.comfort ? [data.comfort] : []) : data.hill ? [data.hill] : []}
          currentLine={data.hill?.line ?? ""}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await mutate();
          }}
        />
      )}
    </div>
    </ProfileSection>
  );
}

function Block({
  icon,
  title,
  empty,
  emptyText,
  isOwner,
  onEdit,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  empty: boolean;
  emptyText: string;
  isOwner: boolean;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  if (empty && !isOwner) return null;
  return (
    <div className="flex flex-col rounded-card border border-line-strong bg-raised p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-0">
          <span className="text-ink-500">{icon}</span> {title}
        </h3>
        {isOwner && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`${empty ? "Add" : "Edit"} ${title.toLowerCase()}`}
            className="inline-flex h-8 shrink-0 items-center rounded-full px-3 text-xs font-medium text-ink-200 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover hover:text-ink-0"
          >
            {empty ? "Add" : "Edit"}
          </button>
        )}
      </div>
      {empty ? <p className="text-sm leading-relaxed text-ink-500">{emptyText}</p> : children}
    </div>
  );
}

/**
 * One editor for the three kinds. Search goes through /api/search (multi),
 * which returns people alongside titles; the kind decides which results count.
 */
function SlotEditor({
  kind,
  userId,
  current,
  currentLine,
  onClose,
  onSaved,
}: {
  kind: SlotKind;
  userId: string;
  current: IdentitySlot[];
  currentLine: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const max = kind === "person" ? 4 : 1;
  const [picked, setPicked] = useState<Pick[]>(current.map((c) => ({ itemId: c.itemId, itemType: c.itemType, itemName: c.itemName, imageUrl: c.imageUrl })));
  const [line, setLine] = useState(currentLine);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Pick[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(() => {
      fetch(`/api/search?query=${encodeURIComponent(q)}&media_type=multi`)
        .then((r) => (r.ok ? r.json() : null))
        .then((body) => {
          if (cancelled) return;
          const rows = (body?.results ?? body?.data?.results ?? []) as {
            id: number;
            media_type?: string;
            title?: string;
            name?: string;
            poster_path?: string | null;
            profile_path?: string | null;
          }[];
          const wantPeople = kind === "person";
          setResults(
            rows
              .filter((r) => (wantPeople ? r.media_type === "person" : r.media_type === "movie" || r.media_type === "tv"))
              .slice(0, 10)
              .map((r) => ({
                itemId: String(r.id),
                itemType: (wantPeople ? "person" : (r.media_type as "movie" | "tv")) as Pick["itemType"],
                itemName: r.title ?? r.name ?? "",
                // Stored as a loadable URL whatever the kind, so readers never
                // have to know whether a path is a poster or a headshot.
                imageUrl: wantPeople
                  ? r.profile_path ? getPosterUrl(r.profile_path, "w185") : null
                  : r.poster_path ? getPosterUrl(r.poster_path, "w342") : null,
              })),
          );
        })
        .catch(() => !cancelled && setResults([]))
        .finally(() => !cancelled && setSearching(false));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, kind]);

  const add = (p: Pick) => {
    setPicked((prev) => {
      if (prev.some((x) => x.itemId === p.itemId && x.itemType === p.itemType)) return prev;
      return max === 1 ? [p] : [...prev, p].slice(0, max);
    });
    setQuery("");
  };

  const save = async () => {
    setSaving(true);
    try {
      const message = await saveIdentitySlots(userId, kind, picked.map((p) => ({ ...p, line: kind === "hill" ? line : null })));
      if (message) {
        toast.error(message);
        return;
      }
      await onSaved();
    } finally {
      setSaving(false);
    }
  };

  const title = kind === "person" ? "Four people" : kind === "comfort" ? "Comfort watch" : "Hill to die on";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-sheet rounded-2xl border border-line bg-page p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink-0">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-ink-500 hover:text-ink-0">
            <X className="size-4" />
          </button>
        </div>

        {picked.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {picked.map((p) => (
              <span key={`${p.itemType}:${p.itemId}`} className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-raised py-1 pl-1 pr-2 text-xs text-ink-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageFor(p)} alt="" className="size-6 rounded-full object-cover" />
                {p.itemName}
                <button type="button" onClick={() => setPicked((prev) => prev.filter((x) => x !== p))} aria-label={`Remove ${p.itemName}`} className="text-ink-500 hover:text-ink-0">
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {picked.length < max && (
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            placeholder={kind === "person" ? "An actor or a director" : "A film or a series"}
            className="w-full rounded-lg border border-line-strong bg-raised px-3 py-2 text-sm text-ink-0 placeholder-ink-500 focus:border-accent-strong focus:outline-none"
          />
        )}
        {(results.length > 0 || searching) && picked.length < max && (
          <ul className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-line bg-raised">
            {results.map((r) => (
              <li key={`${r.itemType}:${r.itemId}`}>
                <button type="button" onClick={() => add(r)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-ink-200 hover:bg-overlay">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageFor(r)} alt="" className="h-10 w-7 rounded object-cover" />
                  {r.itemName}
                </button>
              </li>
            ))}
            {searching && (
              <li className="px-3 py-2 text-xs text-ink-600">
                <Loader2 className="inline size-3 animate-spin" />
              </li>
            )}
          </ul>
        )}

        {kind === "hill" && (
          <input
            value={line}
            onChange={(e) => setLine(e.target.value)}
            maxLength={140}
            placeholder="The sentence you will defend"
            className="mt-3 w-full rounded-lg border border-line-strong bg-raised px-3 py-2 text-sm text-ink-0 placeholder-ink-500 focus:border-accent-strong focus:outline-none"
          />
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full px-3 py-1.5 text-xs text-ink-400 hover:text-ink-0">
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving} className="btn-primary rounded-full px-4 py-1.5 text-xs disabled:opacity-50">
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
