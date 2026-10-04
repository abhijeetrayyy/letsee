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
    <div ref={ref} className="relative inline-flex">
      <button type="button" onClick={()=>setOpen(!open)} aria-label="More: block or report" aria-expanded={open} className="flex size-10 items-center justify-center rounded-full text-ink-400 ring-1 ring-inset ring-line-input transition-colors hover:bg-hover hover:text-ink-0"><MoreHorizontal className="size-4" aria-hidden/></button>
      {open && <div className="absolute right-0 top-full z-50 mt-2 w-40 rounded-card border border-line-strong bg-overlay py-1 text-left shadow-2xl">
        <button onClick={block} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink-300 hover:text-ink-0 hover:bg-hover"><ShieldOff className="size-3.5 text-danger"/> Block</button>
        <button onClick={report} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink-300 hover:text-ink-0 hover:bg-hover"><Flag className="size-3.5 text-ink-300"/> Report</button>
      </div>}
    </div>
  );
}
