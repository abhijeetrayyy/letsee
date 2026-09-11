"use client";

import { useMemo } from "react";
import useSWR from "swr";
import Link from "@components/ui/AppLink";
import { History } from "lucide-react";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { supabase } from "@/utils/supabase/client";
import { getPosterUrl } from "@/utils/imageUrl";
import { titlePath } from "@/utils/urls";
import { monthBounds, previousMonth } from "@/utils/monthInReview";
import { titleMetaFor } from "@/utils/viewings";

/**
 * "A year ago today you and Priya watched Past Lives."
 *
 * Resurfacing a positive logged memory improves momentary mood with one of
 * the largest effects in the whole literature (Konrad et al. 2016, d ≈ 1.15);
 * resurfacing a negative one while happy makes it worse. So this filters by
 * valence — a rating of 7 or above, a rewatch, or somebody being there — and
 * never shows the film you hated on this day in 2021.
 *
 * Also carries the month card's doorway: in the first week of a month, one
 * line pointing at last month's recap, for anyone who logged enough to have one.
 *
 * Renders nothing when there is nothing; the placeholder keeps its height at
 * zero so an empty day costs the page no space.
 */

type Row = {
  id: number;
  item_id: string;
  item_type: string;
  watched_on: string;
  rewatch: boolean;
  viewing_companions:
    | { companion_user_id: string | null; name: string | null; users: { username: string | null } | { username: string | null }[] | null }[]
    | null;
};

function mmdd(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function OnThisDay() {
  const { user, ready } = useAuth();
  const userId = user?.id ?? null;
  const today = useMemo(() => new Date(), []);
  const key = mmdd(today);
  const thisYear = today.getFullYear();

  const { data } = useSWR(userId ? ["on-this-day", userId, key] : null, async () => {
    // Every prior year on this month-day. Cheap: the user's own rows, indexed
    // by (user_id, watched_on), and the filter is client-side over what is
    // usually a handful of matches per date.
    const dates: string[] = [];
    for (let y = thisYear - 1; y >= thisYear - 15; y--) dates.push(`${y}-${key}`);
    const { data: viewingRows } = await supabase
      .from("viewings")
      .select("id, item_id, item_type, watched_on, rewatch, viewing_companions!viewing_id(companion_user_id, name, users(username))")
      .eq("user_id", userId as string)
      .in("watched_on", dates)
      .order("watched_on", { ascending: false })
      .limit(20);
    const rows = (viewingRows ?? []) as unknown as Row[];
    if (!rows.length) return { memories: [] as Memory[] };
    const ids = [...new Set(rows.map((r) => r.item_id))];
    // Scoped to the handful of titles above, not the whole ratings table.
    const [{ data: ratings }, names] = await Promise.all([
      supabase.from("user_ratings").select("item_id, item_type, score").eq("user_id", userId as string).in("item_id", ids),
      titleMetaFor(supabase, userId as string, ids),
    ]);
    const scores = new Map((ratings ?? []).map((r) => [`${r.item_type}:${r.item_id}`, Number(r.score)]));
    const memories: Memory[] = rows
      .map((r) => {
        const k = `${r.item_type}:${r.item_id}`;
        const score = scores.get(k) ?? null;
        const companions = (r.viewing_companions ?? [])
          .map((c) => {
            const u = Array.isArray(c.users) ? c.users[0] : c.users;
            return u?.username ?? c.name ?? "";
          })
          .filter(Boolean);
        const positive = (score !== null && score >= 7) || r.rewatch || companions.length > 0;
        return positive
          ? {
              id: r.id,
              itemId: r.item_id,
              itemType: r.item_type === "tv" ? ("tv" as const) : ("movie" as const),
              name: names.get(k)?.name ?? "",
              image: names.get(k)?.image ?? null,
              yearsAgo: thisYear - Number(r.watched_on.slice(0, 4)),
              companions,
              rewatch: r.rewatch,
            }
          : null;
      })
      .filter((m): m is Memory => !!m && !!m.name)
      .slice(0, 3);
    return { memories };
  });

  // Last month's recap doorway, for the first week of a month.
  const showMonthDoor = today.getDate() <= 7;
  const { data: lastMonthCount } = useSWR(
    userId && showMonthDoor ? ["last-month-count", userId, previousMonth(today)] : null,
    async () => {
      // The month's real last day: "-31" is not a date in September, and
      // Postgres refuses the query rather than matching nothing.
      const bounds = monthBounds(previousMonth(today));
      if (!bounds) return 0;
      const { count } = await supabase
        .from("viewings")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId as string)
        .gte("watched_on", bounds.start)
        .lte("watched_on", bounds.end);
      return count ?? 0;
    },
  );

  if (!ready || !userId) return null;
  const memories = data?.memories ?? [];
  const monthDoor = showMonthDoor && (lastMonthCount ?? 0) >= 3 && user?.username;
  if (memories.length === 0 && !monthDoor) return null;

  return (
    <section className="space-y-3">
      {memories.length > 0 && (
        <div className="rounded-2xl border border-surface-800 bg-surface-900/40 p-4 sm:p-5">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-surface-500">
            <History className="size-3.5" /> On this day
          </p>
          <ul className="space-y-3">
            {memories.map((m) => (
              <li key={m.id} className="flex items-center gap-3">
                <Link href={titlePath(m.itemType, m.itemId, m.name)} className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getPosterUrl(m.image, "w92")}
                    alt=""
                    className="h-16 w-11 rounded-md border border-surface-800 object-cover"
                  />
                </Link>
                <p className="text-sm leading-snug text-surface-200">
                  {m.yearsAgo === 1 ? "A year ago today" : `${m.yearsAgo} years ago today`}
                  {m.companions.length ? ` you and ${m.companions.slice(0, 2).join(" and ")}` : " you"}{" "}
                  watched{" "}
                  <Link href={titlePath(m.itemType, m.itemId, m.name)} className="font-semibold text-white hover:text-brand-300">
                    {m.name}
                  </Link>
                  {m.rewatch ? " again" : ""}.
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {monthDoor && (
        <Link
          href={`/app/profile/${user!.username}/month/${previousMonth(today)}`}
          className="flex items-center gap-3 rounded-2xl border border-surface-800 bg-surface-900/40 px-4 py-3 text-sm text-surface-300 transition-colors hover:border-brand-500/30"
        >
          <span className="text-surface-500">Last month, in one card.</span>
          <span className="font-medium text-white">Your {new Date(`${previousMonth(today)}-02T00:00:00`).toLocaleDateString(undefined, { month: "long" })}</span>
          <span className="ml-auto text-surface-600">→</span>
        </Link>
      )}
    </section>
  );
}

type Memory = {
  id: number;
  itemId: string;
  itemType: "movie" | "tv";
  name: string;
  image: string | null;
  yearsAgo: number;
  companions: string[];
  rewatch: boolean;
};
