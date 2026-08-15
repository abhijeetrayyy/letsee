"use client";

import Link from "next/link";
import useSWR from "swr";
import { ListPlus, Loader2 } from "lucide-react";
import { swrFetcher } from "@/utils/swrFetcher";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import Avatar from "@components/ui/Avatar";

type PublicList = {
  id: number;
  name: string;
  description: string | null;
  items_count: number;
  reaction_count: number;
  updated_at: string;
  users?: { username: string | null; avatar_url: string | null } | null;
};

/**
 * Browse everyone's public lists.
 *
 * /app/lists had no page at all — only /app/lists/[listId] — so the route 404'd
 * for everyone, and a list could only be reached from its author's profile.
 * Lists are the most shareable thing in the app, so they need a front door.
 */
export default function ListsPage() {
  const { isAuthenticated } = useAuth();
  const { data, isLoading, error } = useSWR<{ lists: PublicList[] }>(
    "/api/user-lists?scope=public",
    swrFetcher,
  );

  const lists = data?.lists ?? [];

  return (
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Lists</h1>
        <p className="mt-1.5 text-sm text-surface-400">
          Collections people have put together — a director&apos;s run, a mood, a year worth
          revisiting.
        </p>
      </header>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-surface-900/60 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="py-16 text-center">
          <p className="text-surface-200 font-medium">Couldn&apos;t load lists</p>
          <p className="mt-1 text-sm text-surface-500">Try again in a moment.</p>
        </div>
      ) : lists.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-surface-700/60 bg-surface-900/30 px-6 py-14 text-center">
          <ListPlus className="mx-auto size-8 text-surface-600" aria-hidden />
          <p className="mt-3 text-surface-200 font-medium">No public lists yet</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-surface-500">
            A list is a handful of titles that belong together. Make one on your profile and
            set it to public, and it will show up here.
          </p>
          <Link
            href={isAuthenticated ? "/app/profile" : "/signup"}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-surface-950 hover:bg-brand-400 transition-colors"
          >
            {isAuthenticated ? "Make a list" : "Join to make one"}
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {lists.map((list) => (
            <Link
              key={list.id}
              href={`/app/lists/${list.id}`}
              className="group rounded-2xl border border-surface-800/70 bg-surface-900/40 p-4 hover:border-surface-600/60 hover:bg-surface-900/70 transition-colors"
            >
              <h2 className="font-semibold text-white group-hover:text-brand-400 transition-colors line-clamp-1">
                {list.name}
              </h2>
              {list.description && (
                <p className="mt-1 text-sm text-surface-400 line-clamp-2">{list.description}</p>
              )}

              <div className="mt-3 flex items-center gap-2 text-xs text-surface-500">
                {list.users?.username && (
                  <span className="inline-flex items-center gap-1.5">
                    <Avatar
                      src={list.users.avatar_url}
                      name={list.users.username}
                      size={18}
                    />
                    {list.users.username}
                  </span>
                )}
                <span className="text-surface-700">·</span>
                <span>
                  {list.items_count} {list.items_count === 1 ? "title" : "titles"}
                </span>
                {list.reaction_count > 0 && (
                  <>
                    <span className="text-surface-700">·</span>
                    <span>{list.reaction_count} liked</span>
                  </>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {isLoading && (
        <p className="sr-only" role="status">
          <Loader2 className="animate-spin" aria-hidden /> Loading lists
        </p>
      )}
    </main>
  );
}
