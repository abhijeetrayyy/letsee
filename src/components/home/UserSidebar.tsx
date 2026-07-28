"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Star, Bookmark, Clock } from "lucide-react";
import ProfileAvatar from "@components/profile/ProfileAvatar";

interface SidebarStats {
  watchedCount: number;
  favoriteCount: number;
  watchlistCount: number;
  hoursEstimate: number;
  avatarUrl: string | null;
  tagline: string | null;
  followersCount: number;
  followingCount: number;
}

export default function UserSidebar({ username }: { username: string }) {
  const [stats, setStats] = useState<SidebarStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchStats() {
      try {
        const [prefRes, profileRes] = await Promise.all([
          fetch("/api/userPrefrence", { credentials: "include" }),
          fetch(`/api/profile/settings`, { credentials: "include" }),
        ]);

        const pref = prefRes.ok ? await prefRes.json().catch(() => ({})) : {};
        const profile = profileRes.ok ? await profileRes.json().catch(() => ({})) : {};

        if (cancelled) return;

        setStats({
          watchedCount: pref.watched?.length ?? 0,
          favoriteCount: pref.favorite?.length ?? 0,
          watchlistCount: pref.watchlater?.length ?? 0,
          hoursEstimate: Math.round((pref.watched?.length ?? 0) * 2),
          avatarUrl: profile.avatar_url ?? null,
          tagline: profile.tagline ?? null,
          followersCount: profile.followers_count ?? 0,
          followingCount: profile.following_count ?? 0,
        });
      } catch {
        if (!cancelled) setStats(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchStats();
    return () => { cancelled = true; };
  }, []);

  if (loading || !stats) return <SidebarSkeleton />;

  return (
    <div className="rounded-2xl border border-surface-800/50 bg-surface-900/40 overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-surface-800/30 bg-gradient-to-r from-brand-500/5 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-surface-800 flex-shrink-0">
            <ProfileAvatar
              src={stats.avatarUrl ?? ""}
              alt={username}
              className="w-full h-full object-cover"
              width={40}
              height={40}
            />
          </div>
          <div>
            <Link href={`/app/profile/${username}`} className="text-white font-semibold text-sm hover:text-brand-400 transition-colors">
              @{username}
            </Link>
            {stats.tagline && (
              <p className="text-surface-500 text-[11px] truncate max-w-[200px]">&quot;{stats.tagline}&quot;</p>
            )}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-px bg-surface-800/20">
        <StatCell icon={<Eye className="size-3.5 text-emerald-400" />} value={stats.watchedCount} label="Watched" href="/app/profile" />
        <StatCell icon={<Star className="size-3.5 text-amber-400" />} value={stats.favoriteCount} label="Favorites" href="/app/profile" />
        <StatCell icon={<Bookmark className="size-3.5 text-blue-400" />} value={stats.watchlistCount} label="Watchlist" href="/app/watchlist" />
        <StatCell icon={<Clock className="size-3.5 text-purple-400" />} value={`${stats.hoursEstimate}h`} label="Hours" href="/app/profile" />
      </div>

      {/* Quick links */}
      <div className="p-3 border-t border-surface-800/30 space-y-1">
        <SidebarLink href="/app/profile" label="View your profile" />
        <SidebarLink href="/app/profile/setup" label="Edit profile" />
        <SidebarLink href="/app/watchlist" label="Your watchlist" />
        <SidebarLink href="/app/messages" label="Messages" />
      </div>
    </div>
  );
}

function StatCell({ icon, value, label, href }: { icon: React.ReactNode; value: number | string; label: string; href: string }) {
  return (
    <Link href={href} className="flex flex-col items-center py-3 hover:bg-surface-800/30 transition-colors">
      {icon}
      <span className="text-base font-bold text-white mt-1 tabular-nums">{value}</span>
      <span className="text-[10px] text-surface-500 uppercase tracking-wider mt-0.5">{label}</span>
    </Link>
  );
}

function SidebarLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block px-3 py-2 rounded-lg text-xs text-surface-400 hover:text-white hover:bg-surface-800/50 transition-colors"
    >
      {label}
    </Link>
  );
}

function SidebarSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-800/50 bg-surface-900/40 p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-surface-800" />
        <div>
          <div className="h-4 w-24 bg-surface-800 rounded" />
          <div className="h-3 w-32 bg-surface-800 rounded mt-1" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 bg-surface-800 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
