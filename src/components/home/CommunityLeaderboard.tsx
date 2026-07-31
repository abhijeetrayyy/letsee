"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trophy, Medal, Eye } from "lucide-react";

export default function CommunityLeaderboard() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/HomeDiscover", { credentials: "include" })
      .then(r => r.json().catch(()=>({})))
      .then(d => {
        const u = (d.users ?? []).slice(0, 10).map((u: any, i: number) => ({ rank: i+1, id: u.id ?? u.user_id ?? u.username, username: u.username??"user", avatar: u.avatar_url??null, count: u.watched_count??0, tagline: u.about??null }));
        setUsers(u.sort((a:any,b:any) => b.count - a.count));
      }).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  if (loading) return <div className="animate-pulse space-y-2">{Array(3).fill(0).map((_,i)=><div key={i} className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-surface-800"/><div className="flex-1 h-4 bg-surface-800 rounded"/></div>)}</div>;
  if (!users.length) return null;

  const medals: Record<number, React.ReactNode> = { 1: <Trophy className="size-4 text-amber-400"/>, 2: <Medal className="size-4 text-slate-300"/>, 3: <Medal className="size-4 text-amber-700"/> };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3"><Trophy className="size-3.5 text-amber-400"/><h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Top Watchers</h3></div>
      <div className="space-y-1.5">
        {users.slice(0, 8).map((u: any) => (
          <Link key={u.id} href={`/app/profile/${u.username}`} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-surface-800/50 transition-colors group">
            <span className="w-5 text-center text-xs font-bold text-surface-500">{medals[u.rank] ?? u.rank}</span>
            <div className="w-7 h-7 rounded-full overflow-hidden bg-surface-700 flex-shrink-0">{u.avatar ? <img src={u.avatar} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-[9px] text-surface-400 font-bold">{u.username[0]?.toUpperCase()}</div>}</div>
            <div className="flex-1 min-w-0"><p className="text-xs font-medium text-surface-300 group-hover:text-white truncate">@{u.username}</p></div>
            <div className="flex items-center gap-1 text-[10px] text-surface-500 tabular-nums"><Eye className="size-3 text-emerald-400"/>{u.count.toLocaleString()}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
