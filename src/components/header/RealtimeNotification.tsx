"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";

interface RealtimeUnreadCountProps {
  userId: any;
}

const RealtimeUnreadCount: React.FC<RealtimeUnreadCountProps> = ({ userId }) => {
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false);

      if (error) {
        // Fallback: if notifications table doesn't exist yet, check follow requests
        const { count: fallbackCount } = await supabase
          .from("user_follow_requests")
          .select("*", { count: "exact", head: true })
          .eq("receiver_id", userId)
          .eq("status", "pending");
        setUnreadCount(fallbackCount || 0);
      } else {
        setUnreadCount(count || 0);
      }
    };

    fetchUnreadCount();

    // Real-time subscription for new notifications
    const subscription = supabase
      .channel(`realtime-notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          setUnreadCount((prevCount) => prevCount + 1);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        fetchUnreadCount
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [userId]);

  return (
    <span>
      {unreadCount > 0 && (
        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
          ({unreadCount})
        </span>
      )}
    </span>
  );
};

export default RealtimeUnreadCount;
