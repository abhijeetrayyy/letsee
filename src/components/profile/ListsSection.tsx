"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { swrFetcher } from "@/utils/swrFetcher";
import LikeButton from "@components/reactions/LikeButton";
import CreateListModal from "./CreateListModal";

type List = {
  id: number;
  name: string;
  description: string | null;
  visibility: string;
  items_count: number;
  created_at: string;
  updated_at: string;
  cover_image?: string | null;
  reaction_count?: number;
  viewer_liked?: boolean;
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
  const [createOpen, setCreateOpen] = useState(false);
  const { data, error, isLoading, mutate } = useSWR<{ lists: List[] }>(
    `/api/user-lists?userId=${encodeURIComponent(profileId)}`,
    swrFetcher,
  );
  const lists = data?.lists ?? [];
  const loading = isLoading;

  if (loading) {
    return (
      <div className="rounded-xl border border-surface-700/60 bg-surface-900/40 p-6 flex flex-col items-center justify-center gap-3 min-h-[200px]">
        <LoadingSpinner size="md" className="border-t-white shrink-0" />
        <p className="text-sm text-surface-500 animate-pulse">Loading lists…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-12 text-center flex flex-col items-center gap-3">
        <p className="text-sm text-red-300">Couldn't load lists.</p>
        <button
          onClick={() => mutate()}
          className="text-xs px-3 py-1.5 rounded-full border border-red-500/30 text-red-300 hover:bg-red-500/10 transition-colors"
        >
          Retry
        </button>
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
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-brand-500 text-surface-950 text-sm font-medium hover:bg-brand-400 transition-colors"
          >
            Create list
          </button>
        )}
        <CreateListModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onSuccess={() => {
            setCreateOpen(false);
            mutate();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isOwner && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 text-surface-950 text-sm font-medium hover:bg-brand-400 transition-colors"
          >
            Create list
          </button>
        </div>
      )}
      <CreateListModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          setCreateOpen(false);
          mutate();
        }}
      />
      {/* Lists Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {lists.map((list) => (
          <div
            key={list.id}
            className="group flex flex-col rounded-xl border border-surface-700/60 bg-surface-900/40 hover:border-surface-500/60 transition-all duration-300 overflow-hidden"
          >
            <Link href={`/app/lists/${list.id}`} className="flex flex-col flex-1">
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
              </div>
            </Link>

            {/* Footer sits outside the Link so the like button is its own control */}
            <div className="mx-4 mb-4 flex items-center justify-between gap-2 pt-2 border-t border-surface-700/50">
              <span className="text-xs text-surface-500">
                {list.items_count} item{list.items_count !== 1 ? "s" : ""}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-surface-500">{list.visibility}</span>
                <LikeButton
                  targetType="list"
                  targetId={list.id}
                  initialCount={list.reaction_count ?? 0}
                  initialLiked={list.viewer_liked ?? false}
                  size="sm"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
