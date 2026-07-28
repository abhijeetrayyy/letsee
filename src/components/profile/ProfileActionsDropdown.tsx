"use client";

import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, Flag, ShieldOff } from "lucide-react";
import toast from "react-hot-toast";

export default function ProfileActionsDropdown({ profileId, currentUserId }: { profileId: string; currentUserId: string|null }) {
  const [open, setOpen] = useState(false); const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const c = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener("mousedown", c); return () => document.removeEventListener("mousedown", c); }, []);
  if (!currentUserId || currentUserId === profileId) return null;

  const block = async () => {
    try { const r = await fetch("/api/user/block", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ profileId }) }); if (r.ok) { toast.success("Blocked"); setOpen(false); } } catch {}
  };
  const report = async () => {
    const reason = prompt("Reason: spam, harassment, inappropriate, fake, other"); if (!reason) return;
    try { const r = await fetch("/api/user/report", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ profileId, reason }) }); if (r.ok) { toast.success("Reported"); setOpen(false); } } catch {}
  };

  return (
    <div ref={ref} className="relative inline-flex ml-1">
      <button onClick={()=>setOpen(!open)} className="p-2 rounded-xl bg-surface-800/60 text-surface-400 hover:text-white transition-colors border border-surface-700/50"><MoreHorizontal className="size-4"/></button>
      {open && <div className="absolute right-0 top-full mt-1 w-36 rounded-xl border border-surface-700 bg-surface-800 shadow-xl z-50 py-1">
        <button onClick={block} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-300 hover:text-white hover:bg-surface-700"><ShieldOff className="size-3.5 text-red-400"/> Block</button>
        <button onClick={report} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-300 hover:text-white hover:bg-surface-700"><Flag className="size-3.5 text-amber-400"/> Report</button>
      </div>}
    </div>
  );
}
