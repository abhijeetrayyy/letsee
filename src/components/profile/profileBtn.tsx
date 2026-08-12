"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import FollowButton from "./FollowButton";

interface FollowerBtnClientProps {
  profileId: string;
  currentUserId: string | null;
  initialStatus: "following" | "pending" | "follow";
  profileVisibility: string;
}

/** Profile-page follow control. Thin wrapper over the shared FollowButton. */
export function FollowerBtnClient({
  profileId,
  currentUserId,
  profileVisibility,
}: FollowerBtnClientProps) {
  return (
    <FollowButton
      targetUserId={profileId}
      currentUserId={currentUserId}
      targetVisibility={profileVisibility}
      watchRequests
    />
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
              <div className="py-6 flex flex-col items-center justify-center gap-3">
                <LoadingSpinner size="sm" className="border-t-white shrink-0" />
                <p className="text-neutral-400 text-sm animate-pulse">Loading…</p>
              </div>
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
              <div className="py-6 flex flex-col items-center justify-center gap-3">
                <LoadingSpinner size="sm" className="border-t-white shrink-0" />
                <p className="text-neutral-400 text-sm animate-pulse">Loading…</p>
              </div>
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
