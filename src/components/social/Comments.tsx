"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useMediaInteraction } from "@/app/contextAPI/MediaInteractionProvider";
import { MessageCircle, Send, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import toast from "react-hot-toast";
import LikeButton from "@components/reactions/LikeButton";
import Avatar from "@components/ui/Avatar";

interface Comment { id: number; user_id: string; body: string; created_at: string; parent_id: number|null; users: { username: string|null; avatar_url: string|null }; reaction_count: number; viewer_liked: boolean; }

export default function Comments({ itemId, itemType }: { itemId: string; itemType: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<number|null>(null);
  const [showAll, setShowAll] = useState(false);
  const { isAuthenticated } = useMediaInteraction();

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch(`/api/comments?itemId=${itemId}&itemType=${itemType}`); if (r.ok) setComments(await r.json()); } catch {} finally { setLoading(false); }
  }, [itemId, itemType]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!body.trim()) return;
    setSubmitting(true);
    try {
      const r = await fetch("/api/comments", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ itemId, itemType, body: body.trim(), parentId: replyTo }) });
      if (r.ok) { const c = await r.json(); setComments(p => [...p, c]); setBody(""); setReplyTo(null); toast.success("Comment added"); }
      else { const e = await r.json().catch(()=>({})); toast.error(e.error||"Failed"); }
    } catch { toast.error("Failed"); } finally { setSubmitting(false); }
  };

  const remove = async (id: number) => {
    try { const r = await fetch(`/api/comments?id=${id}`, { method: "DELETE" }); if (r.ok) { setComments(p => p.filter(c => c.id !== id)); toast.success("Deleted"); } }
    catch { toast.error("Failed"); }
  };

  const top = comments.filter(c => !c.parent_id);
  const replies = (pid: number) => comments.filter(c => c.parent_id === pid);
  const visible = showAll ? top : top.slice(0, 3);

  if (loading && !comments.length) return <div className="animate-pulse space-y-2">{[1,2].map(i=><div key={i} className="h-16 bg-surface-800 rounded-xl"/>)}</div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <MessageCircle className="size-4 text-brand-400" /><h3 className="text-sm font-semibold text-white">Discussion</h3>
        <span className="text-xs text-surface-500">{comments.length}</span>
      </div>

      {isAuthenticated && (
        <form onSubmit={submit} className="flex gap-2 mb-4">
          <input value={body} onChange={e=>setBody(e.target.value)} placeholder={replyTo ? "Write a reply..." : "Share your thoughts..."} className="flex-1 bg-surface-800/60 border border-surface-700/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30" maxLength={2000} />
          <button type="submit" disabled={submitting||!body.trim()} className="shrink-0 px-4 py-2.5 rounded-xl bg-brand-500/10 text-brand-400 hover:bg-brand-500/20 border border-brand-500/20 text-sm font-medium disabled:opacity-50"><Send className="size-4" /></button>
          {replyTo && <button type="button" onClick={()=>{setReplyTo(null);setBody("");}} className="shrink-0 px-3 py-2.5 rounded-xl text-xs text-surface-500 hover:text-surface-300">Cancel</button>}
        </form>
      )}

      {visible.map(c => (
        <div key={c.id} className="group">
          <div className="flex gap-2.5">
            <Link href={`/app/profile/${c.users?.username||""}`} className="shrink-0 mt-0.5">
              <Avatar src={c.users?.avatar_url} name={c.users?.username || "?"} size={28} />
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Link href={`/app/profile/${c.users?.username||""}`} className="text-xs font-semibold text-white hover:text-brand-400">@{c.users?.username||"anon"}</Link>
                <span className="text-[10px] text-surface-500">{timeAgo(c.created_at)}</span>
              </div>
              <p className="text-sm text-surface-300 mt-0.5 leading-relaxed">{c.body}</p>
              <div className="flex items-center gap-1 mt-1">
                <LikeButton targetType="comment" targetId={c.id} initialCount={c.reaction_count} initialLiked={c.viewer_liked} size="sm" />
                {isAuthenticated && <button onClick={()=>{setReplyTo(c.id);setBody("");}} className="text-[10px] text-surface-500 hover:text-brand-400 px-2">Reply</button>}
                {isAuthenticated && <button onClick={()=>remove(c.id)} className="text-[10px] text-surface-600 hover:text-red-400 opacity-0 group-hover:opacity-100 px-2"><Trash2 className="size-3"/></button>}
              </div>
              {replies(c.id).map(r => (
                <div key={r.id} className="flex gap-2 mt-2 ml-4 pl-3 border-l-2 border-surface-800">
                  <Link href={`/app/profile/${r.users?.username||""}`} className="shrink-0 mt-0.5">
                    <Avatar src={r.users?.avatar_url} name={r.users?.username || "?"} size={20} />
                  </Link>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5"><Link href={`/app/profile/${r.users?.username||""}`} className="text-[10px] font-semibold text-white">@{r.users?.username}</Link><span className="text-[9px] text-surface-500">{timeAgo(r.created_at)}</span></div>
                    <p className="text-xs text-surface-400 mt-0.5">{r.body}</p>
                    <LikeButton targetType="comment" targetId={r.id} initialCount={r.reaction_count} initialLiked={r.viewer_liked} size="sm" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      {top.length > 3 && (
        <button onClick={()=>setShowAll(!showAll)} className="flex items-center gap-1 text-xs text-surface-500 hover:text-brand-400">
          {showAll ? <><ChevronUp className="size-3"/>Show less</> : <><ChevronDown className="size-3"/>Show all {top.length} comments</>}
        </button>
      )}
      {!isAuthenticated && <p className="text-xs text-surface-500 text-center py-2"><Link href="/login" className="text-brand-400">Sign in</Link> to join.</p>}
    </div>
  );
}

function timeAgo(iso: string): string {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d/60000);
  if (m<1) return "now"; if (m<60) return `${m}m`; const h = Math.floor(m/60);
  if (h<24) return `${h}h`; const days = Math.floor(h/24);
  if (days<30) return `${days}d`; return new Date(iso).toLocaleDateString("en-US",{month:"short",day:"numeric"});
}
