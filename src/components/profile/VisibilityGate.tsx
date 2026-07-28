import ProfileAvatar from "@components/profile/ProfileAvatar";
import { Lock, Users, Globe, Film, Star, Bookmark } from "lucide-react";

type VisibilityGateProps = {
  username: string;
  avatarSrc: string;
  tagline?: string | null;
  visibility: string;
  stats: {
    watchedCount: number;
    favoriteCount: number;
    watchlistCount: number;
    followersCount: number;
    followingCount: number;
  };
  followButton?: React.ReactNode;
  loginPrompt?: React.ReactNode;
  isLoggedIn: boolean;
};

export default function VisibilityGate({
  username,
  avatarSrc,
  tagline,
  visibility,
  stats,
  followButton,
  loginPrompt,
  isLoggedIn,
}: VisibilityGateProps) {
  const isFollowersOnly = visibility === "followers";
  const isPrivate = visibility === "private";

  return (
    <section className="w-full max-w-xl mx-auto">
      {/* Public preview card — always shown */}
      <div className="rounded-2xl border border-surface-700 bg-surface-900/50 p-6 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-surface-600 flex-shrink-0">
            <ProfileAvatar
              src={avatarSrc}
              alt={`@${username}`}
              className="w-full h-full object-cover"
              width={64}
              height={64}
            />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">@{username}</h2>
            {tagline && (
              <p className="text-sm text-surface-400 italic mt-0.5">&quot;{tagline}&quot;</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              {isPrivate ? (
                <span className="inline-flex items-center gap-1 text-xs text-surface-500">
                  <Lock className="size-3" /> Private
                </span>
              ) : isFollowersOnly ? (
                <span className="inline-flex items-center gap-1 text-xs text-surface-500">
                  <Users className="size-3" /> Followers only
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-surface-500">
                  <Globe className="size-3" /> Public
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <StatPreview icon={<Film className="size-3.5" />} value={stats.watchedCount} label="Watched" />
          <StatPreview icon={<Star className="size-3.5" />} value={stats.favoriteCount} label="Favorites" />
          <StatPreview icon={<Bookmark className="size-3.5" />} value={stats.watchlistCount} label="Watchlist" />
        </div>

        {/* Gate message */}
        <div className="rounded-xl bg-surface-950/80 p-4 border border-surface-800">
          {!isLoggedIn && (
            <>
              <p className="text-surface-300 text-sm font-medium mb-2">
                Sign in to see more
              </p>
              <p className="text-surface-500 text-xs mb-3">
                Create an account to track your own films and connect with {isPrivate ? "this user" : `@${username}`}.
              </p>
            </>
          )}
          {isLoggedIn && isPrivate && (
            <>
              <p className="text-surface-300 text-sm font-medium mb-2">
                This account is private
              </p>
              <p className="text-surface-500 text-xs mb-3">
                {username} has chosen to keep their film journey private.
              </p>
            </>
          )}
          {isLoggedIn && isFollowersOnly && (
            <>
              <p className="text-surface-300 text-sm font-medium mb-2">
                Follow to see their full profile
              </p>
              <p className="text-surface-500 text-xs mb-3">
                Their watched titles, favorites, ratings, and reviews are visible to followers only.
              </p>
            </>
          )}

          <div className="flex justify-center gap-3">
            {followButton ?? loginPrompt}
          </div>
        </div>
      </div>
    </section>
  );
}

function StatPreview({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center p-3 rounded-xl bg-surface-950/50 border border-surface-800/50">
      <div className="text-surface-500 mb-1">{icon}</div>
      <span className="text-lg font-bold text-white tabular-nums">{formatNum(value)}</span>
      <span className="text-[10px] text-surface-500 uppercase tracking-wider">{label}</span>
    </div>
  );
}

function formatNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}
