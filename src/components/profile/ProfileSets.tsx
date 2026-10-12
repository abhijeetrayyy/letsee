"use client";

import useSWR from "swr";
import Link from "@components/ui/AppLink";
import { fetchSetItems, fetchSetProgress, fetchSets } from "@/lib/db/sets";
import { setKey, setLabel, setLine, type SetRow } from "@/lib/people/sets";
import { getPosterUrl } from "@/utils/imageUrl";
import { listPath, personPath } from "@/utils/urls";

/**
 * The sets someone is working through (docs/IDEAS_2026-10.md §2.1), on their
 * profile: what each is, a bar, "7 of 12 · 3 this year". Nothing when there
 * are none. One read for the sets; each card reads its titles (a list's
 * items, or the person's cached work) and their own marks for them.
 */
export default function ProfileSets({ userId, username, isOwner }: { userId: string; username: string; isOwner: boolean }) {
  const { data: sets } = useSWR(["sets", userId], () => fetchSets(userId), { revalidateOnFocus: false });
  if (!sets?.length) return null;
  return (
    <section aria-labelledby="profile-sets">
      <h2 id="profile-sets" className="mb-4 text-2xl text-ink-0 sm:text-3xl">
        {isOwner ? "Your sets" : `${username}'s sets`}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {sets.slice(0, 6).map((s) => (
          <SetCard key={s.id} set={s} userId={userId} />
        ))}
      </ul>
    </section>
  );
}

function SetCard({ set, userId }: { set: SetRow; userId: string }) {
  const { data: items } = useSWR(["set-items", setKey(set)], () => fetchSetItems(set), { revalidateOnFocus: false });
  const { data: progress } = useSWR(items ? ["set-progress", userId, setKey(set), items.length] : null, () => fetchSetProgress(userId, items!), { revalidateOnFocus: false });
  const href = set.kind === "list" ? listPath(set.refId, set.name) : personPath(set.refId, set.name);
  const total = items?.length ?? 0;
  const done = Math.min(progress?.done ?? 0, total);
  return (
    <li>
      <Link href={href} className="flex items-center gap-3.5 rounded-card border border-line-strong bg-raised px-3.5 py-3 transition-colors hover:bg-hover">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getPosterUrl(set.imageUrl, "w185")}
          alt=""
          loading="lazy"
          className={`shrink-0 bg-hover object-cover ${set.kind === "person" ? "size-12 rounded-full" : "aspect-2/3 w-10 rounded-media"}`}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-ink-500">{setLabel(set)}</span>
          <span className="block truncate font-display text-lg text-ink-0">{set.name}</span>
          {items && progress ? (
            <>
              <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-hover" aria-hidden>
                <span className="block h-full rounded-full bg-action" style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }} />
              </span>
              <span className="mt-1 block font-mono text-xs uppercase tracking-wide text-ink-400">{setLine({ done, total, thisYear: progress.thisYear })}</span>
            </>
          ) : (
            <span className="mt-1.5 block h-1.5 rounded-full bg-hover" aria-hidden />
          )}
        </span>
      </Link>
    </li>
  );
}
