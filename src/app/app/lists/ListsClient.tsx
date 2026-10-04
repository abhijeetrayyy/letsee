"use client";

import { useState } from "react";
import useSWR from "swr";
import { Plus } from "lucide-react";
import Link from "@components/ui/AppLink";
import Avatar from "@components/ui/Avatar";
import Mosaic from "@components/ds/Mosaic";
import CreateListModal from "@components/profile/CreateListModal";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { fetchRoomList } from "@/lib/db/rooms";
import { fetchListsBy, fetchMyLists, fetchPopularLists, type ListCard } from "@/lib/db/lists";
import { listPath } from "@/utils/urls";
import { fetchDiary } from "@/lib/db/viewings";
import { getPosterUrl } from "@/utils/imageUrl";

/**
 * Lists (docs/design/PAGES.md §6): **Yours** — the ones you made and the ones
 * you help keep — then **From your people**, then popular. Each card is the
 * list's first four posters with its maker's face. Read in the browser under
 * the viewer's own RLS; the page itself is static.
 */
export function ListsClient() {
  const { user, status } = useAuth();
  const me = status === "ok" ? user?.id ?? null : null;
  const [creating, setCreating] = useState(false);
  const [idea, setIdea] = useState("");
  const [opening, setOpening] = useState(0);
  const start = (name: string) => {
    setIdea(name);
    setOpening((n) => n + 1);
    setCreating(true);
  };

  const { data: mine, mutate } = useSWR(me ? ["lists-mine", me] : null, () => fetchMyLists(me!), { revalidateOnFocus: false });
  const { data: recent } = useSWR(me && mine?.length === 0 ? ["lists-recent-posters", me] : null, () => fetchDiary(me!, { limit: 12 }), { revalidateOnFocus: false });
  const { data: rooms } = useSWR(me ? ["rooms", me] : null, () => fetchRoomList(me!), { revalidateOnFocus: false });
  const peopleIds = (rooms?.people ?? []).slice(0, 24).map((p) => p.person.id);
  const { data: theirs } = useSWR(peopleIds.length ? ["lists-people", peopleIds.join(",")] : null, () => fetchListsBy(peopleIds), { revalidateOnFocus: false });
  const { data: popular, isLoading } = useSWR(["lists-popular"], () => fetchPopularLists(), { revalidateOnFocus: false });

  const shown = new Set([...(mine ?? []), ...(theirs ?? [])].map((l) => l.id));

  return (
    <div className="mx-auto flex w-full max-w-app flex-col gap-10 px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl text-ink-0 sm:text-5xl">Lists</h1>
          <p className="mt-1 max-w-read text-base text-ink-400">A handful of titles that belong together — a director’s run, a mood, a year worth revisiting.</p>
        </div>
        {me ? (
          <button type="button" onClick={() => start("")} className="inline-flex h-10 items-center gap-2 rounded-full bg-action px-4 text-sm font-semibold text-on-action hover:bg-action-hover">
            <Plus className="size-4" aria-hidden />
            New list
          </button>
        ) : (
          <Link href="/signup" className="inline-flex h-10 items-center rounded-full bg-action px-4 text-sm font-semibold text-on-action hover:bg-action-hover">
            Join to make one
          </Link>
        )}
      </header>
      {me && <CreateListModal key={opening} initialName={idea} open={creating} onClose={() => setCreating(false)} onSuccess={() => void mutate()} />}

      {me && (
        <Section title="Yours">
          {mine && mine.length === 0 ? (
            <StartAList posters={[...new Map((recent ?? []).filter((v) => v.imageUrl).map((v) => [`${v.itemType}:${v.itemId}`, getPosterUrl(v.imageUrl, "w342")])).values()]} onStart={start} />
          ) : (
            <Grid lists={mine} />
          )}
        </Section>
      )}

      {(theirs ?? []).length > 0 && (
        <Section title="From your people">
          <Grid lists={theirs} />
        </Section>
      )}

      <Section title="Popular">
        {isLoading ? <Grid lists={undefined} /> : (popular ?? []).filter((l) => !shown.has(l.id)).length ? <Grid lists={(popular ?? []).filter((l) => !shown.has(l.id))} /> : <p className="text-sm text-ink-500">No public lists yet.</p>}
      </Section>
    </div>
  );
}

/** Ideas a first list can start from; each opens the new-list sheet with its name filled in. */
const IDEAS = ["Films I'd show a friend", `The best of ${new Date().getFullYear()}`, "Comfort watches", "A director's run", "Watch these together"];

/**
 * No lists yet: a cover made of what you've watched lately — the shape a
 * list takes — and a few ideas that start one, instead of a line of grey text.
 */
function StartAList({ posters, onStart }: { posters: string[]; onStart: (name: string) => void }) {
  return (
    <div className="flex flex-col gap-6 rounded-card border border-line-strong bg-raised p-5 sm:flex-row sm:items-center sm:p-6">
      <div className="w-32 shrink-0 sm:w-40">
        <Mosaic posters={posters.slice(0, 4)} />
      </div>
      <div className="min-w-0">
        <p className="font-display text-2xl text-ink-0">Start with three films.</p>
        <p className="mt-1 max-w-read text-sm text-ink-400">A list is a handful of titles that belong together. Make one alone, or invite someone to add to it.</p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {IDEAS.map((name) => (
            <li key={name}>
              <button type="button" onClick={() => onStart(name)} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium text-ink-200 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover hover:text-ink-0">
                <Plus className="size-3.5" aria-hidden />
                {name}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="mb-4 text-xl text-ink-0">{title}</h2>
      {children}
    </section>
  );
}

function Grid({ lists }: { lists: ListCard[] | undefined }) {
  if (!lists) {
    return (
      <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <li key={i} className="aspect-2/3 rounded-media bg-raised" />
        ))}
      </ul>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
      {lists.map((l) => (
        <li key={l.id} className="min-w-0">
          <Link href={listPath(l.id, l.name)} className="group block">
            <Mosaic posters={l.posters} className="transition-opacity group-hover:opacity-90" />
            <span className="mt-2 block truncate font-display text-base text-ink-0">{l.name}</span>
            <span className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-500">
              {l.owner && <Avatar src={l.owner.avatarUrl} name={l.owner.username} size={18} />}
              <span className="truncate">
                {[l.owner?.username, `${l.count} ${l.count === 1 ? "title" : "titles"}`, l.visibility !== "public" ? (l.visibility === "private" ? "only you" : "followers") : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
