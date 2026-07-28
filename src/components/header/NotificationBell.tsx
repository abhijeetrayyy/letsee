"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/utils/supabase/client";
import { IoNotificationsOutline } from "react-icons/io5";
import Link from "next/link";

export default function NotificationBell({ userId }: { userId: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) return;
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_read", false)
      .then(({ count: c }) => { if (c != null) setCount(c); });

    const ch = supabase.channel(`notif-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => setCount(c => c + 1))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => {
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_read", false).then(({ count: c }) => { if (c != null) setCount(c); });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  return (
    <Link href="/app/notification" className="nav-icon-btn relative" aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ""}`}>
      <IoNotificationsOutline className="size-4" />
      {count > 0 && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">{count > 99 ? "99+" : count}</span>}
    </Link>
  );
}
