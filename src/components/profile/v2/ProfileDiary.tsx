"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Share2 } from "lucide-react";
import { createViewingLink } from "@/lib/db/shareLinks";
import { passLinkUrl } from "@/lib/people/invite";
import { offerLink } from "@components/ds/offerLink";
import useSWRInfinite from "swr/infinite";
import Link from "@components/ui/AppLink";
import Stub from "@components/ds/Stub";
import DiaryCalendar from "@components/profile/DiaryCalendar";
import { fetchDiary } from "@/lib/db/viewings";
import { getPosterUrl } from "@/utils/imageUrl";
import { titlePath } from "@/utils/urls";

/**
 * The diary (docs/design/RETHINK.md §8, "Diary calendar → You → Diary"):
 * every viewing as a stub, a month at a time, newest first — the film, the
 * day, who was there, a rewatch said as one. The year's calendar sits above
 * as the overview; the stubs are the record.
 *
 * Read in the browser; `viewings_select_profile_visible` decides whether a
 * visitor sees any of it. Pages of 40, walking back by date.
 */
const PAGE = 40;
type Entry = Awaited<ReturnType<typeof fetchDiary>>[number];

function monthLabel(day: string): string {
  const [y, m] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { timeZone: "UTC", month: "long", year: "numeric" });
}

function stamp(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
}

const PLACE: Record<string, string> = { cinema: "at the cinema", other: "out" };

export default function ProfileDiary({ userId, isOwner }: { userId: string; isOwner: boolean }) {
  const [showCalendar, setShowCalendar] = useState(false);
  const { data, size, setSize, isLoading } = useSWRInfinite(
    (index, previous: Entry[] | null) => {
      if (previous && previous.length < PAGE) return null;
      const last = previous?.length ? previous[previous.length - 1] : null;
      return ["diary", userId, index, last ? `${last.watchedOn}:${last.id}` : null];
    },
    ([, , , cursor]) => {
      const [day, id] = typeof cursor === "string" ? cursor.split(":") : [];
      return fetchDiary(userId, { limit: PAGE, ...(day ? { before: { day, id: Number(id) } } : {}) });
    },
    { revalidateOnFocus: false },
  );

  const entries = (data ?? []).flat().filter((e) => e.itemName);

  // One night, as a link for anyone (migration 109): the title, the day, and
  // how many were there — never who.
  const shareNight = async (viewingId: number, name: string) => {
    const { token, error } = await createViewingLink(viewingId);
    if (!token) {
      toast.error(error ?? "Couldn't make the link.");
      return;
    }
    await offerLink({ title: name, text: `I watched ${name}.`, url: passLinkUrl(token) }, "Link copied. It works for 30 days.");
  };
  const more = !!data && (data[data.length - 1]?.length ?? 0) === PAGE;

  if (isLoading && !entries.length) {
    return (
      <div className="grid gap-3" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 rounded-card bg-raised" />
        ))}
      </div>
    );
  }
  if (!entries.length) {
    return <p className="text-sm text-ink-500">{isOwner ? "Nothing logged yet. Log something you watched and it starts here." : "Nothing here yet."}</p>;
  }

  const months: { label: string; items: Entry[] }[] = [];
  for (const e of entries) {
    const label = monthLabel(e.watchedOn);
    const last = months[months.length - 1];
    if (last?.label === label) last.items.push(e);
    else months.push({ label, items: [e] });
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <button
          type="button"
          onClick={() => setShowCalendar((v) => !v)}
          aria-expanded={showCalendar}
          className="text-sm text-ink-400 underline decoration-line-input underline-offset-4 hover:text-ink-0"
        >
          {showCalendar ? "Hide the year at a glance" : "The year at a glance"}
        </button>
        {showCalendar && (
          <div className="mt-4">
            <DiaryCalendar userId={userId} isOwner={isOwner} />
          </div>
        )}
      </div>

      {months.map((m) => (
        <section key={m.label} aria-label={m.label}>
          <h3 className="mb-3 flex items-baseline justify-between gap-3 font-sans text-sm font-medium text-ink-0">
            {m.label}
            <span className="font-mono text-xs tabular-nums text-ink-500">{m.items.length}</span>
          </h3>
          <ol className="flex flex-col gap-2">
            {m.items.map((e) => {
              const people = e.companions.filter((c) => c.username).map((c) => ({ username: c.username!, avatarUrl: c.avatarUrl }));
              const named = e.companions.filter((c) => !c.username && c.name).map((c) => c.name!);
              const meta = [e.rewatch ? "Rewatch" : null, PLACE[e.place] ?? null, named.length ? `with ${named.join(", ")}` : null].filter(Boolean).join(" · ");
              return (
                <li key={e.id} className="flex items-center gap-2">
                  <Link href={titlePath(e.itemType, e.itemId, e.itemName)} className="block min-w-0 flex-1 rounded-card transition-opacity hover:opacity-90">
                    <Stub
                      size="compact"
                      title={e.itemName}
                      poster={getPosterUrl(e.imageUrl, "w154")}
                      meta={meta || (e.itemType === "tv" ? "Series" : "Film")}
                      date={stamp(e.watchedOn)}
                      people={people}
                    />
                  </Link>
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => void shareNight(e.id, e.itemName)}
                      aria-label={`Share this night: ${e.itemName}`}
                      title="Share this night"
                      className="flex size-10 shrink-0 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-hover hover:text-ink-0"
                    >
                      <Share2 className="size-4" aria-hidden />
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}

      {more && (
        <button
          type="button"
          onClick={() => void setSize(size + 1)}
          className="inline-flex h-10 w-full items-center justify-center rounded-full text-sm font-medium text-ink-200 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover hover:text-ink-0"
        >
          Earlier
        </button>
      )}
    </div>
  );
}
