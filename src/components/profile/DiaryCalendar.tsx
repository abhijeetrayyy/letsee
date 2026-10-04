"use client";
import { TOKENS, TOKENS_DARK, alpha } from "@/design/tokens";
import { isDarkTheme } from "@/lib/theme";

import { useMemo } from "react";
import useSWR from "swr";
import Link from "@components/ui/AppLink";
import { CalendarDays } from "lucide-react";
import { fetchDiary } from "@/lib/db/viewings";
import { useInView } from "@/hooks/useInView";
import { titlePath } from "@/utils/urls";

/**
 * Presence without a chain.
 *
 * A streak retains until it breaks, and then it churns harder than no streak
 * would have (Duolingo's own data; Mogavi et al. 2022). A calendar keeps the
 * benefit — you can see that you show up — without creating an asset you can
 * lose. So: fifty-two weeks of days, shaded by how many viewings landed on
 * each, and no consecutive-day count anywhere on the page. Never a
 * notification about a gap, either; that rule lives in the cron.
 *
 * Read from `viewings` under RLS, so a visitor sees exactly what the profile's
 * visibility allows.
 */

const WEEKS = 52;

function iso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function DiaryCalendar({ userId, isOwner }: { userId: string; isOwner: boolean }) {
  const { ref, inView } = useInView<HTMLDivElement>();

  // The window is fixed at first render so the grid does not shift under you.
  const { start, end, days } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Align the end to a Saturday so the last column is a full week.
    const end = new Date(today);
    end.setDate(end.getDate() + (6 - end.getDay()));
    const start = new Date(end);
    start.setDate(start.getDate() - WEEKS * 7 + 1);
    const days: Date[] = [];
    // By calendar day, not by 86,400,000 ms: a local day across a DST change
    // is 23 or 25 hours long, and fixed-millisecond steps from local midnight
    // draw one date twice and skip the next.
    for (const d = new Date(start); d.getTime() <= end.getTime(); d.setDate(d.getDate() + 1)) days.push(new Date(d));
    return { start, end, days };
  }, []);

  const { data } = useSWR(inView ? ["diary-calendar", userId, iso(start)] : null, () =>
    fetchDiary(userId, { from: iso(start), to: iso(end), limit: 1000 }),
  );

  const byDay = useMemo(() => {
    const m = new Map<string, { count: number; names: string[]; first: { itemId: string; itemType: "movie" | "tv"; name: string } | null }>();
    for (const v of data ?? []) {
      const e = m.get(v.watchedOn) ?? { count: 0, names: [], first: null };
      e.count += 1;
      if (v.itemName && e.names.length < 3) e.names.push(v.itemName);
      e.first ??= { itemId: v.itemId, itemType: v.itemType, name: v.itemName };
      m.set(v.watchedOn, e);
    }
    return m;
  }, [data]);

  if (!inView) return <div ref={ref} aria-hidden className="h-px" />;
  if (!data || data.length === 0) return null;

  const total = data.length;
  const daysWith = byDay.size;
  const max = Math.max(1, ...[...byDay.values()].map((e) => e.count));
  const shade = (n: number) => {
    // The day's square in the ink of whichever theme is showing.
    const ink = isDarkTheme() ? TOKENS_DARK.ink0 : TOKENS.ink0;
    if (n === 0) return alpha(ink, 0.06);
    const t = Math.min(1, 0.35 + (n / max) * 0.65);
    return alpha(ink, Number(t.toFixed(2)));
  };

  // Month labels, one per first-of-month that falls inside the window.
  const monthLabels: { col: number; label: string }[] = [];
  days.forEach((d, i) => {
    if (d.getDate() === 1) monthLabels.push({ col: Math.floor(i / 7), label: d.toLocaleDateString(undefined, { month: "short" }) });
  });

  return (
    <section ref={ref}>
      <h2 className="text-lg font-medium text-ink-0 mb-1 flex items-center gap-2">
        <CalendarDays className="size-4 text-ink-300" />
        The last year
      </h2>
      <p className="mb-4 text-xs text-ink-500">
        {total} {total === 1 ? "viewing" : "viewings"} on {daysWith} {daysWith === 1 ? "day" : "days"}.
        {isOwner ? " Days you watched something, shaded by how much." : ""}
      </p>
      <div className="overflow-x-auto pb-2">
        <div className="relative min-w-180">
          <div className="mb-1 grid" style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))`, gap: 3 }}>
            {Array.from({ length: WEEKS }).map((_, col) => {
              const label = monthLabels.find((m) => m.col === col)?.label;
              return (
                <span key={col} className="h-4 text-xs leading-4 text-ink-500">
                  {label ?? ""}
                </span>
              );
            })}
          </div>
          <div
            className="grid grid-flow-col"
            style={{
              gridTemplateRows: "repeat(7, 11px)",
              gridAutoColumns: "minmax(0, 1fr)",
              gap: 3,
            }}
          >
            {days.map((d) => {
              const key = iso(d);
              const e = byDay.get(key);
              const n = e?.count ?? 0;
              const title = n
                ? `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}: ${e!.names.join(", ")}${n > e!.names.length ? ` +${n - e!.names.length}` : ""}`
                : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
              const cell = (
                <span
                  className="block h-2.75 w-full rounded-xs"
                  style={{ background: shade(n) }}
                  title={title}
                  aria-label={title}
                />
              );
              return e?.first ? (
                <Link key={key} href={titlePath(e.first.itemType, e.first.itemId, e.first.name)} className="block">
                  {cell}
                </Link>
              ) : (
                <span key={key} className="block">
                  {cell}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
