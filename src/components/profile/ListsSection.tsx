"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

type List = {
  id: number;
  name: string;
  description: string | null;
  visibility: string;
  items_count: number;
  created_at: string;
  updated_at: string;
  cover_image?: string | null;
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export default function ListsSection({
  profileId,
  isOwner = false,
}: {
  profileId: string;
  isOwner?: boolean;
}) {
  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLists = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/user-lists?userId=${encodeURIComponent(profileId)}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setLists(data.lists ?? []);
    } catch (e) {
      console.error(e);
      setLists([]);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  if (loading) {
    return (
      <div className="rounded-xl border border-surface-700/60 bg-surface-900/40 p-6 flex flex-col items-center justify-center gap-3 min-h-[200px]">
        <LoadingSpinner size="md" className="border-t-white shrink-0" />
        <p className="text-sm text-surface-500 animate-pulse">Loading lists…</p>
      </div>
    );
  }

  if (lists.length === 0) {
    return (
      <div className="rounded-xl border border-surface-700/60 bg-surface-900/50 p-12 text-center">
        <div className="text-4xl mb-4">📋</div>
        <p className="text-surface-400 text-sm">
          {isOwner
            ? "No lists yet. Create your first list to organize your favorite films."
            : "No lists yet."}
        </p>
        {isOwner && (
          <Link
            href="/app/lists/new"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-brand-500 text-surface-950 text-sm font-medium hover:bg-brand-400 transition-colors"
          >
            Create list
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Lists Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {lists.map((list) => (
          <Link
            key={list.id}
            href={`/app/lists/${list.id}`}
            className="group flex flex-col rounded-xl border border-surface-700/60 bg-surface-900/40 hover:border-surface-500/60 transition-all duration-300 overflow-hidden"
          >
            {/* Cover Image (if available) */}
            {list.cover_image ? (
              <div className="aspect-[16/9] overflow-hidden">
                <img
                  src={list.cover_image}
                  alt={list.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
            ) : (
              <div className="aspect-[16/9] bg-gradient-to-br from-surface-800 to-surface-900 flex items-center justify-center">
                <span className="text-4xl">🎬</span>
              </div>
            )}

            {/* Content */}
            <div className="p-4 flex-1 flex flex-col gap-2">
              <h3 className="text-base font-semibold text-surface-100 group-hover:text-brand-400 transition-colors line-clamp-1">
                {list.name}
              </h3>
              {list.description && (
                <p className="text-sm text-surface-400 line-clamp-2">
                  {list.description}
                </p>
              )}
              <div className="flex items-center justify-between mt-auto pt-2 border-t border-surface-700/50">
                <span className="text-xs text-surface-500">
                  {list.items_count} item{list.items_count !== 1 ? "s" : ""}
                </span>
                <span className="text-xs text-surface-500">
                  {list.visibility}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
