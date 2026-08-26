"use client";

import React, { useEffect, useState, useContext } from "react";
import Link from "@components/ui/AppLink";
import UserPrefrenceContext from "@/app/contextAPI/userPrefrence";
import { getPosterUrl } from "@/utils/imageUrl";
import { fetchCurrentlyWatching, type WatchingItem } from "@/lib/db/home";
import { useAuth } from "@/app/contextAPI/AuthProvider";

import { titlePath } from "@/utils/urls";
export default function CurrentlyWatchingSection() {
  const { user, userPrefrence } = useContext(UserPrefrenceContext);
  const { user: authUser } = useAuth();
  const watchingIds = userPrefrence.watching;
  const [items, setItems] = useState<WatchingItem[]>([]);
  const [loading, setLoading] = useState(true);

  /**
   * One `select` on `user_media_status`, from the browser.
   *
   * `/api/currently-watching` was a Vercel function that opened a cookie
   * client and ran exactly this query; `user_media_status_self` scopes it to
   * the caller either way. This strip renders on `/app`, which is where every
   * signed-in session begins.
   */
  const userId = authUser?.id ?? null;
  useEffect(() => {
    if (!user || !userId || watchingIds.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- a query is an external system; the loading flag is the standard shape for one
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchCurrentlyWatching(userId)
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, userId, watchingIds.length]);

  if (loading || items.length === 0) return null;

  return (
    <section
      className="rounded-2xl border border-surface-700/60 bg-surface-800/50 px-4 sm:px-6 py-8 sm:py-10"
      aria-labelledby="currently-watching-heading"
    >
      <div className="flex items-center gap-3 mb-5">
        <div className="w-1 h-6 rounded-full bg-brand-500 shrink-0" />
        <h2
          id="currently-watching-heading"
          className="text-2xl sm:text-3xl font-bold text-white tracking-tight"
        >
          Currently watching
        </h2>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
        {items.map((item) => {
          const posterUrl = getPosterUrl(item.image_url, "w185");
          const href = titlePath(item.item_type, item.item_id, item.item_name);
          return (
            <Link
              key={item.item_id}
              href={href}
              className="shrink-0 w-36 sm:w-40 flex flex-col rounded-xl overflow-hidden border border-surface-700 bg-surface-800/80 hover:border-surface-600 hover:bg-surface-800 transition-colors"
            >
              <div className="relative aspect-2/3 w-full overflow-hidden">
                <img loading="lazy" decoding="async"
                  src={posterUrl}
                  alt={item.item_name ?? ""}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2">
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/90 text-surface-900 text-[10px] font-semibold uppercase tracking-wide">
                    {item.item_type === "tv" ? "TV" : "Movie"}
                  </span>
                </div>
              </div>
              <div className="p-2 min-h-0">
                <p className="text-sm font-medium text-surface-100 line-clamp-2">
                  {item.item_name}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
