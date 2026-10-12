"use client";

import { useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { LoaderCircle, Search } from "lucide-react";
import Sheet from "@components/ds/Sheet";
import Avatar from "@components/ui/Avatar";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { fetchRecipients } from "@/lib/db/recipients";
import { episodeLabel } from "@/lib/logging/episodes";
import { aboutQuery, type EpisodeRef } from "@/lib/people/reactions";

/**
 * React to an episode: pick who to tell, and their room opens with the
 * reaction tagged (lib/people/reactions). They read it once they've reached
 * that episode — so you can say what you thought tonight without spoiling
 * anyone who's behind.
 *
 * Your people first (mutuals, then who you follow, then who follows you),
 * the same list as Pass to… (lib/db/recipients). One read when it opens.
 */
export default function ReactSheet({ open, onClose, episode }: { open: boolean; onClose: () => void; episode: EpisodeRef }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`React to ${episodeLabel(episode)}`}
      description={`${episode.show_name} · it stays closed for them until they've watched it.`}
    >
      {open && <Body episode={episode} onClose={onClose} />}
    </Sheet>
  );
}

function Body({ episode, onClose }: { episode: EpisodeRef; onClose: () => void }) {
  const { user } = useAuth();
  const me = user?.id ?? null;
  const router = useRouter();
  const [q, setQ] = useState("");
  const { data, isLoading } = useSWR(me ? ["react-recipients", me, q.trim()] : null, () => fetchRecipients(me!, q), { revalidateOnFocus: false, keepPreviousData: true });
  const people = data?.connections ?? [];

  const go = (username: string) => {
    onClose();
    router.push(`/app/people/${encodeURIComponent(username)}?${aboutQuery(episode)}`);
  };

  return (
    <div className="grid gap-4">
      <label className="relative block">
        <span className="sr-only">Find someone</span>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-500" aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Your people"
          autoComplete="off"
          className="h-11 w-full rounded-control bg-raised pl-10 pr-10 text-base text-ink-0 ring-1 ring-inset ring-line-input placeholder:text-ink-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        />
        {isLoading && <LoaderCircle className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-ink-500" aria-hidden />}
      </label>
      {people.length ? (
        <ul className="-mx-2 grid gap-1">
          {people.slice(0, 12).map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => go(p.username)} className="flex w-full items-center gap-3 rounded-control px-2 py-2 text-left transition-colors hover:bg-hover">
                <Avatar src={p.avatarUrl} name={p.username} size={36} />
                <span className="min-w-0 flex-1 truncate text-base text-ink-0">{p.username}</span>
                {p.mutual && <span className="text-xs text-ink-500">you follow each other</span>}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        !isLoading && <p className="text-sm text-ink-500">{q.trim() ? "Nobody by that name among your people." : "Follow someone first — then you can tell them."}</p>
      )}
    </div>
  );
}
