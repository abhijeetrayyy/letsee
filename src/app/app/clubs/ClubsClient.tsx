"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Users, Plus, Loader2 } from "lucide-react";
import { swrFetcher } from "@/utils/swrFetcher";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import EmptyState from "@components/ui/EmptyState";
import ClubPickWidget from "@components/home/ClubPickWidget";

type Club = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  member_count: number;
  isMember: boolean;
};

export function ClubsClient() {
  const { isAuthenticated } = useAuth();
  const { data, isLoading, mutate } = useSWR<{ clubs: Club[] }>("/api/clubs", swrFetcher);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const clubs = data?.clubs ?? [];

  const create = async () => {
    if (name.trim().length < 3) {
      setError("Give the club a name (3+ characters)");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/clubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't create that club");
      setName("");
      setDescription("");
      setCreating(false);
      mutate();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-surface-950 text-white">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <header className="mb-6 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Clubs</h1>
            <p className="mt-1 text-sm text-surface-400">
              Small groups that watch something together and talk about it.
            </p>
          </div>
          {isAuthenticated && !creating && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-surface-950 hover:bg-brand-400 transition-colors"
            >
              <Plus className="size-4" /> New club
            </button>
          )}
        </header>

        {/* The house pick. It lived on the home page, where it competed with
            everything else for a glance; here it's context for the thing the
            page is already about. */}
        <div className="mb-6">
          <ClubPickWidget />
        </div>

        {creating && (
          <div className="mb-6 rounded-2xl border border-surface-700/60 bg-surface-900/50 p-5">
            <h2 className="mb-3 text-sm font-semibold text-white">Start a club</h2>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Slow Cinema Sunday"
              maxLength={60}
              className="mb-2 w-full rounded-xl border border-surface-700 bg-surface-800 px-4 py-2.5 text-sm text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's it for? (optional)"
              rows={2}
              maxLength={280}
              className="w-full resize-none rounded-xl border border-surface-700 bg-surface-800 px-4 py-2.5 text-sm text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            />
            {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={create}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-surface-950 hover:bg-brand-400 disabled:opacity-50"
              >
                {saving && <Loader2 className="size-3.5 animate-spin" />} Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setError("");
                }}
                className="text-sm text-surface-500 hover:text-surface-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-surface-900/50" />
            ))}
          </div>
        ) : clubs.length === 0 ? (
          <EmptyState
            icon={<Users className="size-10" />}
            title="No clubs yet"
            description="A club is a few people watching the same thing on the same week. Start one and invite the people whose taste you like."
            className="rounded-2xl border border-surface-700/60 bg-surface-900/40"
          />
        ) : (
          <ul className="space-y-3">
            {clubs.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/app/clubs/${c.slug}`}
                  className="flex items-center gap-4 rounded-2xl border border-surface-700/60 bg-surface-900/40 p-4 transition-colors hover:border-surface-600 hover:bg-surface-800/50"
                >
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400">
                    <Users className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-white">{c.name}</p>
                    {c.description && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-surface-500">{c.description}</p>
                    )}
                    <p className="mt-1 text-[11px] text-surface-500">
                      {c.member_count} member{c.member_count === 1 ? "" : "s"}
                    </p>
                  </div>
                  {c.isMember && (
                    <span className="shrink-0 rounded-full bg-brand-500/15 px-2.5 py-1 text-[10px] font-semibold text-brand-300">
                      Joined
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
