"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, UserPlus } from "lucide-react";

export default function PeopleYouMayKnow() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/recommendations/collaborative", { cache: "no-store" })
      .then(r => r.json().catch(() => ({})))
      .then(d => {
        const u = (d.similarUsers ?? []).slice(0, 5).map((u: any) => ({
          user_id: u.user_id, username: u.username ?? "user", avatar_url: u.avatar_url ?? null,
          match: Math.round((u.matchScore || 0) * 100), genres: u.topGenres ?? [],
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
        {users.map((u: any) => (
          <Link key={u.user_id} href={`/app/profile/${u.username}`} className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-700 flex-shrink-0 ring-1 ring-surface-600">{u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-xs text-surface-400 font-bold">{u.username[0]?.toUpperCase()}</div>}</div>
            <div className="flex-1 min-w-0"><p className="text-xs font-medium text-surface-200 group-hover:text-white truncate">@{u.username}</p><p className="text-[10px] text-surface-500">{u.match}% taste match{u.genres.length>0 && <span className="text-surface-600"> · {u.genres.slice(0,2).join(", ")}</span>}</p></div>
            <div className="shrink-0 px-2 py-1 rounded-lg bg-brand-500/10 text-brand-400 text-[10px] font-medium border border-brand-500/20"><UserPlus className="size-3 inline mr-0.5"/>{u.match}%</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
