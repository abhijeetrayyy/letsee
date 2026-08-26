"use client";

import { useEffect, useState } from "react";
import Link from "@components/ui/AppLink";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import FollowButton from "./FollowButton";
import { fetchConnections, type Connection } from "@/lib/db/social";
import { useAuth } from "@/app/contextAPI/AuthProvider";

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
  const { user } = useAuth();
  const viewerId = user?.id ?? null;
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [following, setFollowing] = useState<Connection[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function getFollowing() {
      if (modal) {
        setLoading(true);
        setError(null);
        try {
          // Read directly — `user_connections` is gated by
          // `profile_visible_to_viewer`, and this only runs when the modal is
          // opened, which is already the right shape: nobody pays for a list
          // they did not ask to see.
          setFollowing(await fetchConnections(userId, viewerId, "following"));
        } catch (error) {
          console.error("Error fetching following:", error);
          // `fetchConnections` throws "Forbidden" for a profile this viewer may
          // not see; say that in the words the reader needs.
          const message = (error as Error).message;
          setError(message === "Forbidden" ? "Following list is private." : "Failed to fetch following");
        } finally {
          setLoading(false);
        }
      }
    }
    getFollowing();
  }, [modal, userId, viewerId]);

  const countStr = formatCount(followingCount);
  return (
    <>
      <button
        type="button"
        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-surface-600 bg-surface-800/80 px-3.5 py-2 text-sm font-medium text-white/90 hover:bg-surface-700 hover:border-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-2 focus:ring-offset-surface-900 tabular-nums"
        onClick={() => setModal(true)}
      >
        <span>{countStr}</span>
        <span>Following</span>
      </button>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setModal(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-surface-700 bg-surface-800 p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Following</h2>
              <button type="button" className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-700 hover:text-white" onClick={() => setModal(false)} aria-label="Close">×</button>
            </div>
            {loading ? (
              <div className="py-6 flex flex-col items-center justify-center gap-3">
                <LoadingSpinner size="sm" className="border-t-white shrink-0" />
                <p className="text-surface-400 text-sm animate-pulse">Loading…</p>
              </div>
            ) : error ? (
              <p className="text-red-400 text-sm">{error}</p>
            ) : following.length !== 0 ? (
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {following.map((person) => (
                  <li key={person.id}>
                    <Link href={`/app/profile/${person.username ?? ""}`} className="block rounded-lg py-2 px-2 text-white/90 hover:bg-surface-700 hover:text-white">
                      @{person.username ?? "—"}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-surface-500 text-sm py-4">No one yet.</p>
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
  const { user } = useAuth();
  const viewerId = user?.id ?? null;
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [following, setFollowing] = useState<Connection[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function getFollowing() {
      if (modal) {
        setLoading(true);
        setError(null);
        try {
          // Read directly — `user_connections` is gated by
          // `profile_visible_to_viewer`, and this only runs when the modal is
          // opened, which is already the right shape: nobody pays for a list
          // they did not ask to see.
          setFollowing(await fetchConnections(userId, viewerId, "followers"));
        } catch (error) {
          console.error("Error fetching following:", error);
          const message = (error as Error).message;
          setError(message === "Forbidden" ? "Followers list is private." : "Failed to fetch followers");
        } finally {
          setLoading(false);
        }
      }
    }
    getFollowing();
  }, [modal, userId, viewerId]);

  const countStr = formatCount(followerCount);
  return (
    <>
      <button
        type="button"
        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-surface-600 bg-surface-800/80 px-3.5 py-2 text-sm font-medium text-white/90 hover:bg-surface-700 hover:border-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-2 focus:ring-offset-surface-900 tabular-nums"
        onClick={() => setModal(true)}
      >
        <span>{countStr}</span>
        <span>Followers</span>
      </button>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setModal(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-surface-700 bg-surface-800 p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Followers</h2>
              <button type="button" className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-700 hover:text-white" onClick={() => setModal(false)} aria-label="Close">×</button>
            </div>
            {loading ? (
              <div className="py-6 flex flex-col items-center justify-center gap-3">
                <LoadingSpinner size="sm" className="border-t-white shrink-0" />
                <p className="text-surface-400 text-sm animate-pulse">Loading…</p>
              </div>
            ) : error ? (
              <p className="text-red-400 text-sm">{error}</p>
            ) : following.length > 0 ? (
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {following.map((person) => (
                  <li key={person.id}>
                    <Link href={`/app/profile/${person.username ?? ""}`} className="block rounded-lg py-2 px-2 text-white/90 hover:bg-surface-700 hover:text-white">
                      @{person.username ?? "—"}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-surface-500 text-sm py-4">No followers yet.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
