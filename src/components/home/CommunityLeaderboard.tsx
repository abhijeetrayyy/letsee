"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trophy, Medal, Eye } from "lucide-react";
import Avatar from "@components/ui/Avatar";
import FollowButton from "@components/profile/FollowButton";
import { useAuth } from "@/app/contextAPI/AuthProvider";

export default function CommunityLeaderboard() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user: authUser } = useAuth();

  useEffect(() => {
    fetch("/api/HomeDiscover", { credentials: "include" })
      .then(r => r.json().catch(()=>({})))
      .then(d => {
        const u = (d.users ?? []).slice(0, 10).map((u: any, i: number) => ({ rank: i+1, id: u.id ?? u.user_id ?? u.username, username: u.username??"user", avatar: u.avatar_url??null, count: u.watched_count??0, tagline: u.about??null }));
        setUsers(u.sort((a:any,b:any) => b.count - a.count));
      }).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  if (loading) return <div className="animate-pulse space-y-2">{Array(3).fill(0).map((_,i)=><div key={i} className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-surface-800"/><div className="flex-1 h-4 bg-surface-800 rounded"/></div>)}</div>;
  if (!users.length) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-3"><Trophy className="size-3.5 text-amber-400"/><h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Top Watchers</h3></div>
        <p className="text-xs text-surface-500">No one to rank yet — you could be first.</p>
      </div>
    );
  }

  const medals: Record<number, React.ReactNode> = { 1: <Trophy className="size-4 text-amber-400"/>, 2: <Medal className="size-4 text-slate-300"/>, 3: <Medal className="size-4 text-amber-700"/> };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3"><Trophy className="size-3.5 text-amber-400"/><h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">Top Watchers</h3></div>
      <div className="space-y-1.5">
        {users.slice(0, 8).map((u: any) => (
          <div key={u.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-surface-800/50 transition-colors group">
            <span className="w-5 text-center text-xs font-bold text-surface-500">{medals[u.rank] ?? u.rank}</span>
            <Link href={`/app/profile/${u.username}`} className="flex items-center gap-2.5 flex-1 min-w-0">
              <Avatar src={u.avatar} name={u.username} size="xs" />
              <div className="flex-1 min-w-0"><p className="text-xs font-medium text-surface-300 group-hover:text-white truncate">@{u.username}</p></div>
              <div className="flex items-center gap-1 text-[10px] text-surface-500 tabular-nums"><Eye className="size-3 text-emerald-400"/>{u.count.toLocaleString()}</div>
            </Link>
            <FollowButton
              targetUserId={u.id}
              currentUserId={authUser?.id ?? null}
              initialStatus="follow"
              size="sm"
              className="shrink-0 !px-2.5 !py-1 !text-[10px]"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
