"use client";

import useSWR from "swr";
import Link from "@components/ui/AppLink";
import Avatar from "@components/ui/Avatar";
import { useKeptSet } from "@components/sets/useKeptSet";
import { fetchSetCompany, fetchSetProgress } from "@/lib/db/sets";
import { setKey, setLine, type SetItem, type SetRef } from "@/lib/people/sets";

/**
 * A kept set's progress where it lives (a list, a person): "7 of 12 · 3 this
 * year" with a bar, and your people on the same set beside you — by name,
 * with theirs, never ranked. Shows only once you keep it; until then the
 * page's quiet "Seen N of M" stands in.
 */
export default function SetProgress({ setRef, name, imageUrl, items }: { setRef: SetRef; name: string; imageUrl: string | null; items: SetItem[] }) {
  const { kept, me } = useKeptSet(setRef, name, imageUrl);
  const ids = items.map((i) => `${i.type}:${i.id}`).join(",");
  const { data: mine } = useSWR(kept && me && items.length ? ["set-progress", me, setKey(setRef), ids] : null, () => fetchSetProgress(me!, items), { revalidateOnFocus: false });
  const { data: company } = useSWR(kept && me && items.length ? ["set-company", me, setKey(setRef), ids] : null, () => fetchSetCompany(me!, setRef, items), { revalidateOnFocus: false });
  if (!kept || !mine || !items.length) return null;
  const total = items.length;
  const pct = Math.round((Math.min(mine.done, total) / total) * 100);

  return (
    <div className="grid gap-2 rounded-card border border-line-strong bg-raised px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-xs font-medium text-ink-500">Your set</span>
        <span className="font-mono text-xs uppercase tracking-wide text-ink-300">{setLine({ done: mine.done, total, thisYear: mine.thisYear })}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-hover" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={mine.done} aria-label={`${mine.done} of ${total}`}>
        <div className="h-full rounded-full bg-action transition-all duration-500 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
      </div>
      {company && company.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-ink-400">
          <span>On it too:</span>
          {company.map((c) => (
            <Link key={c.person.id} href={`/app/people/${encodeURIComponent(c.person.username)}`} className="inline-flex items-center gap-1.5 hover:text-ink-0">
              <Avatar src={c.person.avatarUrl} name={c.person.username} size={20} />
              {c.person.username} <span className="font-mono text-xs tabular-nums text-ink-500">{c.done}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
