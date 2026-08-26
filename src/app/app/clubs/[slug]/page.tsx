"use client";

import { use, useState } from "react";
import Link from "@components/ui/AppLink";
import useSWR from "swr";
import { ArrowLeft, Users, Loader2, CalendarClock } from "lucide-react";
import { swrFetcher } from "@/utils/swrFetcher";
import { useAuth } from "@/app/contextAPI/AuthProvider";
import { getPosterUrl } from "@/utils/imageUrl";
import Avatar from "@components/ui/Avatar";
import Comments from "@components/social/Comments";
import { titlePath } from "@/utils/urls";

type Member = { userId: string; username: string; avatarUrl: string | null; role: string };
type Pick = {
  id: number;
  item_id: string;
  item_type: string;
  title: string;
  image_url: string | null;
  note: string | null;
  ends_at: string;
};
type ClubData = {
  club: { id: number; slug: string; name: string; description: string | null; member_count: number };
  members: Member[];
  pick: Pick | null;
  isMember: boolean;
  /** "none" | "pending" | "active" | "banned" — pending is a real state as of 083. */
  membership?: string;
  isAdmin: boolean;
};

function daysLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "ended";
  const days = Math.ceil(ms / 86400000);
  return days === 1 ? "1 day left" : `${days} days left`;
}

export default function ClubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { isAuthenticated } = useAuth();
  const { data, isLoading, mutate } = useSWR<ClubData>(`/api/clubs/${slug}`, swrFetcher);
  const [busy, setBusy] = useState(false);

  const toggleMembership = async () => {
    if (!data || busy) return;
    setBusy(true);
    try {
      // Leaving and withdrawing a pending request are the same DELETE.
      const joined = data.isMember || data.membership === "pending";
      await fetch(`/api/clubs/${slug}/members`, {
        method: joined ? "DELETE" : "POST",
      });
      mutate();
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-950">
        <Loader2 className="size-5 animate-spin text-surface-500" />
      </div>
    );
  }

  if (!data?.club) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-surface-950 text-surface-400">
        <p>That club doesn&apos;t exist.</p>
        <Link href="/app/clubs" className="text-brand-400 hover:underline">
          Back to clubs
        </Link>
      </div>
    );
  }

  const { club, members, pick, isMember } = data;
  const pending = data.membership === "pending";

  return (
    <div className="min-h-screen w-full bg-surface-950 text-white">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <Link
          href="/app/clubs"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-300"
        >
          <ArrowLeft className="size-4" /> All clubs
        </Link>

        <header className="rounded-2xl border border-surface-700/60 bg-surface-900/40 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{club.name}</h1>
              {club.description && (
                <p className="mt-1.5 text-sm text-surface-400">{club.description}</p>
              )}
            </div>
            {isAuthenticated && (
              <button
                type="button"
                onClick={toggleMembership}
                disabled={busy}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
                  isMember || pending
                    ? "border border-surface-700 bg-surface-800 text-surface-300 hover:bg-surface-700"
                    : "bg-brand-500 text-surface-950 hover:bg-brand-400"
                }`}
              >
                {busy ? "…" : isMember ? "Leave" : pending ? "Requested" : "Join"}
              </button>
            )}
          </div>

          {/* Faces, not a number — at small scale "the 4 of us" is the feature. */}
          <div className="mt-4 flex items-center gap-3">
            <div className="flex -space-x-2">
              {members.slice(0, 6).map((m) => (
                <Link key={m.userId} href={`/app/profile/${m.username}`} title={`@${m.username}`}>
                  <Avatar
                    src={m.avatarUrl}
                    name={m.username}
                    size="sm"
                    className="ring-2 ring-surface-900 transition-transform hover:scale-110"
                  />
                </Link>
              ))}
            </div>
            <span className="flex items-center gap-1.5 text-xs text-surface-500">
              <Users className="size-3.5" />
              {club.member_count} member{club.member_count === 1 ? "" : "s"}
            </span>
          </div>
        </header>

        {/* This week's pick — the shared deadline that stands in for being in
            the same room. */}
        <section className="mt-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-surface-500">
            This week&apos;s pick
          </h2>
          {pick ? (
            <div className="rounded-2xl border border-surface-700/60 bg-surface-900/40 p-4">
              <div className="flex gap-4">
                <Link href={titlePath(pick.item_type, pick.item_id, pick.title)} className="shrink-0">
                  <img loading="lazy" decoding="async"
                    src={getPosterUrl(pick.image_url, "w185")}
                    alt={pick.title}
                    className="aspect-[2/3] w-20 rounded-lg object-cover"
                  />
                </Link>
                <div className="min-w-0">
                  <Link
                    href={titlePath(pick.item_type, pick.item_id, pick.title)}
                    className="font-semibold text-white hover:text-brand-400 transition-colors"
                  >
                    {pick.title}
                  </Link>
                  {pick.note && <p className="mt-1 text-sm text-surface-400">{pick.note}</p>}
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-300">
                    <CalendarClock className="size-3" />
                    {daysLeft(pick.ends_at)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-surface-700/60 bg-surface-900/20 p-6 text-center">
              <p className="text-sm text-surface-400">No pick this week.</p>
              <p className="mt-1 text-xs text-surface-500">
                An organiser sets one and everyone watches it before it expires.
              </p>
            </div>
          )}
        </section>

        {/* Discussion — reuses the existing comments system */}
        <section className="mt-8">
          <Comments itemId={String(club.id)} itemType="club" />
        </section>
      </div>
    </div>
  );
}
