"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import AppLink from "@components/ui/AppLink";
import { X } from "lucide-react";
import { getPosterUrl } from "@/utils/imageUrl";
import { titlePath } from "@/utils/urls";
import { formatStars } from "@/utils/ratingScale";
import { SERIES } from "./palette";
import type { TitleQuery, TitleRow } from "./types";

const PAGE_SIZE = 24;

/**
 * The titles behind one bar.
 *
 * ── Why this exists at all ─────────────────────────────────────────────────
 * "You have watched 90 things rated 6–7" is a fact nobody can do anything
 * with. *Which* 90 is the interesting part, and it is the difference between a
 * chart people look at once and one they use. Every bar in this section opens
 * this panel.
 *
 * Paged, never "load everything": the RPC caps a page at 100 and reports the
 * true total, so a 3,000-title bucket costs the same first paint as a 12-title
 * one.
 */
export default function TitleDrawer({
  userId,
  query,
  onClose,
}: {
  userId: string;
  query: TitleQuery;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<TitleRow[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(
    async (offset: number) => {
      const params = new URLSearchParams({
        userId,
        source: query.source,
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (query.bucket != null) params.set("bucket", String(query.bucket));
      if (query.type) params.set("type", query.type);
      if (query.genre) params.set("genre", query.genre);
      if (query.decade != null) params.set("decade", String(query.decade));

      const response = await fetch(`/api/profile/stats/titles?${params}`);
      if (!response.ok) throw new Error(String(response.status));
      return (await response.json()) as {
        data: TitleRow[];
        total: number;
        hasMore: boolean;
      };
    },
    [userId, query],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    load(0)
      .then((payload) => {
        if (cancelled) return;
        setRows(payload.data);
        setTotal(payload.total);
        setHasMore(payload.hasMore);
      })
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [load]);

  // Escape closes, and focus lands on the close button — a panel that opens
  // over the page and cannot be dismissed from the keyboard is a trap.
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const payload = await load(rows.length);
      setRows((current) => [...current, ...payload.data]);
      setHasMore(payload.hasMore);
    } catch {
      setError(true);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={query.label}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-t-2xl border border-surface-700 bg-surface-900 sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-surface-800 p-5">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-surface-100">
              {query.label}
            </h3>
            <p className="mt-0.5 text-xs text-surface-400">
              {loading ? "Loading…" : `${total} title${total === 1 ? "" : "s"}`}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-100"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {loading && (
            <div className="space-y-2 p-2">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-surface-800/60" />
              ))}
            </div>
          )}

          {!loading && error && (
            <p className="p-8 text-center text-sm text-red-300">
              Couldn&rsquo;t load these titles.
            </p>
          )}

          {!loading && !error && rows.length === 0 && (
            <p className="p-8 text-center text-sm text-surface-500">
              Nothing here.
            </p>
          )}

          <ul className="space-y-1">
            {rows.map((row) => (
              <li key={`${row.item_type}:${row.item_id}`}>
                <AppLink
                  href={titlePath(row.item_type, row.item_id, row.title)}
                  className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-surface-800/60"
                >
                  <Image
                    src={getPosterUrl(row.image_url, "w92")}
                    alt=""
                    width={36}
                    height={54}
                    className="h-[54px] w-9 shrink-0 rounded object-cover bg-surface-800"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-surface-100">
                      {row.title ?? "Untitled"}
                    </span>
                    <span className="mt-0.5 block text-xs text-surface-500">
                      {row.release_year ?? "—"} · {row.item_type === "tv" ? "TV" : "Film"}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3 text-xs tabular-nums">
                    {row.your_score != null && (
                      <span className="text-right">
                        <span className="block font-medium" style={{ color: SERIES.you }}>
                          {formatStars(row.your_score)}★
                        </span>
                        <span className="block text-[10px] text-surface-600">you</span>
                      </span>
                    )}
                    {row.crowd_score != null && (
                      <span className="text-right">
                        <span className="block font-medium" style={{ color: SERIES.crowd }}>
                          {row.crowd_score.toFixed(1)}
                        </span>
                        <span className="block text-[10px] text-surface-600">TMDB</span>
                      </span>
                    )}
                  </span>
                </AppLink>
              </li>
            ))}
          </ul>

          {hasMore && !loading && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="mt-2 w-full rounded-lg border border-surface-700 py-2.5 text-sm text-surface-300 transition-colors hover:border-surface-600 hover:text-surface-100 disabled:opacity-50"
            >
              {loadingMore ? "Loading…" : `Show more (${total - rows.length} left)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
