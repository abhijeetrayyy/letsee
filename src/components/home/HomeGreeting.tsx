"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "@components/ui/AppLink";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { supabase } from "@/utils/supabase/client";
import { getPosterUrl } from "@/utils/imageUrl";
import { titlePath } from "@/utils/urls";

/**
 * "Good evening, name".
 *
 * Two things moved to the browser here, and the second one is a fix rather than
 * a saving. The name came from a server-side session read, which is what made
 * the whole home page uncacheable. The *hour* came from `new Date().getHours()`
 * on the server — so the greeting was computed in the region the function
 * happened to run in, and told someone in Sydney "good evening" over breakfast.
 * A greeting about the time of day is about the reader's time of day.
 *
 * Rendering it after mount also keeps it out of the prerendered HTML, which is
 * the point: a cached page cannot contain an hour or a name.
 *
 * ── The return ────────────────────────────────────────────────────────────
 * Lapses are normal and almost always temporary; people who felt guilty about
 * one were overwhelmingly willing to come back, and preferred to be shown the
 * periods that went well rather than the gap (Epstein et al. 2016). So when
 * the last viewing is more than a month old, the greeting shows the last three
 * things this person loved and one line to log something — and never the
 * number of days it has been.
 */
const LAPSE_DAYS = 30;

type Loved = { itemId: string; itemType: "movie" | "tv"; name: string; image: string | null };

export default function HomeGreeting() {
  const { user, isAuthenticated, ready } = useAuth();
  /**
   * Read once, at mount, from the initialiser rather than an effect.
   *
   * There is no hydration hazard in reading the clock during render here: this
   * returns null until `ready`, and `ready` is false through the whole server
   * render and the first client render, so the greeting is never part of the
   * markup being compared. It appears only after the provider has resolved,
   * which happens in a browser and nowhere else.
   */
  const [greeting] = useState(() => {
    const hour = new Date().getHours();
    return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  });

  const userId = user?.id ?? null;
  const { data: back } = useSWR(userId ? ["welcome-back", userId] : null, async () => {
    const { data: last } = await supabase
      .from("viewings")
      .select("watched_on")
      .eq("user_id", userId as string)
      .order("watched_on", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!last?.watched_on) return null;
    const days = Math.floor((Date.now() - new Date(`${last.watched_on}T00:00:00`).getTime()) / 86_400_000);
    if (days < LAPSE_DAYS) return null;

    // The last three things they loved: highest rated among recent viewings.
    const { data: recent } = await supabase
      .from("viewings")
      .select("item_id, item_type")
      .eq("user_id", userId as string)
      .order("watched_on", { ascending: false })
      .limit(40);
    const recentIds = [...new Set((recent ?? []).map((v) => v.item_id as string))];
    const { data: ratings } = recentIds.length
      ? await supabase.from("user_ratings").select("item_id, item_type, score").eq("user_id", userId as string).in("item_id", recentIds)
      : { data: [] as { item_id: string; item_type: string; score: number }[] };
    const scores = new Map((ratings ?? []).map((r) => [`${r.item_type}:${r.item_id}`, Number(r.score)]));
    const seen = new Set<string>();
    const picks = (recent ?? [])
      .filter((v) => {
        const k = `${v.item_type}:${v.item_id}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((v) => ({ ...v, score: scores.get(`${v.item_type}:${v.item_id}`) ?? 0 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    if (!picks.length) return { loved: [] as Loved[] };
    const { data: meta } = await supabase
      .from("user_media_status")
      .select("item_id, item_type, item_name, image_url")
      .eq("user_id", userId as string)
      .in("item_id", picks.map((p) => p.item_id as string));
    const names = new Map((meta ?? []).map((m) => [`${m.item_type}:${m.item_id}`, m]));
    const loved: Loved[] = picks
      .map((p) => {
        const m = names.get(`${p.item_type}:${p.item_id}`);
        return m
          ? { itemId: p.item_id as string, itemType: p.item_type === "tv" ? ("tv" as const) : ("movie" as const), name: m.item_name as string, image: m.image_url as string | null }
          : null;
      })
      .filter((x): x is Loved => !!x);
    return { loved };
  });

  if (!ready || !isAuthenticated || !user?.username) return null;

  return (
    <div className="pt-6 pb-2">
      <h1 className="text-lg sm:text-xl font-medium text-surface-300">
        {back ? "Welcome back, " : `Good ${greeting}, `}
        <span className="text-white font-semibold">{user.username}</span>
      </h1>
      {back && (
        <div className="mt-3 flex flex-wrap items-center gap-4 rounded-2xl border border-surface-800 bg-surface-900/40 px-4 py-3">
          {back.loved.length > 0 && (
            <div className="flex items-center gap-2">
              {back.loved.map((l) => (
                <Link key={`${l.itemType}:${l.itemId}`} href={titlePath(l.itemType, l.itemId, l.name)} title={l.name}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={getPosterUrl(l.image, "w92")} alt={l.name} className="h-14 w-10 rounded-md border border-surface-800 object-cover" />
                </Link>
              ))}
            </div>
          )}
          <p className="text-sm text-surface-300">
            {back.loved.length > 0 ? "The last few you loved. " : ""}
            Seen anything lately?{" "}
            <Link href="/app/quick-add" className="font-medium text-brand-400 hover:text-brand-300">
              Log it
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
