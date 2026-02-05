"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useApiFetch } from "@/hooks/useApiFetch";
import { FetchError } from "@/components/ui/FetchError";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import CreateListModal from "./CreateListModal";

type ListItem = {
  id: number;
  name: string;
  description: string | null;
  visibility: string;
  items_count: number;
  created_at: string;
  updated_at: string;
};

export default function ProfileLists({
  profileId,
  isOwner,
}: {
  profileId: string;
  isOwner: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const { data, error, loading, refetch } = useApiFetch<{ lists?: ListItem[] }>(
    `/api/user-lists?userId=${encodeURIComponent(profileId)}`,
    { credentials: "include", enabled: true }
  );

  const lists = data?.lists ?? [];

  if (error) {
    return (
      <div className="my-6">
        <FetchError message={error === "Request failed (401)" ? "Log in to view lists." : error} onRetry={refetch} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="my-6 flex flex-col items-center justify-center gap-3 py-8 min-h-[120px]">
        <LoadingSpinner size="md" className="border-t-white shrink-0" />
        <p className="text-neutral-500 text-sm animate-pulse">Loading lists…</p>
      </div>
    );
  }

  return (
    <div className="my-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-neutral-100">
          {isOwner ? "My lists" : "Lists"}
        </h2>
        {isOwner && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-all duration-200 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-neutral-900"
          >
            Create list
          </button>
        )}
      </div>
      {lists.length === 0 ? (
        <div className="rounded-xl border border-neutral-700/60 bg-neutral-800/30 p-6 text-center">
          <p className="text-neutral-400 text-sm">
            {isOwner ? "No custom lists yet." : "No lists yet."}
          </p>
          {isOwner && (
            <p className="text-neutral-500 text-sm mt-1">Create one to organize movies and TV.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {lists.map((list) => (
            <Link
              key={list.id}
              href={`/app/lists/${list.id}`}
              className="block p-4 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 transition-all duration-200 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:ring-offset-2 focus:ring-offset-neutral-900 focus:rounded-lg"
            >
              <h3 className="font-semibold text-neutral-100 truncate">{list.name}</h3>
              {list.description && (
                <p className="text-sm text-neutral-400 mt-1 line-clamp-2">{list.description}</p>
              )}
              <p className="text-xs text-neutral-500 mt-2">
                {list.items_count} item{list.items_count !== 1 ? "s" : ""} · {list.visibility}
              </p>
            </Link>
          ))}
        </div>
      )}
      {isOwner && (
        <CreateListModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={() => {
            setModalOpen(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}
