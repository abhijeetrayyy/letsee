"use client";

import { buildBrowseUrl } from "@/utils/browseUrl";
import Link from "@components/ui/AppLink";
import { Search, Bookmark, List, Users, Tv, Film } from "lucide-react";

export default function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-2">
      <ActionCard href="/app/search" icon={<Search className="size-4" />} label="Search" />
      <ActionCard href="/app/watchlist" icon={<Bookmark className="size-4" />} label="Watchlist" />
      <ActionCard href="/app/profile" icon={<Users className="size-4" />} label="Discover" />
      <ActionCard href="/app/lists" icon={<List className="size-4" />} label="Lists" />
      <ActionCard href={buildBrowseUrl({ type: "movie" })} icon={<Film className="size-4" />} label="Movies" />
      <ActionCard href={buildBrowseUrl({ type: "tv" })} icon={<Tv className="size-4" />} label="TV Shows" />
    </div>
  );
}

function ActionCard({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-surface-900/60 border border-surface-800/50 hover:border-brand-500/30 hover:bg-surface-800/80 transition-all group"
    >
      <span className="text-surface-400 group-hover:text-brand-400 transition-colors">{icon}</span>
      <span className="text-xs font-medium text-surface-300 group-hover:text-white transition-colors">{label}</span>
    </Link>
  );
}

