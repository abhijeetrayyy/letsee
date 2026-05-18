"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

function slug(title: string): string {
  return title
    .trim()
    .replace(/[^a-zA-Z0-9]/g, "-")
    .replace(/-+/g, "-");
}

function detailHref(mediaType: string, id: string, title: string): string {
  const s = slug(title);
  return `/app/${mediaType}/${Number(id)}${s ? `-${s}` : ""}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function formatFullDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

type DiaryItem = {
  id: number;
  item_id: string;
  item_type: string;
  item_name: string;
  image_url: string | null;
  watched_at: string;
  score: number | null;
  review_text: string | null;
};

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 10 }, (_, i) => currentYear - i);

export default function FilmDiary({
  userId,
  isOwner = false,
}: {
  userId: string;
  isOwner?: boolean;
}) {
  const [items, setItems] = useState<DiaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        userId,
        page: String(page),
        limit: "30",
      });
      if (selectedYear) params.set("year", selectedYear);
      if (selectedMonth) params.set("month", selectedMonth);

      const res = await fetch(`/api/profile/film-diary?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setItems(data.data ?? []);
      setTotalPages(data.totalPages ?? 1);
    } catch (e) {
      console.error(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [userId, page, selectedYear, selectedMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    setSelectedMonth("");
    setPage(1);
  };

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    setPage(1);
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-surface-700/60 bg-surface-900/40 p-6 flex flex-col items-center justify-center gap-3 min-h-[200px]">
        <LoadingSpinner size="md" className="border-t-white shrink-0" />
        <p className="text-sm text-surface-500 animate-pulse">Loading diary…</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-surface-700/60 bg-surface-900/50 p-12 text-center">
        <div className="text-4xl mb-4">🎬</div>
        <p className="text-surface-400 text-sm">
          {isOwner
            ? "No films in your diary yet. Start watching and add ratings to see them here."
            : "No films in this user's diary yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedYear}
          onChange={(e) => handleYearChange(e.target.value)}
          className="bg-surface-800 border border-surface-700 text-surface-200 text-sm py-2 px-3 rounded-lg focus:ring-1 focus:ring-brand-500 outline-none"
        >
          <option value="">All years</option>
          {yearOptions.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>

        {selectedYear && (
          <select
            value={selectedMonth}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="bg-surface-800 border border-surface-700 text-surface-200 text-sm py-2 px-3 rounded-lg focus:ring-1 focus:ring-brand-500 outline-none"
          >
            <option value="">All months</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
              <option key={month} value={month}>
                {new Date(2000, month - 1).toLocaleDateString(undefined, {
                  month: "long",
                })}
              </option>
            ))}
          </select>
        )}

        {(selectedYear || selectedMonth) && (
          <button
            onClick={() => {
              setSelectedYear("");
              setSelectedMonth("");
              setPage(1);
            }}
            className="text-sm text-surface-400 hover:text-surface-200 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Diary Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {items.map((item) => {
          const href = detailHref(item.item_type, item.item_id, item.item_name);
          const posterUrl = item.image_url
            ? `https://image.tmdb.org/t/p/w185${item.image_url}`
            : "/no-photo.webp";

          return (
            <div
              key={item.id}
              className="group relative flex flex-col rounded-xl overflow-hidden border border-surface-700/60 bg-surface-900/40 hover:border-surface-500/60 transition-all duration-300"
            >
              {/* Poster */}
              <Link href={href} className="relative aspect-[2/3] overflow-hidden">
                <img
                  src={posterUrl}
                  alt={item.item_name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-surface-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                {/* Rating Badge */}
                {item.score != null && (
                  <div className="absolute top-2 right-2">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-accent-gold/90 text-surface-950 text-xs font-bold shadow-lg">
                      {item.score}
                    </span>
                  </div>
                )}

                {/* Date Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-xs text-white/90 font-medium">
                    {formatDate(item.watched_at)}
                  </p>
                </div>
              </Link>

              {/* Info */}
              <div className="p-3 flex-1 flex flex-col gap-1">
                <Link
                  href={href}
                  className="text-sm font-medium text-surface-100 line-clamp-2 hover:text-brand-400 transition-colors"
                >
                  {item.item_name}
                </Link>
                <p className="text-xs text-surface-500">
                  {formatFullDate(item.watched_at)}
                </p>
                {item.review_text && (
                  <p className="text-xs text-surface-400 line-clamp-2 italic mt-1">
                    {item.review_text.slice(0, 80)}
                    {item.review_text.length > 80 ? "…" : ""}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-surface-800 text-surface-200 hover:bg-surface-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-surface-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-surface-800 text-surface-200 hover:bg-surface-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
