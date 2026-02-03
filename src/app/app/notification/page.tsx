"use client";

import { supabase } from "@/utils/supabase/client";
import {
  acceptFollowRequest,
  rejectFollowRequest,
} from "@/utils/followerAction";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { HiOutlineUser, HiOutlineBell } from "react-icons/hi2";

interface FollowRequest {
  id: number;
  sender_id: string;
  created_at: string;
  users?: { username?: string | null; avatar_url?: string | null } | null;
}

export default function NotificationPage() {
  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<number | null>(null);

  const fetchRequests = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    setUserId(user.id);

    let result = await supabase
      .from("user_follow_requests")
      .select(
        "id, sender_id, created_at, users!user_follow_requests_sender_id_fkey(username, avatar_url)"
      )
      .eq("receiver_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (result.error && (result.error.message?.includes("avatar_url") || result.error.code === "42703")) {
      result = await supabase
        .from("user_follow_requests")
        .select(
          "id, sender_id, created_at, users!user_follow_requests_sender_id_fkey(username)"
        )
        .eq("receiver_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
    }

    if (result.error) {
      console.error("Error fetching follow requests:", result.error);
      setRequests([]);
    } else {
      const list = (result.data ?? []).map((r: Record<string, unknown>) => ({
        ...r,
        users: r.users
          ? { ...(r.users as object), avatar_url: (r.users as { avatar_url?: string }).avatar_url ?? null }
          : null,
      }));
      setRequests(list as FollowRequest[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("notification-follow-requests")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "user_follow_requests" },
        (payload: { new: FollowRequest }) => {
          if (payload.new.receiver_id === userId) {
            setRequests((prev) => [payload.new as FollowRequest, ...prev]);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "user_follow_requests" },
        (payload: { new: { id: number; status: string } }) => {
          if (payload.new.status !== "pending") {
            setRequests((prev) => prev.filter((r) => r.id !== payload.new.id));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "user_follow_requests" },
        (payload: { old: { id: number } }) => {
          setRequests((prev) => prev.filter((r) => r.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const handleAccept = async (requestId: number, senderId: string) => {
    if (!userId) return;
    setActingId(requestId);
    const { error } = await acceptFollowRequest(requestId, senderId, userId);
    if (!error) {
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    }
    setActingId(null);
  };

  const handleReject = async (requestId: number) => {
    setActingId(requestId);
    const { error } = await rejectFollowRequest(requestId);
    if (!error) {
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    }
    setActingId(null);
  };

  // Auth gate: not logged in (loading done, no userId)
  if (!loading && !userId) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-200 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-neutral-700 bg-neutral-800/50 p-8 text-center">
          <HiOutlineBell className="w-12 h-12 text-neutral-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white">Notifications</h1>
          <p className="mt-2 text-sm text-neutral-400">
            Sign in to see follow requests and notifications.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-medium text-neutral-900 hover:bg-amber-400 transition-colors"
          >
            Log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,80,40,0.06),transparent)] pointer-events-none" />
      <div className="relative max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <header className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Follow requests — accept or decline.
          </p>
        </header>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-neutral-700/60 bg-neutral-800/40 p-5 animate-pulse"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-neutral-700" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-48 bg-neutral-700 rounded" />
                    <div className="h-3 w-32 bg-neutral-700/80 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-2xl border border-neutral-700/60 bg-neutral-800/40 p-12 text-center">
            <HiOutlineUser className="w-14 h-14 text-neutral-600 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-neutral-300">You're all caught up</h2>
            <p className="mt-2 text-sm text-neutral-500">
              When someone sends you a follow request, it will show up here.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {requests.map((req) => {
              const sender = req.users;
              const username = sender?.username ?? "Unknown";
              const avatarUrl = sender?.avatar_url || "/avatar.svg";
              const isActing = actingId === req.id;

              return (
                <li
                  key={req.id}
                  className="rounded-2xl border border-neutral-700/60 bg-neutral-800/50 hover:bg-neutral-800/70 transition-colors overflow-hidden"
                >
                  <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                    <Link
                      href={`/app/profile/${username}`}
                      className="flex items-center gap-3 min-w-0 shrink-0"
                    >
                      <img
                        src={avatarUrl}
                        alt=""
                        className="w-12 h-12 rounded-xl object-cover border border-neutral-700 bg-neutral-700 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-white truncate">@{username}</p>
                        <p className="text-xs text-neutral-500">
                          {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </Link>
                    <p className="text-sm text-neutral-400 sm:ml-2 shrink-0">
                      wants to follow you
                    </p>
                    <div className="flex gap-2 sm:ml-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => handleAccept(req.id, req.sender_id)}
                        disabled={isActing}
                        className="px-4 py-2 rounded-xl text-sm font-medium bg-amber-500 text-neutral-900 hover:bg-amber-400 disabled:opacity-50 transition-colors"
                      >
                        {isActing ? "…" : "Accept"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(req.id)}
                        disabled={isActing}
                        className="px-4 py-2 rounded-xl text-sm font-medium bg-neutral-700 text-neutral-200 hover:bg-neutral-600 disabled:opacity-50 transition-colors border border-neutral-600"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
