"use client";

import { useState } from "react";
import useSWR from "swr";
import { Plus } from "lucide-react";
import Link from "@components/ui/AppLink";
import Mosaic from "@components/ds/Mosaic";
import CreateListModal from "@components/profile/CreateListModal";
import { fetchListsBy } from "@/lib/db/lists";
import { listPath } from "@/utils/urls";

/** A person's lists as four-poster covers; their own private ones only to them (RLS, 050). */
export default function ProfileLists({ userId, isOwner }: { userId: string; isOwner: boolean }) {
  const { data, isLoading, mutate } = useSWR(["profile-lists", userId], () => fetchListsBy([userId], 60), { revalidateOnFocus: false });
  const [creating, setCreating] = useState(false);
  const lists = data ?? [];

  return (
    <div className="flex flex-col gap-4">
      {isOwner && (
        <>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex h-10 items-center gap-2 self-start rounded-full px-4 text-sm font-medium text-ink-200 ring-1 ring-inset ring-line-input hover:bg-hover hover:text-ink-0"
          >
            <Plus className="size-4" aria-hidden />
            New list
          </button>
          <CreateListModal open={creating} onClose={() => setCreating(false)} onSuccess={() => void mutate()} />
        </>
      )}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="aspect-2/3 rounded-media bg-raised" />
          ))}
        </div>
      ) : lists.length === 0 ? (
        <p className="text-sm text-ink-500">{isOwner ? "No lists yet. A list can be three films." : "No lists yet."}</p>
      ) : (
        <ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4">
          {lists.map((l) => (
            <li key={l.id} className="min-w-0">
              <Link href={listPath(l.id, l.name)} className="group block">
                <Mosaic posters={l.posters} className="transition-opacity group-hover:opacity-90" />
                <span className="mt-2 block truncate font-display text-base text-ink-0">{l.name}</span>
                <span className="block text-xs text-ink-500">
                  {l.count} {l.count === 1 ? "title" : "titles"}
                  {l.visibility === "private" ? " · only you" : l.visibility === "followers" ? " · followers" : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
