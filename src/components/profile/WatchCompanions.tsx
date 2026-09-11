"use client";

import useSWR from "swr";
import Link from "@components/ui/AppLink";
import { Users } from "lucide-react";
import Avatar from "@components/ui/Avatar";
import { fetchWatchCompanions } from "@/lib/db/viewings";
import { useInView } from "@/hooks/useInView";

/**
 * The people somebody watches with.
 *
 * A viewing with a name on it is a memory; this is the strip that shows a
 * profile is a person with people, not a library. Names that are not on
 * letsee render as plain text — a partner who never made an account is
 * still the person you watch everything with.
 *
 * Renders nothing when there is nothing, in the `PopularReviews` shape: the
 * placeholder has to exist for the in-view sentinel to attach to.
 */
export default function WatchCompanions({ userId, isOwner }: { userId: string; isOwner: boolean }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const { data } = useSWR(inView ? ["watch-companions", userId] : null, () =>
    fetchWatchCompanions(userId, 8),
  );

  if (!inView) return <div ref={ref} aria-hidden className="h-px" />;
  if (!data || data.length === 0) return null;

  return (
    <section ref={ref}>
      <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <span className="w-1 h-5 rounded-full bg-brand-500" />
        <Users className="size-4 text-brand-400" />
        {isOwner ? "People you watch with" : "Watches with"}
      </h2>
      <ul className="flex flex-wrap gap-2">
        {data.map((c) => {
          const label = c.username ?? c.name ?? "";
          const body = (
            <span className="inline-flex items-center gap-2 rounded-full border border-surface-800 bg-surface-900/60 py-1.5 pl-1.5 pr-3 text-sm text-surface-200 transition hover:border-surface-700">
              <Avatar src={c.avatarUrl} name={label} size="sm" />
              <span className="font-medium">{label}</span>
              <span className="text-xs text-surface-500 tabular-nums">
                {c.viewings} {c.viewings === 1 ? "time" : "times"}
              </span>
            </span>
          );
          return (
            <li key={c.userId ?? `n:${label}`}>
              {c.username ? <Link href={`/app/profile/${c.username}`}>{body}</Link> : body}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
