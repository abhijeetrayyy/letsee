"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { sendFollowRequest } from "@/utils/followerAction";
import Link from "next/link";

interface FollowerBtnClientProps {
  profileId: string;
  currentUserId: string | null;
  initialStatus: "following" | "pending" | "follow";
}

export function FollowerBtnClient({
  profileId,
  currentUserId,
  initialStatus,
}: FollowerBtnClientProps) {
  const [status, setStatus] = useState(initialStatus);
  const [isLoading, setIsLoading] = useState(false);
  const [logedin, setLogedin] = useState(false);
  const [modal, setModal] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      setIsLoading(true);
      if (!currentUserId) {
        setLogedin(false);
        setIsLoading(false);
        return;
      }
      try {
        const { data } = await supabase
          .from("user_connections")
          .select("id")
          .eq("follower_id", currentUserId)
          .eq("followed_id", profileId);

        if (data?.length) {
          setStatus("following");
          return;
        }

        const { data: requestData } = await supabase
          .from("user_follow_requests")
          .select("id")
          .eq("sender_id", currentUserId)
          .eq("receiver_id", profileId);

        setStatus(requestData?.length ? "pending" : "follow");
      } catch (error) {
        console.error("Error fetching follow status:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatus();

    // Subscribe to changes for real-time updates
    const subscription = supabase
      .channel("follow_requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_follow_requests" },
        fetchStatus
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [profileId, currentUserId, supabase]);

  const handleFollowClick = async () => {
    if (isLoading) return;
    setIsLoading(true);

    if (!logedin) {
      setModal(true);
      return;
    }

    try {
      if (status === "following") {
        await supabase
          .from("user_connections")
          .delete()
          .eq("follower_id", currentUserId)
          .eq("followed_id", profileId);
        setStatus("follow");
      } else if (status === "pending") {
        await supabase
          .from("user_follow_requests")
          .delete()
          .eq("sender_id", currentUserId)
          .eq("receiver_id", profileId);
        setStatus("follow");
      } else {
        if (!currentUserId) return;
        const { error } = await sendFollowRequest(currentUserId, profileId);
        if (!error) setStatus("pending");
        else console.log(error);
      }
    } catch (error) {
      console.error("Error handling follow action:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {modal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-9999">
          <div className="bg-neutral-700 w-full h-fit max-w-3xl sm:rounded-lg p-5 shadow-xl">
            <div className="flex justify-between items-center p-4 border-b">
              <Link
                className="bg-blue-600 hover:bg-blue-700 rounded-md px-3 py-2 text-white text-lg font-semibold"
                href={"/login"}
              >
                Log in
              </Link>
              <button
                onClick={() => {
                  setModal(false);
                  setIsLoading(false);
                }}
                className="text-white hover:text-gray-300"
              >
                ✖
              </button>
            </div>
            <div className="p-4">
              <p className="text-white">You need to log in to follow.</p>
            </div>
          </div>
        </div>
      )}
      <button
        className={`px-4 py-2 rounded ${
          status === "following"
            ? "bg-gray-500"
            : status === "pending"
            ? "bg-yellow-500"
            : "bg-blue-500"
        } text-white`}
        onClick={handleFollowClick}
        disabled={isLoading}
      >
        {isLoading
          ? "Loading..."
          : status === "following"
          ? "Unfollow"
          : status === "pending"
          ? "Requested"
          : "Follow"}
      </button>
    </>
  );
}

export function ShowFollowing({ followingCount, userId }: any) {
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [following, setFollowing] = useState([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function getFollowing() {
      if (modal) {
        setLoading(true);
        setError(null);
        try {
          const response = await fetch("/api/getfollowing", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId }),
          });
          if (!response.ok) {
            if (response.status === 401) {
              throw new Error("Log in to view following.");
            }
            if (response.status === 403) {
              throw new Error("Following list is private.");
            }
            throw new Error("Failed to fetch following");
          }
          const res = await response.json();
          setFollowing(res.connection);
        } catch (error) {
          console.error("Error fetching following:", error);
          setError((error as Error).message || "Failed to fetch following");
        } finally {
          setLoading(false);
        }
      }
    }
    getFollowing();
  }, [modal, userId]);

  const countStr = formatCount(followingCount);
  return (
    <>
      <button
        type="button"
        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-neutral-600 bg-neutral-800/80 px-3.5 py-2 text-sm font-medium text-white/90 hover:bg-neutral-700 hover:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 focus:ring-offset-neutral-900 tabular-nums"
        onClick={() => setModal(true)}
      >
        <span>{countStr}</span>
        <span>Following</span>
      </button>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setModal(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-neutral-700 bg-neutral-800 p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Following</h2>
              <button type="button" className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-700 hover:text-white" onClick={() => setModal(false)} aria-label="Close">×</button>
            </div>
            {loading ? (
              <p className="text-neutral-400 text-sm py-4">Loading…</p>
            ) : error ? (
              <p className="text-red-400 text-sm">{error}</p>
            ) : following.length !== 0 ? (
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {following.map((user: any, index: number) => (
                  <li key={index}>
                    <Link href={`/app/profile/${user.users?.username ?? ""}`} className="block rounded-lg py-2 px-2 text-white/90 hover:bg-neutral-700 hover:text-white">
                      @{user.users?.username ?? "—"}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-neutral-500 text-sm py-4">No one yet.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString();
}

export function ShowFollower({ followerCount, userId }: any) {
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [following, setFollowing] = useState([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function getFollowing() {
      if (modal) {
        setLoading(true);
        setError(null);
        try {
          const response = await fetch("/api/getfollower", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId }),
          });
          if (!response.ok) {
            if (response.status === 401) {
              throw new Error("Log in to view followers.");
            }
            if (response.status === 403) {
              throw new Error("Followers list is private.");
            }
            throw new Error("Failed to fetch following");
          }
          const res = await response.json();
          setFollowing(res.connection);
        } catch (error) {
          console.error("Error fetching following:", error);
          setError((error as Error).message || "Failed to fetch followers");
        } finally {
          setLoading(false);
        }
      }
    }
    getFollowing();
  }, [modal, userId]);

  const countStr = formatCount(followerCount);
  return (
    <>
      <button
        type="button"
        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-neutral-600 bg-neutral-800/80 px-3.5 py-2 text-sm font-medium text-white/90 hover:bg-neutral-700 hover:border-neutral-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 focus:ring-offset-neutral-900 tabular-nums"
        onClick={() => setModal(true)}
      >
        <span>{countStr}</span>
        <span>Followers</span>
      </button>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setModal(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-neutral-700 bg-neutral-800 p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Followers</h2>
              <button type="button" className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-700 hover:text-white" onClick={() => setModal(false)} aria-label="Close">×</button>
            </div>
            {loading ? (
              <p className="text-neutral-400 text-sm py-4">Loading…</p>
            ) : error ? (
              <p className="text-red-400 text-sm">{error}</p>
            ) : following.length > 0 ? (
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {following.map((user: any, index: number) => (
                  <li key={index}>
                    <Link href={`/app/profile/${user.users?.username ?? ""}`} className="block rounded-lg py-2 px-2 text-white/90 hover:bg-neutral-700 hover:text-white">
                      @{user.users?.username ?? "—"}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-neutral-500 text-sm py-4">No followers yet.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
