"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, MessageCircle } from "lucide-react";
import SendMessageModal from "@components/message/sendCard";

type Match = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  match: number;
  genres: string[];
  icebreaker: string;
  sharedItem: { itemId: string; itemType: "movie" | "tv"; name: string } | null;
};

export default function PeopleYouMayKnow() {
  const [users, setUsers] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [dmTarget, setDmTarget] = useState<Match | null>(null);

  useEffect(() => {
    fetch("/api/recommendations/collaborative", { cache: "no-store" })
      .then(r => r.json().catch(() => ({})))
      .then(d => {
        const u = (d.similarUsers ?? [])
          .filter((u: any) => u.user_id && u.username)
          .slice(0, 5)
          .map((u: any) => ({
            user_id: u.user_id, username: u.username, avatar_url: u.avatar_url ?? null,
            match: Math.round((u.matchScore || 0) * 100), genres: u.topGenres ?? [],
            icebreaker: u.icebreaker ?? "You have similar taste in movies & TV — say hi!",
            sharedItem: u.sharedItem ?? null,
          }));
        setUsers(u);
      }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="rounded-xl border border-surface-800/50 bg-surface-900/30 p-4 animate-pulse"><div className="h-4 w-32 bg-surface-800 rounded mb-3"/>{Array(3).fill(0).map((_,i)=><div key={i} className="flex items-center gap-3 mb-3"><div className="w-8 h-8 rounded-full bg-surface-800"/><div className="flex-1"><div className="h-3 w-20 bg-surface-800 rounded mb-1"/><div className="h-2 w-16 bg-surface-800 rounded"/></div></div>)}</div>;
  if (!users.length) return null;

  return (
    <div className="rounded-xl border border-surface-800/50 bg-surface-900/30 p-4">
      <div className="flex items-center gap-2 mb-3"><Users className="size-3.5 text-purple-400"/><h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">People You May Know</h3></div>
      <div className="space-y-3">
        {users.map((u) => (
          <div key={u.user_id} className="flex items-center gap-3 group">
            <Link href={`/app/profile/${u.username}`} className="w-8 h-8 rounded-full overflow-hidden bg-surface-700 flex-shrink-0 ring-1 ring-surface-600">{u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-xs text-surface-400 font-bold">{u.username[0]?.toUpperCase()}</div>}</Link>
            <Link href={`/app/profile/${u.username}`} className="flex-1 min-w-0">
              <p className="text-xs font-medium text-surface-200 group-hover:text-white truncate">@{u.username}</p>
              <p className="text-[10px] text-surface-500 truncate">{u.icebreaker}</p>
            </Link>
            <button
              type="button"
              onClick={() => setDmTarget(u)}
              className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-brand-500/10 text-brand-400 text-[10px] font-medium border border-brand-500/20 hover:bg-brand-500/20 transition-colors"
              title="Say hi"
            >
              <MessageCircle className="size-3" /> {u.match}%
            </button>
          </div>
        ))}
      </div>

      <SendMessageModal
        isOpen={!!dmTarget}
        onClose={() => setDmTarget(null)}
        data={dmTarget?.sharedItem ? { id: dmTarget.sharedItem.itemId, name: dmTarget.sharedItem.name } : null}
        media_type={dmTarget?.sharedItem?.itemType ?? null}
        initialMessage={dmTarget?.icebreaker}
        preselectedUser={dmTarget ? { id: dmTarget.user_id, username: dmTarget.username } : undefined}
      />
    </div>
  );
}
